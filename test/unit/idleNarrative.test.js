const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const {
  IDLE_THRESHOLD_MS,
  IDLE_COOLDOWN_MS,
  shouldTriggerIdleObservation,
  triggerIdleObservation
} = require('../../game/privateEventEngine');

function readyRoom() {
  const room = createRoomState('IDLE42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  room.narrativeBehavior.lastMeaningfulActionAt.A = 0;
  return room;
}

test('idle policy waits for main1 and threshold, then caps observations at two with cooldown', () => {
  assert.equal(IDLE_THRESHOLD_MS, 60_000);
  assert.equal(IDLE_COOLDOWN_MS, 120_000);

  const beforeMain1 = readyRoom();
  beforeMain1.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined'];
  assert.equal(shouldTriggerIdleObservation(beforeMain1, 'A', 600_000), false);

  const room = readyRoom();
  assert.equal(shouldTriggerIdleObservation(room, 'A', IDLE_THRESHOLD_MS - 1), false);
  assert.equal(shouldTriggerIdleObservation(room, 'A', IDLE_THRESHOLD_MS), true);

  const firstEvents = [];
  assert.equal(triggerIdleObservation(room, 'A', IDLE_THRESHOLD_MS, firstEvents), true);
  assert.equal(firstEvents.length, 1);
  assert.deepEqual(firstEvents[0].audience, { kind: 'role', role: 'host' });
  assert.match(firstEvents[0].text, /停了一段時間|沒有操作/);
  assert.equal(shouldTriggerIdleObservation(room, 'A', IDLE_THRESHOLD_MS + IDLE_COOLDOWN_MS - 1), false);
  assert.equal(shouldTriggerIdleObservation(room, 'A', IDLE_THRESHOLD_MS + IDLE_COOLDOWN_MS), true);

  const secondEvents = [];
  assert.equal(triggerIdleObservation(room, 'A', IDLE_THRESHOLD_MS + IDLE_COOLDOWN_MS, secondEvents), true);
  assert.equal(secondEvents.length, 1);
  assert.match(secondEvents[0].text, /又停下來|仍然只記錄/);
  assert.equal(shouldTriggerIdleObservation(room, 'A', 1_000_000), false);

  const endingRoom = readyRoom();
  endingRoom.ending = { id: 'done' };
  assert.equal(shouldTriggerIdleObservation(endingRoom, 'A', 1_000_000), false);
});

test('idle observation is actor-local and does not reset meaningful activity', () => {
  const room = readyRoom();
  room.narrativeBehavior.lastMeaningfulActionAt.B = 55_000;
  const events = [];
  triggerIdleObservation(room, 'A', 60_000, events);

  assert.equal(room.narrativeBehavior.lastMeaningfulActionAt.A, 0);
  assert.equal(room.narrativeBehavior.lastMeaningfulActionAt.B, 55_000);
  assert.ok(room.narrativeBehavior.reactionFactIds.A.some(id => id.startsWith('echo.behavior.idle.')));
  assert.equal(room.narrativeBehavior.reactionFactIds.B.some(id => id.startsWith('echo.behavior.idle.')), false);
});
