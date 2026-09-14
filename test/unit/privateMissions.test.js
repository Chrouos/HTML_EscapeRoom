const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { ensureRoom, refreshWorkstation, openEntry } = require('../../game/terminalEngine');
const {
  ensurePrivateMissions,
  refreshPrivateMissions,
  resolvePrivateMission,
  missionForOperation
} = require('../../game/privateEventEngine');
const { submitOperation } = require('../../game/gameEngine');

function roomWithPlayers() {
  const room = createRoomState('ROOM01', Date.now());
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.chapter = 1;
  ensureRoom(room);
  room.directDialogueState = {
    A: { rapportCount: 0, rapportSincePressure: 0, lastIntent: null, deliveredContentIds: [] },
    B: { rapportCount: 0, rapportSincePressure: 0, lastIntent: null, deliveredContentIds: [] }
  };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  room.directDialogueState.A.rapportCount = 2;
  room.directDialogueState.B.rapportCount = 2;
  refreshWorkstation(room);
  return room;
}

test('all six missions start locked and transition to available from their distinct triggers', () => {
  const room = roomWithPlayers();
  ensurePrivateMissions(room);
  assert.deepEqual(Object.fromEntries(['A', 'B'].map(role => [role,
    room.privateMissions[role].map(mission => mission.state)])), {
    A: ['locked', 'locked', 'locked'], B: ['locked', 'locked', 'locked']
  });

  openEntry(room, { role: 'A', playerId: 'player-a' }, 'files.mainline');
  openEntry(room, { role: 'B', playerId: 'player-b' }, 'files.experiment_roster');
  refreshPrivateMissions(room);
  assert.equal(room.privateMissions.A.find(item => item.id === 'mission.a1.index_repair').state, 'available');
  assert.equal(room.privateMissions.B.find(item => item.id === 'mission.b1.identity_check').state, 'available');

  room.publicFacts.push('incidentVerificationAttempted', 'accessLogOpened');
  room.actionAttempts.push('verify_incident_timestamp');
  refreshPrivateMissions(room);
  assert.equal(room.privateMissions.A.find(item => item.id === 'mission.a2.cleanup_mirror').state, 'available');
  assert.equal(room.privateMissions.B.find(item => item.id === 'mission.b2.limit_archive').state, 'available');

  room.publicFacts.push('main5Completed');
  openEntry(room, { role: 'A', playerId: 'player-a' }, 'doc.a_solo_protocol');
  openEntry(room, { role: 'B', playerId: 'player-b' }, 'log.b_partner_unknown_access');
  refreshPrivateMissions(room);
  assert.equal(room.privateMissions.A.find(item => item.id === 'mission.a3.solo_validation').state, 'available');
  assert.equal(room.privateMissions.B.find(item => item.id === 'mission.b3.behavior_report').state, 'available');
});

test('private operation resolves its mission once and repeated actionId is idempotent', () => {
  const room = roomWithPlayers();
  openEntry(room, { role: 'A', playerId: 'player-a' }, 'files.mainline');
  refreshPrivateMissions(room);
  const first = submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'a1-archive', operationId: 'archive_index'
  });
  assert.equal(first.stateChanged, true);
  assert.equal(room.privateMissions.A.find(item => item.id === 'mission.a1.index_repair').state, 'resolved');
  assert.equal(room.privateMissions.A.find(item => item.id === 'mission.a1.index_repair').outcome, 'completed');
  const second = submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'a1-archive', operationId: 'archive_index'
  });
  assert.equal(second.stateChanged, false);
  assert.equal(room.workstation.A.roleFacts.filter(fact => fact === 'aArchivedIndex').length, 1);
  assert.throws(() => submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'a1-skip-after', operationId: 'skip_a1'
  }), /resolved|locked/i);
});

test('declined, skipped and failed outcomes are explicit and idempotent', () => {
  const room = roomWithPlayers();
  openEntry(room, { role: 'A', playerId: 'player-a' }, 'files.mainline');
  openEntry(room, { role: 'B', playerId: 'player-b' }, 'files.experiment_roster');
  refreshPrivateMissions(room);
  submitOperation(room, { role: 'A', playerId: 'player-a' }, { actionId: 'decline', operationId: 'decline_index_repair' });
  submitOperation(room, { role: 'B', playerId: 'player-b' }, { actionId: 'skip', operationId: 'skip_b1' });
  assert.equal(room.privateMissions.A.find(item => item.id === 'mission.a1.index_repair').outcome, 'declined');
  assert.equal(room.privateMissions.B.find(item => item.id === 'mission.b1.identity_check').outcome, 'skipped');

  room.publicFacts.push('incidentVerificationAttempted');
  room.actionAttempts.push('verify_incident_timestamp');
  refreshPrivateMissions(room);
  const failed = submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'failed-a2', operationId: 'delete_local_mirror', value: 'failed'
  });
  assert.equal(failed.publicResult.outcome, 'failed');
  assert.equal(room.privateMissions.A.find(item => item.id === 'mission.a2.cleanup_mirror').outcome, 'failed');
  const retry = submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'failed-a2', operationId: 'delete_local_mirror', value: 'failed'
  });
  assert.equal(retry.stateChanged, false);
});

test('B-2 operation is local to B and finale commit skips unresolved available missions for that role', () => {
  const room = roomWithPlayers();
  room.publicFacts.push('accessLogOpened', 'main5Completed', 'finale_ready');
  refreshPrivateMissions(room);
  const beforeA = {
    roleFacts: [...room.workstation.A.roleFacts],
    openedEntryIds: [...room.workstation.A.openedEntryIds],
    actionAttempts: [...room.workstation.A.actionAttempts],
    completedOperations: [...room.workstation.A.completedOperations]
  };
  const b2 = submitOperation(room, { role: 'B', playerId: 'player-b' }, {
    actionId: 'b2-pause', operationId: 'pause_local_mirror'
  });
  assert.equal(b2.stateChanged, true);
  assert.deepEqual({
    roleFacts: room.workstation.A.roleFacts,
    openedEntryIds: room.workstation.A.openedEntryIds,
    actionAttempts: room.workstation.A.actionAttempts,
    completedOperations: room.workstation.A.completedOperations
  }, beforeA);
  assert.ok(room.workstation.B.roleFacts.includes('bPausedLocalMirror'));

  const commit = submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'finale-a', operationId: 'commit_finale'
  });
  assert.equal(commit.stateChanged, true);
  for (const mission of room.privateMissions.A) {
    if (mission.state === 'available') assert.equal(mission.outcome, 'skipped');
  }
});

test('every private operation maps to exactly one mission', () => {
  for (const operationId of [
    'archive_index', 'decline_index_repair', 'skip_a1', 'flag_identity', 'share_roster',
    'decline_identity_check', 'skip_b1', 'delete_local_mirror', 'share_mirror_first',
    'decline_mirror_cleanup', 'skip_a2', 'pause_local_mirror', 'keep_local_mirror',
    'warn_partner_first', 'skip_b2', 'request_solo_validation', 'publish_fragment',
    'request_pair_validation', 'skip_a3', 'file_full_report', 'file_anonymous_summary',
    'disclose_report', 'skip_b3'
  ]) assert.ok(missionForOperation(operationId), operationId);
});
