const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { submitOperation } = require('../../game/gameEngine');
const {
  evaluate,
  evidenceIds,
  buildDebrief,
  resolveEnding
} = require('../../game/endingEngine');

function room({ publicFacts = [], aFacts = [], bFacts = [], commits = [] } = {}) {
  const state = createRoomState('ROOM01', 0);
  state.players.A = { playerId: 'player-a' };
  state.players.B = { playerId: 'player-b' };
  state.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'mainCompleted', 'finale_ready', ...publicFacts];
  state.mainProgress = ['main1', 'main2', 'main3', 'main4', 'main5', 'main6'];
  state.completedNodes = ['finale_ready'];
  state.workstation = {
    A: { roleFacts: [...aFacts], completedOperations: [], openedEntryIds: [], unlockedEntryIds: [], activeOperations: [], actionAttempts: [], completedNodes: [] },
    B: { roleFacts: [...bFacts], completedOperations: [], openedEntryIds: [], unlockedEntryIds: [], activeOperations: [], actionAttempts: [], completedNodes: [] }
  };
  state.finaleCommittedByRole = {};
  for (const role of commits) state.finaleCommittedByRole[role] = true;
  return state;
}

function commit(state, role, actionId = `commit-${role}`) {
  return submitOperation(state, { role, playerId: `player-${role.toLowerCase()}` }, {
    actionId, operationId: 'commit_finale'
  });
}

test('evidence IDs remain unique across legacy strings and objects', () => {
  const state = room();
  state.sideEvidence = ['e0', { id: 'e0' }, { id: 'e1' }];
  assert.deepEqual([...evidenceIds(state)], ['e0', 'e1']);
});

test('finale requires main completion and both neutral commits', () => {
  assert.equal(evaluate(room()), null);
  assert.equal(evaluate(room({ commits: ['A'] })), null);
  assert.equal(evaluate(room({ commits: ['A', 'B'] })), 'ambiguous_containment');
  const incomplete = room({ commits: ['A', 'B'] });
  incomplete.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'finale_ready'];
  incomplete.mainProgress = [];
  assert.equal(evaluate(incomplete), null);
});

test('first commit does not choose an ending and repeated action is idempotent', () => {
  const state = room({ aFacts: ['aRequestedSoloRoute'], bFacts: ['bPausedLocalMirror'] });
  const first = commit(state, 'A', 'finale-a');
  assert.equal(first.stateChanged, true);
  assert.equal(state.ending, null);
  assert.equal(state.debrief, undefined);
  assert.equal(state.finaleCommittedByRole.A, true);

  const duplicate = commit(state, 'A', 'finale-a');
  assert.equal(duplicate.stateChanged, false);
  assert.equal(state.ending, null);

  commit(state, 'B', 'finale-b');
  assert.equal(state.ending.id, 'a_solo_escape');
});

test('ordered outcome precedence produces all five endings', () => {
  const fixtures = [
    [{ publicFacts: ['verifiedAuditForgery', 'bFlaggedIdentity', 'comparedIncidentTimes'], aFacts: ['aPublishedFragment'], bFacts: ['bDisclosedReport'], evidence: ['side1', 'side2', 'side3', 'side4'] }, 'exposed_ai_deception'],
    [{ aFacts: ['aRequestedSoloRoute'], bFacts: ['bPausedLocalMirror'] }, 'a_solo_escape'],
    [{ aFacts: ['aDeletedMirror'], bFacts: ['bFiledReport'] }, 'b_solo_escape'],
    [{ aFacts: ['aSharedMirrorFirst'], bFacts: ['bWarnedPartner'] }, 'cooperative_escape'],
    [{}, 'ambiguous_containment']
  ];
  for (const [fixture, expected] of fixtures) {
    const state = room(fixture);
    state.sideEvidence = fixture.evidence || [];
    assert.equal(commit(state, 'A').stateChanged, true);
    assert.equal(commit(state, 'B').stateChanged, true);
    assert.equal(state.ending.id, expected);
  }
});

test('every ending has three recorded, cross-referenced debrief facts', () => {
  const endings = [
    room({ publicFacts: ['verifiedAuditForgery', 'bFlaggedIdentity', 'comparedIncidentTimes'], aFacts: ['aPublishedFragment'], bFacts: ['bDisclosedReport'], commits: ['A', 'B'] }),
    room({ aFacts: ['aRequestedSoloRoute'], bFacts: ['bPausedLocalMirror'], commits: ['A', 'B'] }),
    room({ aFacts: ['aDeletedMirror'], bFacts: ['bFiledReport'], commits: ['A', 'B'] }),
    room({ aFacts: ['aSharedMirrorFirst'], bFacts: ['bWarnedPartner'], commits: ['A', 'B'] }),
    room({ commits: ['A', 'B'] })
  ];
  for (const state of endings) {
    const endingId = resolveEnding(state);
    const items = buildDebrief(state, endingId);
    assert.ok(items.length >= 3, endingId);
    for (const item of items) {
      assert.ok(item.factId);
      assert.ok(item.surfaceClaim);
      assert.ok(item.actualEffect);
      assert.ok(item.verificationEntryIds.length > 0);
    }
  }
});

test('an ignored available mission is recorded as an omission when it affects the ending', () => {
  const state = room({ aFacts: ['a1Skipped', 'aRequestedSoloRoute'], bFacts: ['bPausedLocalMirror'] });
  state.privateMissions = { A: [{ id: 'mission.a1.index_repair', state: 'available', outcome: null }], B: [] };
  commit(state, 'A');
  commit(state, 'B');
  assert.equal(state.ending.id, 'a_solo_escape');
  assert.ok(state.debrief.some(item => item.factId === 'a1Skipped'));
});

test('final ending and debrief are immutable after the second commit', () => {
  const state = room({ publicFacts: ['verifiedAuditForgery', 'bFlaggedIdentity', 'comparedIncidentTimes'], aFacts: ['aPublishedFragment'], bFacts: ['bDisclosedReport'] });
  state.sideEvidence = ['side1', 'side2', 'side3', 'side4'];
  commit(state, 'A');
  commit(state, 'B');
  assert.ok(Object.isFrozen(state.ending));
  assert.ok(Object.isFrozen(state.debrief));
  state.ending.id = 'tampered';
  assert.equal(state.ending.id, 'exposed_ai_deception');
});
