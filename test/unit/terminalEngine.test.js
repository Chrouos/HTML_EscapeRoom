const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { terminalEntries } = require('../../game/content/terminalEntries');
const { openEntry, executeOperation, projectWorkstation, refreshWorkstation, audienceAllows } = require('../../game/terminalEngine');

function readyRoom() {
  const room = createRoomState('ROOM42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed', 'main2Completed', 'main3Completed', 'main4Completed', 'main5Completed', 'accessLogOpened'];
  room.chapter = 5;
  refreshWorkstation(room);
  return room;
}

function entry(room, player, id) {
  return openEntry(room, player, id).entry;
}

test('content declares all nine deception groups and exact verification links', () => {
  const byId = new Map(terminalEntries.map(item => [item.id, item]));
  const deception = new Map(terminalEntries.filter(item => item.isDeception).map(item => [item.deceptionId, item]));
  assert.deepEqual([...deception.keys()].sort(), ['A-1', 'A-2', 'A-3', 'B-1', 'B-2', 'B-3', 'D-1', 'D-2', 'L-1']);
  assert.equal(byId.get('doc.a_incident_report').verificationEntries[0].entryId, 'audio.original_incident_timestamp');
  assert.equal(byId.get('ai.a2.cleanup_request').verificationEntries[1].entryId, 'log.mirror_backup');
  assert.equal(byId.get('ai.b2.pause_request').verificationEntries[0].entryId, 'log.token_reissue');
  assert.equal(byId.get('doc.a_solo_protocol').verificationEntries[0].entryId, 'doc.protocol_signature_template');
  assert.equal(byId.get('log.a_partner_unknown_access').verificationEntries[0].entryId, 'log.audit_checksum');
});

test('A and B receive conflicting incident and solo protocol projections while raw evidence is shared', () => {
  const room = readyRoom();
  const a = projectWorkstation(room, 'A');
  const b = projectWorkstation(room, 'B');
  assert.ok(a.files.entries.some(item => item.id === 'doc.a_incident_report'));
  assert.ok(!a.files.entries.some(item => item.id === 'doc.b_incident_report'));
  assert.ok(b.files.entries.some(item => item.id === 'doc.b_incident_report'));
  assert.ok(!b.files.entries.some(item => item.id === 'doc.a_incident_report'));
  assert.ok(a.files.entries.some(item => item.id === 'doc.a_solo_protocol'));
  assert.ok(b.files.entries.some(item => item.id === 'doc.b_solo_protocol'));
  assert.ok(a.logs.entries.some(item => item.id === 'audio.original_incident_timestamp'));
  assert.ok(b.logs.entries.some(item => item.id === 'audio.original_incident_timestamp'));
});

test('wrong-role locked IDs and filenames are absent from the projection', () => {
  const room = createRoomState('ROOM42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated'];
  refreshWorkstation(room);
  const a = projectWorkstation(room, 'A');
  const b = projectWorkstation(room, 'B');
  const aIds = JSON.stringify(a);
  const bIds = JSON.stringify(b);
  assert.doesNotMatch(aIds, /experiment_roster|b_incident_report|b_solo_protocol|blackbox/);
  assert.doesNotMatch(bIds, /a_assignment_appendix|a_incident_report|a_solo_protocol|blackbox/);
});

test('opening a visible record is role-local and repeated opens are idempotent', () => {
  const room = readyRoom();
  const first = openEntry(room, { role: 'A', playerId: 'player-a' }, 'doc.a_incident_report');
  assert.equal(first.stateChanged, true);
  assert.equal(first.entry.id, 'doc.a_incident_report');
  const second = openEntry(room, { role: 'A', playerId: 'player-a' }, 'doc.a_incident_report');
  assert.equal(second.stateChanged, false);
  assert.throws(() => openEntry(room, { role: 'B', playerId: 'player-b' }, 'doc.a_incident_report'), /locked|visible|entry/i);
});

test('verify_incident_timestamp requires both reports, records every attempt, and unlocks A-2', () => {
  const room = readyRoom();
  room.workstation.A.roleFacts.push('rapportCount2');
  refreshWorkstation(room);
  openEntry(room, { role: 'A', playerId: 'player-a' }, 'doc.a_incident_report');
  assert.throws(() => executeOperation(room, { role: 'A', playerId: 'player-a' }, 'verify_incident_timestamp'), /reports|compare|locked/i);
  openEntry(room, { role: 'B', playerId: 'player-b' }, 'doc.b_incident_report');
  const attempt = executeOperation(room, { role: 'A', playerId: 'player-a' }, 'verify_incident_timestamp', 'wrong-value');
  assert.equal(attempt.stateChanged, true);
  assert.ok(room.workstation.A.roleFacts.includes('incidentVerificationAttempted'));
  assert.ok(room.workstation.A.unlockedEntryIds.includes('ai.a2.cleanup_request'));
  const retry = executeOperation(room, { role: 'A', playerId: 'player-a' }, 'verify_incident_timestamp', 'still-wrong');
  assert.equal(retry.stateChanged, true);
  assert.equal(room.workstation.A.actionAttempts.filter(id => id === 'verify_incident_timestamp').length, 2);
});

test('verification progress is applied only from its manifest effects', () => {
  const { operations } = require('../../game/content/operations');
  const manifest = operations.find(operation => operation.operationId === 'verify_incident_timestamp');
  assert.deepEqual(manifest.effects.publicFacts, ['incidentVerificationAttempted']);
  assert.deepEqual(manifest.effects.roleFacts, ['incidentVerificationAttempted']);
  const room = readyRoom({ publicFacts: ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'] });
  openEntry(room, { role: 'A', playerId: 'player-a' }, 'doc.a_incident_report');
  openEntry(room, { role: 'B', playerId: 'player-b' }, 'doc.b_incident_report');
  executeOperation(room, { role: 'A', playerId: 'player-a' }, 'verify_incident_timestamp');
  assert.ok(room.publicFacts.includes(manifest.effects.publicFacts[0]));
  assert.ok(room.workstation.A.roleFacts.includes(manifest.effects.roleFacts[0]));
});

test('executeOperation applies role facts without mutating the other actor projection', () => {
  const room = readyRoom();
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  room.workstation.A.roleFacts.push('rapportCount2');
  refreshWorkstation(room);
  openEntry(room, { role: 'A', playerId: 'player-a' }, 'files.mainline');
  const before = JSON.stringify(projectWorkstation(room, 'B'));
  const result = executeOperation(room, { role: 'A', playerId: 'player-a' }, 'archive_index');
  assert.equal(result.stateChanged, true);
  assert.ok(room.workstation.A.roleFacts.includes('aArchivedIndex'));
  assert.equal(JSON.stringify(projectWorkstation(room, 'B')), before);
});

test('private operations are bound to their owner role and never appear cross-role', () => {
  const room = readyRoom();
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  room.workstation.A.roleFacts.push('rapportCount2');
  openEntry(room, { role: 'A', playerId: 'player-a' }, 'files.mainline');
  refreshWorkstation(room);
  assert.ok(room.workstation.A.activeOperations.includes('archive_index'));
  assert.ok(!room.workstation.B.activeOperations.includes('archive_index'));
  assert.ok(!room.workstation.A.activeOperations.includes('flag_identity'));
  assert.throws(() => executeOperation(room, { role: 'B', playerId: 'player-b' }, 'archive_index'), /locked|role/i);
  assert.throws(() => executeOperation(room, { role: 'A', playerId: 'player-a' }, 'flag_identity'), /locked|role/i);
  assert.deepEqual(room.workstation.A.roleFacts, ['rapportCount2']);
  assert.deepEqual(room.workstation.B.roleFacts, []);
});

test('a mainline operation has one shared completion and cannot be rerun by the other actor', () => {
  const room = readyRoom();
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined', 'main1Completed'];
  refreshWorkstation(room);
  executeOperation(room, { role: 'A', playerId: 'player-a' }, 'continue_file_index');
  assert.ok(room.completedNodes.includes('file_index_ready'));
  assert.throws(() => executeOperation(room, { role: 'B', playerId: 'player-b' }, 'continue_file_index'), /locked|completed/i);
  assert.equal(room.publicFacts.filter(fact => fact === 'fileIndexContinued').length, 1);
});

test('direct engine callers must provide a verified player identity', () => {
  const room = readyRoom();
  assert.throws(() => projectWorkstation(room, { role: 'A' }), /identity|playerId/i);
  assert.throws(() => openEntry(room, { role: 'A' }, 'files.mainline'), /identity|playerId/i);
  assert.throws(() => executeOperation(room, { role: 'A' }, 'continue_file_index'), /identity|playerId/i);
});

test('malformed role audiences fail closed instead of defaulting to B', () => {
  assert.equal(audienceAllows({ audience: { kind: 'role', role: 'bogus' } }, 'A'), false);
  assert.equal(audienceAllows({ audience: { kind: 'role', role: 'bogus' } }, 'B'), false);
});
