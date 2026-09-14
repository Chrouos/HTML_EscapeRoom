const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoomState } = require('../../game/createRoomState');
const { initializeGame, submitAction, submitOperation } = require('../../game/gameEngine');
const { forPlayer } = require('../../game/safeState');
const { operations } = require('../../game/content/operations');
const { privateMissions } = require('../../game/content/privateMissions');
const { traverseOperationGraph } = require('../../game/content/validateContent');

const main = [
  ['main1', [['identity', 'ORPHEUS-17'], ['startup', 'AUX CORE EMERGENCY']]],
  ['main2', [['decode', 'POWER'], ['route', 'AUX BATTERY CORE'], ['restore', 'POWER ON']]],
  ['main3', [['timeline', 'BETA ALPHA GAMMA'], ['record', '2038-04-17']]],
  ['main4', [['credential', 'LANTERN-042'], ['authorization', 'VERIFY']]],
  ['main5', [['fragments', '2 4 1 3'], ['recovery', 'AI EDITED RECORD'], ['proof', '2038-04-18']]],
  ['main6', [['protocol', 'MANUAL OVERRIDE']]]
];
const sides = [
  ['side1', [['timestamps', '2038-04-17'], ['proof', 'ASSEMBLED']]],
  ['side2', [['pattern', 'LUCID'], ['decode', 'DO NOT TRUST AI']]],
  ['side3', [['transcript', 'EXPECTED RESPONSE'], ['metadata', 'PLANNED']]],
  ['side4', [['identity', 'PAIR 17'], ['relationship', 'SELECTED TOGETHER']]]
];
let serial = 0;
function act(room, puzzleId, stepId, value, role = 'A') {
  return submitAction(room, { role }, { actionId: `test-${++serial}`, puzzleId, stepId, value });
}
function ensureFinaleReady(room) {
  if (room.publicFacts?.includes('mainCompleted')) return;
  submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: `complete-final-${++serial}`, operationId: 'complete_main6'
  });
}
function ready() {
  const room = createRoomState('123456', 0);
  room.players = {
    A: { token: 'A-token', playerId: 'player-a' },
    B: { token: 'B-token', playerId: 'player-b' }
  };
  initializeGame(room, []);
  return room;
}
function reachExit(room) {
  for (const [puzzleId, steps] of main) for (const [stepId, value] of steps) {
    assert.notDeepEqual(
      forPlayer(room, { role: 'A', playerId: 'player-a' }).clues,
      forPlayer(room, { role: 'B', playerId: 'player-b' }).clues
    );
    const result = act(room, puzzleId, stepId, value);
    assert.equal(result.publicResult.correct, true, `${puzzleId}/${stepId}`);
  }
  assert.equal(room.ending, null);
}

test('complete main path remains independent of optional evidence and neutral finale commits', () => {
  const room = ready();
  assert.throws(() => act(room, 'side1', 'inspect', ''), error => error.status === 423);
  reachExit(room);
  assert.deepEqual(room.sideEvidence, []);
  ensureFinaleReady(room);
  const beforeLegacy = structuredClone(room);
  assert.throws(() => act(room, 'main6', 'ending', 'TRUTH'), error => error.code === 'INVALID_ACTION');
  assert.deepEqual(room, beforeLegacy);
  submitOperation(room, { role: 'A', playerId: 'player-a' }, { actionId: 'final-a', operationId: 'commit_finale' });
  assert.equal(room.ending, null);
  submitOperation(room, { role: 'B', playerId: 'player-b' }, { actionId: 'final-b', operationId: 'commit_finale' });
  assert.equal(room.ending.id, 'ambiguous_containment');
  assert.equal(room.mainProgress.length, 6);
});

test('both actors can use the same action ID and the second commit emits the ending', () => {
  const room = ready();
  reachExit(room);
  ensureFinaleReady(room);
  const events = [];

  submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'same-ending', operationId: 'commit_finale'
  }, events);
  submitOperation(room, { role: 'B', playerId: 'player-b' }, {
    actionId: 'same-ending', operationId: 'commit_finale'
  }, events);

  const endingEvents = events.filter(event => event.id.startsWith('ending-'));
  assert.equal(endingEvents.length, 1);
  assert.equal(new Set(endingEvents.map(event => event.id)).size, 1);
  assert.deepEqual(endingEvents.map(event => event.type), ['story']);
  assert.equal(endingEvents[0].text, room.ending.text);
});

test('operation graph traverses each declared room root and reaches finale without private outcomes', () => {
  const roots = [
    ['roomCreated'],
    ['roomCreated', 'hostJoined'],
    ['roomCreated', 'hostJoined', 'guestJoined']
  ];
  for (const startFacts of roots) {
    const graph = traverseOperationGraph(operations, { startFacts, startNodes: startFacts });
    for (const root of startFacts) assert.ok(graph.nodes.has(root), `missing root ${root}`);
    for (const node of ['finale_ready', 'finaleCommitted.A', 'finaleCommitted.B', 'endingCommitted']) {
      assert.ok(graph.nodes.has(node), `missing ${node} from ${startFacts.join(',')}`);
    }
  }
  const graph = traverseOperationGraph(operations, { excludeKinds: ['private'] });
  for (const node of ['finale_ready', 'finaleCommitted.A', 'finaleCommitted.B', 'endingCommitted']) {
    assert.ok(graph.nodes.has(node), `missing ${node}`);
  }
  assert.ok(graph.reached.has('complete_main6'));
});

test('every mission outcome preserves shared reachability', () => {
  for (const mission of privateMissions) {
    for (const operationId of mission.operationIds) {
      const graph = traverseOperationGraph(operations.filter(operation =>
        operation.kind !== 'private' || operation.operationId === operationId));
      assert.ok(graph.nodes.has('finale_ready'), `outcome ${operationId} blocked mainline`);
      assert.ok(graph.nodes.has('endingCommitted'));
    }
    const failedGraph = traverseOperationGraph(operations, { excludeOperationIds: mission.operationIds });
    assert.ok(failedGraph.nodes.has('finale_ready'), `failed ${mission.id} blocked mainline`);
    assert.ok(failedGraph.nodes.has('endingCommitted'));
  }
});

test('the first neutral finale commit has no shared ending effect', () => {
  const room = ready();
  room.publicFacts.push('finale_ready');
  const first = submitOperation(room, { role: 'A', playerId: 'player-a' }, { actionId: 'neutral-a', operationId: 'commit_finale' });
  assert.equal(first.stateChanged, true);
  assert.ok(room.completedNodes.includes('finaleCommitted.A'));
  assert.ok(!room.completedNodes.includes('finaleCommitted.B'));
  assert.ok(!room.completedNodes.includes('endingCommitted'));
  assert.equal(room.ending, null);
  submitOperation(room, { role: 'B', playerId: 'player-b' }, { actionId: 'neutral-b', operationId: 'commit_finale' });
  assert.ok(room.completedNodes.includes('endingCommitted'));
  assert.equal(room.ending, null);
});

test('each private mission can lose all outcome edges without blocking the finale', () => {
  const missions = [
    ['archive_index', 'decline_index_repair', 'skip_a1'],
    ['flag_identity', 'share_roster', 'decline_identity_check', 'skip_b1'],
    ['delete_local_mirror', 'share_mirror_first', 'decline_mirror_cleanup', 'skip_a2'],
    ['pause_local_mirror', 'keep_local_mirror', 'warn_partner_first', 'skip_b2'],
    ['request_solo_validation', 'publish_fragment', 'request_pair_validation', 'skip_a3'],
    ['file_full_report', 'file_anonymous_summary', 'disclose_report', 'skip_b3']
  ];
  for (const operationIds of missions) {
    const graph = traverseOperationGraph(operations.filter(operation => !operationIds.includes(operation.operationId)));
    assert.ok(graph.nodes.has('finale_ready'), `private outcomes blocked finale: ${operationIds.join(',')}`);
    assert.ok(graph.nodes.has('endingCommitted'));
  }
});

for (const count of [2, 4]) {
  test(`${count} optional investigations remain recoverable before neutral finale`, () => {
    const room = ready();
    reachExit(room);
    for (const [puzzleId, steps] of sides.slice(0, count)) {
      assert.throws(() => act(room, puzzleId, steps[0][0], steps[0][1]), error => error.status === 423);
      act(room, puzzleId, 'inspect', '');
      for (const [stepId, value] of steps) {
        const wrongOption = { 'side1:proof': 'ORIGINAL', 'side3:metadata': 'LIVE', 'side4:identity': 'SINGLE 17' }[`${puzzleId}:${stepId}`];
        if (wrongOption) assert.equal(act(room, puzzleId, stepId, wrongOption).publicResult.correct, false);
        assert.equal(act(room, puzzleId, stepId, value, 'B').publicResult.correct, true);
      }
      assert.equal(act(room, puzzleId, steps[1][0], steps[1][1]).stateChanged, false);
    }
    assert.equal(room.sideEvidence.length, count);
    ensureFinaleReady(room);
    submitOperation(room, { role: 'A', playerId: 'player-a' }, { actionId: `neutral-a-${count}`, operationId: 'commit_finale' });
    assert.equal(room.ending, null);
    submitOperation(room, { role: 'B', playerId: 'player-b' }, { actionId: `neutral-b-${count}`, operationId: 'commit_finale' });
    assert.equal(room.ending.id, 'ambiguous_containment');
    assert.equal(room.mainProgress.length, 6);
    const state = JSON.stringify(forPlayer(room, { role: 'A', playerId: 'player-a' }));
    assert.doesNotMatch(state, /A-token|B-token|"answer"|"acceptedAnswers"/);
    assert.ok(room.messages.every(message => message.audience && typeof message.audience === 'object'));
  });
}
