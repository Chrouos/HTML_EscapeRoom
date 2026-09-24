const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const {
  IDLE_THRESHOLD_MS,
  IDLE_COOLDOWN_MS,
  ensureNarrativeBehavior,
  shouldTriggerIdleObservation,
  triggerIdleObservation
} = require('../../game/privateEventEngine');

function readyRoom() {
  const room = createRoomState('ROOM-IDLE', 1000);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  ensureNarrativeBehavior(room, 1000);
  room.narrativeBehavior.lastMeaningfulActionAt.A = 1000;
  return room;
}

test('idle policy waits 60 seconds, cools down for 120 seconds, and caps at two observations', () => {
  const room = readyRoom();
  const events = [];

  assert.equal(IDLE_THRESHOLD_MS, 60_000);
  assert.equal(IDLE_COOLDOWN_MS, 120_000);
  assert.equal(shouldTriggerIdleObservation(room, 'A', 60_999), false);
  assert.equal(shouldTriggerIdleObservation(room, 'A', 61_000), true);

  assert.equal(triggerIdleObservation(room, 'A', 61_000, events), true);
  assert.equal(events.length, 1);
  assert.equal(events[0].contentId, 'echo.behavior.idle.1');
  assert.deepEqual(events[0].audience, { kind: 'role', role: 'host' });
  assert.match(events[0].text, /停|沒有操作|記錄|答案/);

  assert.equal(shouldTriggerIdleObservation(room, 'A', 61_001), false);
  assert.equal(shouldTriggerIdleObservation(room, 'A', 180_999), false);
  assert.equal(shouldTriggerIdleObservation(room, 'A', 181_000), true);

  assert.equal(triggerIdleObservation(room, 'A', 181_000, events), true);
  assert.equal(events.length, 2);
  assert.equal(events[1].contentId, 'echo.behavior.idle.2');
  assert.deepEqual(events[1].audience, { kind: 'role', role: 'host' });
  assert.equal(shouldTriggerIdleObservation(room, 'A', 500_000), false);
});

test('idle policy stays off before main1, after ending, and for invalid roles', () => {
  const room = readyRoom();
  room.publicFacts = room.publicFacts.filter(fact => fact !== 'main1Completed');
  assert.equal(shouldTriggerIdleObservation(room, 'A', 100_000), false);

  room.publicFacts.push('main1Completed');
  room.ending = { id: 'done' };
  assert.equal(shouldTriggerIdleObservation(room, 'A', 100_000), false);
  assert.equal(shouldTriggerIdleObservation(room, 'C', 100_000), false);
});

test('idle observations never reset the meaningful-action clock or leak to the partner', () => {
  const room = readyRoom();
  const beforeB = room.narrativeBehavior.lastMeaningfulActionAt.B;
  const events = [];

  triggerIdleObservation(room, 'A', 61_000, events);

  assert.equal(room.narrativeBehavior.lastMeaningfulActionAt.A, 1000);
  assert.equal(room.narrativeBehavior.lastMeaningfulActionAt.B, beforeB);
  assert.equal(room.narrativeBehavior.reactionFactIds.B.includes('echo.behavior.idle.1'), false);
  assert.deepEqual(events.map(event => event.audience), [{ kind: 'role', role: 'host' }]);
});
