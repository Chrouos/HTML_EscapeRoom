const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const {
  triggerDialogue,
  ensureDialogueState,
  selectDialogue,
  resolveSeed,
  projectDialogueEvent
} = require('../../game/privateEventEngine');

function readyRoom() {
  const room = createRoomState('ROOM-42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined'];
  return room;
}

test('public announcements lead the room and no direct line leaks before main1', () => {
  const room = readyRoom();
  const events = [];
  triggerDialogue(room, { operationId: 'create_room' }, events);
  triggerDialogue(room, { operationId: 'host_join' }, events);
  triggerDialogue(room, { operationId: 'guest_join' }, events);
  assert.ok(events.length >= 3);
  assert.ok(events.every(event => event.audience.kind === 'both'));
  assert.ok(events.every(event => !event.channel && event.type === 'system'));
  assert.ok(events.every(event => event.text && /^(?:ORPHEUS|ECHO)[：:]/.test(event.text)));
  assert.equal(room.directDialogueState.A.deliveredContentIds.length, 0);
  assert.equal(room.directDialogueState.B.deliveredContentIds.length, 0);
});

test('first pressure line waits for two rapport lines and pressure is separated', () => {
  const room = readyRoom();
  room.publicFacts.push('main1Completed');
  const events = [];
  triggerDialogue(room, { operationId: 'complete_main1', role: 'A' }, events);
  triggerDialogue(room, { entryOpened: 'files.mainline', role: 'A' }, events);
  assert.equal(room.directDialogueState.A.rapportCount, 2);
  triggerDialogue(room, { entryOpened: 'ai.a1.index_request', role: 'A' }, events);
  assert.equal(room.directDialogueState.A.lastIntent, 'private_task');
  assert.equal(room.directDialogueState.A.rapportSincePressure, 0);
  triggerDialogue(room, { entryOpened: 'doc.a_incident_report', role: 'A' }, events);
  assert.equal(room.directDialogueState.A.lastIntent, 'private_task');
  triggerDialogue(room, { operationId: 'verify_incident_timestamp', role: 'A' }, events);
  assert.ok(room.directDialogueState.A.rapportSincePressure >= 1);
});

test('manipulation is gated by opening the anomaly entry', () => {
  const room = readyRoom();
  room.publicFacts.push('main1Completed');
  ensureDialogueState(room);
  room.directDialogueState.A.rapportCount = 2;
  room.directDialogueState.A.rapportSincePressure = 1;
  const before = room.directDialogueState.A.deliveredContentIds.length;
  triggerDialogue(room, { intent: 'manipulation', role: 'A' }, []);
  assert.equal(room.directDialogueState.A.deliveredContentIds.length, before);
  triggerDialogue(room, { entryOpened: 'doc.a_incident_report', role: 'A', intent: 'manipulation' }, []);
  assert.equal(room.directDialogueState.A.lastIntent, 'manipulation');
});

test('A and B triggers are independent and deterministic', () => {
  const room = readyRoom();
  room.publicFacts.push('main1Completed');
  const events = [];
  triggerDialogue(room, { operationId: 'complete_main1', role: 'A' }, events);
  const bBefore = room.directDialogueState.B.deliveredContentIds.length;
  const bCursor = room.streams.B.cursor;
  triggerDialogue(room, { entryOpened: 'files.mainline', role: 'A' }, events);
  assert.equal(room.directDialogueState.B.deliveredContentIds.length, bBefore);
  assert.equal(room.streams.B.cursor, bCursor);
  assert.ok(events.every(event => !('timestamp' in event) && !('placeholder' in event)));
  const seed = resolveSeed('ROOM-42', 'player-a', 'orpheus.rapport.a');
  assert.equal(seed, `${'ROOM-42'}:player-a:orpheus.rapport.a`);
  const first = selectDialogue(room, 'A', 'rapport');
  const second = selectDialogue(room, 'A', 'rapport');
  assert.equal(first?.id, second?.id);
});

test('all ORPHEUS lines use the same display shape', () => {
  const event = projectDialogueEvent({ id: 'x', text: 'ORPHEUS: test', intent: 'rapport' }, { kind: 'role', role: 'host' });
  assert.deepEqual(Object.keys(event).sort(), ['audience', 'contentId', 'text', 'type']);
  assert.equal(event.type, 'system');
  assert.equal(event.contentId, 'x');
});
