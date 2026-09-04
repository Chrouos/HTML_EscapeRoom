const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomStore } = require('../../game/roomStore');
const { createRoomState } = require('../../game/createRoomState');

test('creates the exact initial room state shape', () => {
  const state = createRoomState('123456', 1000);

  assert.deepEqual(Object.keys(state), [
    'roomCode',
    'createdAt',
    'players',
    'chapter',
    'mainProgress',
    'sideEvidence',
    'attempts',
    'hints',
    'messages',
    'pendingChoices',
    'countdownStartedAt',
    'ending',
    'processedActionIds',
    'revision'
  ]);
  assert.equal(state.roomCode, '123456');
  assert.equal(state.createdAt, 1000);
  assert.deepEqual(state.players, { A: null, B: null });
  assert.equal(state.chapter, 1);
  assert.deepEqual(state.mainProgress, []);
  assert.deepEqual(state.sideEvidence, []);
  assert.deepEqual(state.attempts, {});
  assert.deepEqual(state.hints, {});
  assert.deepEqual(state.messages, []);
  assert.deepEqual(state.pendingChoices, {});
  assert.equal(state.countdownStartedAt, null);
  assert.equal(state.ending, null);
  assert.ok(state.processedActionIds instanceof Set);
  assert.equal(state.revision, 0);
});

test('creates rooms with unique six-digit room codes', () => {
  const roomCodes = ['012345', '678901'];
  const tokens = ['token-a-1', 'token-a-2'];
  const store = createRoomStore({
    generateRoomCode: () => roomCodes.shift(),
    generateToken: () => tokens.shift()
  });

  const first = store.createRoom();
  const second = store.createRoom();

  assert.match(first.room.roomCode, /^\d{6}$/);
  assert.match(second.room.roomCode, /^\d{6}$/);
  assert.notEqual(first.room.roomCode, second.room.roomCode);
});

test('retries a colliding room code before storing a new room', () => {
  const roomCodes = ['123456', '123456', '654321'];
  const tokens = ['token-a-1', 'token-a-2'];
  const store = createRoomStore({
    generateRoomCode: () => roomCodes.shift(),
    generateToken: () => tokens.shift()
  });

  store.createRoom();
  const second = store.createRoom();

  assert.equal(second.room.roomCode, '654321');
});

test('retries a colliding join token before assigning it', () => {
  const roomCodes = ['111111', '222222'];
  const tokens = ['same-token', 'same-token', 'unique-token'];
  const store = createRoomStore({
    generateRoomCode: () => roomCodes.shift(),
    generateToken: () => tokens.shift()
  });

  const first = store.createRoom();
  const second = store.createRoom();

  assert.equal(first.player.token, 'same-token');
  assert.equal(second.player.token, 'unique-token');
});

test('assigns the second player to B and rejects a third player as ROOM_FULL', () => {
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: (() => {
      const tokens = ['token-a', 'token-b'];
      return () => tokens.shift();
    })(),
    now: () => 1000
  });

  const created = store.createRoom();
  const joined = store.joinRoom(created.room.roomCode);

  assert.equal(joined.player.role, 'B');
  assert.equal(joined.player.token, 'token-b');
  assert.equal(joined.room.players.B.token, 'token-b');
  assert.notEqual(joined.player.token, created.player.token);
  assert.throws(
    () => store.joinRoom(created.room.roomCode),
    error => error.code === 'ROOM_FULL'
  );
});

test('resolves the role from the join token and ignores a client role claim', () => {
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: (() => {
      const tokens = ['token-a', 'token-b'];
      return () => tokens.shift();
    })(),
    now: () => 1000
  });
  const created = store.createRoom();
  store.joinRoom(created.room.roomCode);

  assert.equal(
    store.resolvePlayer(created.room.roomCode, created.player.token, 'B').role,
    'A'
  );
  assert.equal(
    store.resolvePlayer(created.room.roomCode, 'token-b', 'A').role,
    'B'
  );
  assert.throws(
    () => store.resolvePlayer(created.room.roomCode, 'not-a-token'),
    error => error.code === 'INVALID_TOKEN'
  );
});

test('returns the same room state for repeated reads and token resolution', () => {
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: () => 'token-a',
    now: () => 1000
  });
  const created = store.createRoom();

  assert.deepEqual(store.getRoom(created.room.roomCode), created.room);
  assert.deepEqual(
    store.resolvePlayer(created.room.roomCode, created.player.token).room,
    created.room
  );
});

test('starts the countdown only after the second player joins', () => {
  const times = [1000, 2000];
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: (() => {
      const tokens = ['token-a', 'token-b'];
      return () => tokens.shift();
    })(),
    now: () => times.shift()
  });

  const created = store.createRoom();
  assert.equal(created.room.countdownStartedAt, null);

  const joined = store.joinRoom(created.room.roomCode);
  assert.equal(joined.room.countdownStartedAt, 2000);
});

test('derives a 45-minute running countdown and emergency status at zero', () => {
  let currentTime = 0;
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: (() => {
      const tokens = ['token-a', 'token-b'];
      return () => tokens.shift();
    })(),
    now: () => currentTime
  });
  const created = store.createRoom();
  currentTime = 1000;
  store.joinRoom(created.room.roomCode);

  const running = store.getRoom(created.room.roomCode);
  assert.equal(running.countdownStatus, 'running');
  assert.equal(running.countdownRemainingMs, 45 * 60 * 1000);

  currentTime += 45 * 60 * 1000;
  const emergency = store.getRoom(created.room.roomCode);
  assert.equal(emergency.countdownStatus, 'emergency');
  assert.equal(emergency.countdownRemainingMs, 0);
});

test('updates a room through the store and increments revision once', () => {
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: () => 'token-a',
    now: () => 1000
  });
  const created = store.createRoom();

  const updated = store.updateRoom(
    created.room.roomCode,
    room => room.mainProgress.push('main-1'),
    { actionId: 'action-1' }
  );

  assert.equal(updated.revision, 1);
  assert.deepEqual(updated.mainProgress, ['main-1']);
  assert.equal(store.hasProcessedAction(created.room.roomCode, 'action-1'), true);
});

test('does not call a duplicate action updater or increment revision', () => {
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: () => 'token-a',
    now: () => 1000
  });
  const created = store.createRoom();
  let calls = 0;

  store.updateRoom(
    created.room.roomCode,
    room => {
      calls += 1;
      room.mainProgress.push('main-1');
    },
    { actionId: 'action-1' }
  );
  const duplicate = store.updateRoom(
    created.room.roomCode,
    () => {
      calls += 1;
    },
    { actionId: 'action-1' }
  );

  assert.equal(calls, 1);
  assert.equal(duplicate.revision, 1);
  assert.deepEqual(duplicate.mainProgress, ['main-1']);
});

test('distinguishes an expired room from a room that never existed', () => {
  let currentTime = 0;
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: () => 'token-a',
    now: () => currentTime,
    roomTtlMs: 100
  });
  store.createRoom();

  currentTime = 99;
  assert.equal(store.getRoom('123456').roomCode, '123456');
  currentTime = 100;
  assert.throws(
    () => store.getRoom('123456'),
    error => error.code === 'ROOM_EXPIRED'
  );
  assert.throws(
    () => store.getRoom('999999'),
    error => error.code === 'ROOM_NOT_FOUND'
  );
});

test('keeps progress and allows ending updates after countdown reaches zero', () => {
  let currentTime = 0;
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: (() => {
      const tokens = ['token-a', 'token-b'];
      return () => tokens.shift();
    })(),
    now: () => currentTime
  });
  const created = store.createRoom();
  store.joinRoom(created.room.roomCode);
  currentTime = 45 * 60 * 1000;

  const updated = store.updateRoom(created.room.roomCode, room => {
    room.mainProgress.push('complete');
    room.ending = 'resistance';
  });

  assert.equal(updated.countdownStatus, 'emergency');
  assert.deepEqual(updated.mainProgress, ['complete']);
  assert.equal(updated.ending, 'resistance');
});

test('does not commit a room mutation when the updater throws', () => {
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: () => 'token-a',
    now: () => 1000
  });
  const created = store.createRoom();

  assert.throws(() => store.updateRoom(
    created.room.roomCode,
    room => {
      room.mainProgress.push('not-committed');
      throw new Error('updater failed');
    },
    { actionId: 'failed-action' }
  ), /updater failed/);

  const unchanged = store.getRoom(created.room.roomCode);
  assert.equal(unchanged.revision, 0);
  assert.deepEqual(unchanged.mainProgress, []);
  assert.equal(store.hasProcessedAction(created.room.roomCode, 'failed-action'), false);
});

test('keeps revision monotonic across joining and later room updates', () => {
  const store = createRoomStore({
    generateRoomCode: () => '123456',
    generateToken: (() => {
      const tokens = ['token-a', 'token-b'];
      return () => tokens.shift();
    })(),
    now: () => 1000
  });
  const created = store.createRoom();
  const joined = store.joinRoom(created.room.roomCode);
  const updated = store.updateRoom(created.room.roomCode, room => {
    room.chapter = 2;
  });

  assert.equal(created.room.revision, 0);
  assert.equal(joined.room.revision, 1);
  assert.equal(updated.revision, 2);
});

test('retries a B token that collides with the creator token', () => {
  const tokens = ['same-token', 'same-token', 'b-token'];
  const store = createRoomStore({
    generateRoomCode: (() => {
      const codes = ['123456'];
      return () => codes.shift();
    })(),
    generateToken: () => tokens.shift(),
    now: () => 1000
  });
  const created = store.createRoom();

  const joined = store.joinRoom(created.room.roomCode);

  assert.equal(joined.player.token, 'b-token');
  assert.notEqual(joined.player.token, created.player.token);
});
