const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { initializeGame, submitAction, submitOperation, submitTerminalCommand } = require('../../game/gameEngine');
const { refreshWorkstation } = require('../../game/terminalEngine');
const {
  ensureDialogueState,
  recordNarrativeBehavior,
  triggerDialogue
} = require('../../game/privateEventEngine');

function roomWithPlayers(createdAt = 0) {
  const room = createRoomState('ROOM42', createdAt);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  room.chapter = 2;
  refreshWorkstation(room);
  ensureDialogueState(room);
  return room;
}

test('recordNarrativeBehavior counts repeated file opens and updates only meaningful actor activity', () => {
  const room = roomWithPlayers(1_000);
  recordNarrativeBehavior(room, 'A', { entryOpened: 'archive.protocol_versions', meaningful: true }, 2_000);
  recordNarrativeBehavior(room, 'A', { entryOpened: 'archive.protocol_versions', meaningful: true }, 3_000);
  recordNarrativeBehavior(room, 'A', { entryOpened: 'archive.protocol_versions', meaningful: false }, 4_000);

  assert.equal(room.narrativeBehavior.entryOpenCount.A['archive.protocol_versions'], 3);
  assert.equal(room.narrativeBehavior.lastMeaningfulActionAt.A, 3_000);
  assert.equal(room.narrativeBehavior.lastMeaningfulActionAt.B, 1_000);
});

test('third protocol revision read produces one actor-private ECHO recheck observation', () => {
  const room = roomWithPlayers(0);
  const events = [];
  for (let count = 1; count <= 4; count += 1) {
    triggerDialogue(room, {
      role: 'A',
      operationId: 'open_entry',
      entryOpened: 'archive.protocol_versions',
      meaningful: true,
      now: count * 1_000
    }, events);
  }

  assert.equal(room.narrativeBehavior.entryOpenCount.A['archive.protocol_versions'], 4);
  const rechecks = events.filter(event => event.contentId === 'echo.behavior.recheck.a');
  assert.equal(rechecks.length, 1);
  assert.deepEqual(rechecks[0].audience, { kind: 'role', role: 'host' });
  assert.match(rechecks[0].text, /第三次|確認/);
  assert.ok(room.narrativeBehavior.reactionFactIds.A.includes('echo.behavior.recheck.a'));
  assert.equal(room.narrativeBehavior.reactionFactIds.B.length, 0);
});

test('submitOperation observes repeated open_entry attempts even when file state is already open', () => {
  const room = roomWithPlayers(0);
  const player = { role: 'A', playerId: 'player-a' };
  const allEvents = [];

  const first = submitOperation(room, player, {
    actionId: 'open-protocol-1', operationId: 'open_entry', value: 'archive.protocol_versions'
  }, allEvents);
  const second = submitOperation(room, player, {
    actionId: 'open-protocol-2', operationId: 'open_entry', value: 'archive.protocol_versions'
  }, allEvents);
  const third = submitOperation(room, player, {
    actionId: 'open-protocol-3', operationId: 'open_entry', value: 'archive.protocol_versions'
  }, allEvents);

  assert.equal(first.stateChanged, true);
  assert.equal(second.stateChanged, true, 'hidden narrative count is still authoritative state');
  assert.equal(third.stateChanged, true);
  assert.equal(room.narrativeBehavior.entryOpenCount.A['archive.protocol_versions'], 3);
  assert.equal(allEvents.filter(event => event.contentId === 'echo.behavior.recheck.a').length, 1);
});

test('accepted puzzle, operation, and terminal actions advance the actor meaningful-action clock', () => {
  const puzzleRoom = createRoomState('PUZZLE', 0);
  puzzleRoom.players.A = { playerId: 'player-a' };
  puzzleRoom.players.B = { playerId: 'player-b' };
  initializeGame(puzzleRoom);
  puzzleRoom.workstation.A.openedEntryIds.push('answer.main1');
  submitAction(puzzleRoom, { role: 'A', playerId: 'player-a' }, {
    actionId: 'wrong-answer', puzzleId: 'main1', stepId: 'identity', value: 'wrong'
  });
  assert.ok(puzzleRoom.narrativeBehavior.lastMeaningfulActionAt.A > 0);

  const operationRoom = roomWithPlayers(0);
  submitOperation(operationRoom, { role: 'A', playerId: 'player-a' }, {
    actionId: 'continue-index', operationId: 'continue_file_index'
  });
  assert.ok(operationRoom.narrativeBehavior.lastMeaningfulActionAt.A > 0);

  const terminalRoom = roomWithPlayers(0);
  submitTerminalCommand(terminalRoom, { role: 'A', playerId: 'player-a' }, {
    actionId: 'help-command', operationId: 'terminal_command', value: 'HELP'
  });
  assert.ok(terminalRoom.narrativeBehavior.lastMeaningfulActionAt.A > 0);
});

test('route choices produce restrained one-shot ECHO observations', () => {
  const cooperate = roomWithPlayers(0);
  cooperate.workstation.B.openedEntryIds.push('files.experiment_roster');
  cooperate.directDialogueState.B.rapportCount = 2;
  cooperate.directDialogueState.B.rapportSincePressure = 1;
  const cooperativeEvents = [];
  submitOperation(cooperate, { role: 'B', playerId: 'player-b' }, {
    actionId: 'share-roster-choice', operationId: 'share_roster'
  }, cooperativeEvents);
  assert.ok(cooperativeEvents.some(event => event.contentId === 'echo.behavior.cooperate.b'));
  assert.ok(cooperativeEvents.filter(event => event.contentId === 'echo.behavior.cooperate.b').every(event => event.audience.role === 'guest'));

  const resist = roomWithPlayers(0);
  resist.publicFacts.push('main2Completed', 'main3Completed', 'main4Completed', 'main5Completed');
  resist.chapter = 6;
  resist.workstation.A.openedEntryIds.push('doc.a_solo_protocol');
  resist.directDialogueState.A.rapportCount = 2;
  resist.directDialogueState.A.rapportSincePressure = 0;
  resist.directDialogueState.A.lastIntent = 'private_task';
  refreshWorkstation(resist);
  const resistEvents = [];
  submitOperation(resist, { role: 'A', playerId: 'player-a' }, {
    actionId: 'pair-route-choice', operationId: 'request_pair_validation'
  }, resistEvents);
  assert.ok(resistEvents.some(event => event.contentId === 'echo.behavior.resist.a'));
});
