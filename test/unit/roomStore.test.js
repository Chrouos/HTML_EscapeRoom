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
    'streams',
    'chapter',
    'mainProgress',
    'sideEvidence',
    'attempts',
    'hints',
    'messages',
    'pendingChoices',
    'narrativeBehavior',
    'countdownStartedAt',
    'ending',
    'processedActionIds',
    'revision'
  ]);
  assert.equal(state.roomCode, '123456');
  assert.equal(state.createdAt, 1000);
  assert.deepEqual(state.players, { A: null, B: null });
  assert.deepEqual(state.streams, {
    A: { cursor: 0, acknowledgedCursor: 0, events: [] },
    B: { cursor: 0, acknowledgedCursor: 0, events: [] }
  });
  assert.equal(state.chapter, 1);
  assert.deepEqual(state.mainProgress, []);
  assert.deepEqual(state.sideEvidence, []);
  assert.deepEqual(state.attempts, {});
  assert.deepEqual(state.hints, {});
  assert.deepEqual(state.messages, []);
  assert.deepEqual(state.pendingChoices, {});
  assert.deepEqual(state.narrativeBehavior, {
    entryOpenCount: { A: {}, B: {} },
    lastMeaningfulActionAt: { A: 1000, B: 1000 },
    pendingObservation: { A: null, B: null },
    sharedEvidenceIds: { A: [], B: [] },
    ignoredPromptIds: { A: [], B: [] },
    reactionFactIds: { A: [], B: [] },
    lastReactionAt: { A: {}, B: {} }
  });
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
