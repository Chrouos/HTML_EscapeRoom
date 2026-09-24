const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { initializeGame, submitAction, submitOperation, submitTerminalCommand } = require('../../game/gameEngine');
const { refreshWorkstation } = require('../../game/terminalEngine');
const {
  triggerDialogue,
  ensureDialogueState,
  ensureNarrativeBehavior
} = require('../../game/privateEventEngine');

function readyRoom() {
  const room = createRoomState('ROOM-RX', 1000);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  room.workstation = {
    A: { openedEntryIds: [], roleFacts: [], actionAttempts: [] },
    B: { openedEntryIds: [], roleFacts: [], actionAttempts: [] }
  };
  ensureDialogueState(room);
  ensureNarrativeBehavior(room, 1000);
  return room;
}

function puzzleRoom() {
  const room = createRoomState('ROOM-PZ', 1000);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.workstation = {
    A: { openedEntryIds: ['answer.main1'], roleFacts: [], actionAttempts: [] },
    B: { openedEntryIds: ['answer.main1'], roleFacts: [], actionAttempts: [] }
  };
  initializeGame(room, []);
  ensureNarrativeBehavior(room, 1000);
  room.narrativeBehavior.lastMeaningfulActionAt.A = 1000;
  return room;
}

test('third protocol archive open is observed once by ECHO for that actor', () => {
  const room = readyRoom();
  const events = [];

  for (let index = 0; index < 3; index += 1) {
    triggerDialogue(room, {
      role: 'A',
      operationId: 'open_entry',
      entryOpened: 'archive.protocol_versions',
      meaningful: true,
      now: 2000 + index
    }, events);
  }

  assert.equal(room.narrativeBehavior.entryOpenCount.A['archive.protocol_versions'], 3);
  const observations = events.filter(event => event.contentId === 'echo.behavior.protocol_recheck');
  assert.equal(observations.length, 1);
  assert.deepEqual(observations[0].audience, { kind: 'role', role: 'host' });
  assert.match(observations[0].text, /第三次|反覆|重新確認|又看/i);
  assert.ok(room.narrativeBehavior.reactionFactIds.A.includes('echo.behavior.protocol_recheck'));

  triggerDialogue(room, {
    role: 'A',
    operationId: 'open_entry',
    entryOpened: 'archive.protocol_versions',
    meaningful: true,
    now: 3000
  }, events);

  assert.equal(room.narrativeBehavior.entryOpenCount.A['archive.protocol_versions'], 4);
  assert.equal(events.filter(event => event.contentId === 'echo.behavior.protocol_recheck').length, 1);
  assert.equal(room.narrativeBehavior.entryOpenCount.B['archive.protocol_versions'] || 0, 0);
  assert.equal(room.directDialogueState.B.deliveredContentIds.includes('echo.behavior.protocol_recheck'), false);
});

test('meaningful narrative triggers advance only the acting role idle clock', () => {
  const room = readyRoom();
  const beforeB = room.narrativeBehavior.lastMeaningfulActionAt.B;

  triggerDialogue(room, {
    role: 'A',
    operationId: 'verify_incident_timestamp',
    meaningful: true,
    now: 9000
  }, []);

  assert.equal(room.narrativeBehavior.lastMeaningfulActionAt.A, 9000);
  assert.equal(room.narrativeBehavior.lastMeaningfulActionAt.B, beforeB);
});

test('game engine preserves repeated open attempts for narrative observation', () => {
  const room = readyRoom();
  refreshWorkstation(room);
  const player = { role: 'A', playerId: 'player-a' };

  for (let index = 1; index <= 3; index += 1) {
    submitOperation(room, player, {
      actionId: `reopen-${index}`,
      operationId: 'open_entry',
      value: 'archive.protocol_versions'
    }, []);
  }

  assert.equal(room.narrativeBehavior.entryOpenCount.A['archive.protocol_versions'], 3);
  assert.ok(room.directDialogueState.A.deliveredContentIds.includes('echo.behavior.protocol_recheck'));
});

test('normal workstation operations reset the actor narrative idle clock', () => {
  const room = readyRoom();
  refreshWorkstation(room);
  room.narrativeBehavior.lastMeaningfulActionAt.A = 1000;

  submitOperation(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'continue-index', operationId: 'continue_file_index'
  }, []);

  assert.ok(room.narrativeBehavior.lastMeaningfulActionAt.A > 1000);
});

test('terminal commands reset the actor narrative idle clock', () => {
  const room = readyRoom();
  refreshWorkstation(room);
  room.narrativeBehavior.lastMeaningfulActionAt.A = 1000;

  submitTerminalCommand(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'terminal-help', operationId: 'terminal_command', value: 'HELP'
  }, []);

  assert.ok(room.narrativeBehavior.lastMeaningfulActionAt.A > 1000);
});

test('puzzle submissions reset the actor narrative idle clock even when the answer is wrong', () => {
  const room = puzzleRoom();

  submitAction(room, { role: 'A', playerId: 'player-a' }, {
    actionId: 'wrong-identity', puzzleId: 'main1', stepId: 'identity', value: 'wrong'
  }, []);

  assert.ok(room.narrativeBehavior.lastMeaningfulActionAt.A > 1000);
});
