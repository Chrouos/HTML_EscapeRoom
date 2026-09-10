const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { initializeGame, submitAction } = require('../../game/gameEngine');

function readyRoom(overrides = {}) {
  const room = createRoomState('123456', Date.now());
  room.players.A = { token: 'a-token', playerId: 'player-a' };
  room.players.B = { token: 'b-token', playerId: 'player-b' };
  Object.assign(room, overrides);
  return room;
}

function action(stepId, value, actionId = `${stepId}-action`) {
  return { actionId, puzzleId: 'main1', stepId, value };
}

test('initializeGame waits for both players and emits strict, idempotent story events', () => {
  const waitingRoom = createRoomState('111111', Date.now());
  initializeGame(waitingRoom);
  assert.equal(waitingRoom.privateClues, undefined);
  assert.deepEqual(waitingRoom.messages, []);

  const room = readyRoom();
  const events = [];
  initializeGame(room, events);
  const firstEvents = structuredClone(events);
  const firstClues = structuredClone(room.privateClues);
  initializeGame(room, events);

  assert.deepEqual(events, firstEvents);
  assert.deepEqual(room.messages, []);
  assert.deepEqual(room.privateClues, firstClues);
  assert.deepEqual(room.publicProgress, {
    chapter: 1,
    mainProgress: [],
    puzzleId: 'main1',
    stepId: 'identity',
    title: '設施初始化｜身份核對',
    prompt: '請交換兩人的身份片段，組合完整的實驗識別碼。',
    hints: []
  });
  assert.notDeepEqual(room.privateClues.A, room.privateClues.B);
  assert.match(room.privateClues.A.text, /ORPHEUS/);
  assert.match(room.privateClues.B.text, /17/);
  for (const event of events) {
    assert.deepEqual(event.audience, { kind: 'both' });
  }
});

test('initializeGame preserves injected clues and does not re-emit existing story content', () => {
  const room = readyRoom({
    privateClues: { A: { title: '測試 A', text: '既有線索 A' }, B: { title: '測試 B', text: '既有線索 B' } },
    messages: [{ id: 'injected', contentId: 'main1-boot', type: 'story', text: '測試訊息',
      audience: { kind: 'both' } }]
  });

  const events = [];
  initializeGame(room, events);

  assert.deepEqual(room.privateClues, {
    A: { title: '測試 A', text: '既有線索 A' },
    B: { title: '測試 B', text: '既有線索 B' }
  });
  assert.equal(room.messages[0].id, 'injected');
  assert.equal(events.some(event => event.id === 'main1-boot'), false);
  assert.equal(events.some(event => event.id === 'main1-briefing'), true);
});

test('submitAction rejects a locked puzzle with a 423 domain error', () => {
  const room = readyRoom();
  initializeGame(room);

  assert.throws(
    () => submitAction(room, { role: 'A' }, action('startup', 'AUX CORE EMERGENCY', 'locked-startup')),
    error => error.status === 423 && error.code === 'PUZZLE_LOCKED'
  );
  assert.throws(
    () => submitAction(room, { role: 'A' }, { ...action('identity', 'ORPHEUS-17'), puzzleId: 'main2' }),
    error => error.status === 423 && error.code === 'PUZZLE_LOCKED'
  );
  assert.deepEqual(room.attempts, { main1: { identity: 0, startup: 0 } });
});

test('submitAction rejects malformed action fields with a 400 domain error', () => {
  const room = readyRoom();
  initializeGame(room);
  const invalidActions = [
    { actionId: '', puzzleId: 'main1', stepId: 'identity', value: 'x' },
    { actionId: 'id', puzzleId: '', stepId: 'identity', value: 'x' },
    { actionId: 'id', puzzleId: 'main1', stepId: '', value: 'x' },
    { actionId: 'id', puzzleId: 'main1', stepId: 'identity', value: 'x'.repeat(1001) },
    { actionId: 'id', puzzleId: 'main1', stepId: 'identity', value: 17 }
  ];

  for (const invalidAction of invalidActions) {
    assert.throws(
      () => submitAction(room, { role: 'A' }, invalidAction),
      error => error.status === 400 && error.code === 'INVALID_ACTION'
    );
  }
});

test('identity accepts harmless whitespace and case differences, then unlocks startup', () => {
  const room = readyRoom();
  const events = [];
  initializeGame(room, events);

  const result = submitAction(room, { role: 'A' }, action('identity', '  orpheus-17  ', 'identity-1'), events);

  assert.equal(result.stateChanged, true);
  assert.equal(result.publicResult.correct, true);
  assert.equal(result.publicResult.nextStep, 'startup');
  assert.equal(room.publicProgress.stepId, 'startup');
  assert.deepEqual(room.mainProgress, []);
  assert.equal(room.attempts.main1.identity, 0);
  assert.ok(result.events.length > 0);
  assert.ok(events.some(event => event.id === 'main1-identity-complete'));
  assert.ok(events.every(event => event.audience && typeof event.audience === 'object'));
});

test('wrong answers increment only the current step and reveal graduated hints', () => {
  const room = readyRoom();
  initializeGame(room);

  const first = submitAction(room, { role: 'A' }, action('identity', 'wrong', 'wrong-1'));
  const second = submitAction(room, { role: 'B' }, action('identity', 'still-wrong', 'wrong-2'));

  assert.equal(first.stateChanged, true);
  assert.equal(first.publicResult.correct, false);
  assert.equal(first.publicResult.attempt, 1);
  assert.deepEqual(first.publicResult.hints, []);
  assert.equal(second.publicResult.attempt, 2);
  assert.equal(second.publicResult.hints.length, 1);
  assert.match(second.publicResult.hints[0], /AUX|識別碼/);
  assert.equal(room.attempts.main1.identity, 2);
  assert.equal(room.attempts.main1.startup, 0);
  assert.equal(room.publicProgress.stepId, 'identity');
});

test('completed steps and completed main1 submissions are no-ops', () => {
  const room = readyRoom();
  initializeGame(room);
  submitAction(room, { role: 'A' }, action('identity', 'ORPHEUS-17', 'identity-1'));
  const beforeStartup = structuredClone(room);

  const repeatedIdentity = submitAction(room, { role: 'B' }, action('identity', 'ORPHEUS-17', 'identity-2'));
  assert.equal(repeatedIdentity.stateChanged, false);
  assert.deepEqual(room.attempts, beforeStartup.attempts);
  assert.deepEqual(room.messages, beforeStartup.messages);

  const completed = submitAction(room, { role: 'B' }, action('startup', ' aux   core emergency ', 'startup-1'));
  assert.equal(completed.stateChanged, true);
  assert.equal(completed.publicResult.correct, true);
  assert.deepEqual(room.mainProgress, ['main1']);
  assert.equal(room.chapter, 2);
  const afterCompletion = structuredClone(room);

  const repeatedCompletion = submitAction(room, { role: 'A' }, action('startup', 'AUX CORE EMERGENCY', 'startup-2'));
  assert.equal(repeatedCompletion.stateChanged, false);
  assert.deepEqual(room.mainProgress, afterCompletion.mainProgress);
  assert.deepEqual(room.messages, afterCompletion.messages);
});

test('submitAction requires a valid player role and both players joined', () => {
  const waitingRoom = createRoomState('222222', Date.now());
  waitingRoom.players.A = { token: 'a-token' };
  assert.throws(
    () => submitAction(waitingRoom, { role: 'A' }, action('identity', 'ORPHEUS-17')),
    error => error.status === 423 && error.code === 'ROOM_NOT_READY'
  );

  const room = readyRoom();
  initializeGame(room);
  assert.throws(
    () => submitAction(room, { role: 'C' }, action('identity', 'ORPHEUS-17')),
    error => error.status === 400 && error.code === 'INVALID_PLAYER'
  );
});
