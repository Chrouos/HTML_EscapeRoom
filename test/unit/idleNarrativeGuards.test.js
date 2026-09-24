const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { shouldTriggerIdleObservation } = require('../../game/privateEventEngine');

test('idle observations require both authenticated room occupants to still exist', () => {
  const room = createRoomState('123456', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = null;
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  room.narrativeBehavior.lastMeaningfulActionAt.A = 0;

  assert.equal(shouldTriggerIdleObservation(room, 'A', 60_000), false);

  room.players.B = { playerId: 'player-b' };
  assert.equal(shouldTriggerIdleObservation(room, 'A', 60_000), true);
});
