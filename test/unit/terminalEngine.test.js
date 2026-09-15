const test = require('node:test');
const assert = require('node:assert/strict');

const { createRoomState } = require('../../game/createRoomState');
const { terminalEntries } = require('../../game/content/terminalEntries');
const { openEntry, executeOperation, projectWorkstation, refreshWorkstation, audienceAllows, executeTerminalCommand } = require('../../game/terminalEngine');

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

test('discovered evidence opens as an actor-safe note under Files/NOTES', () => {
  const room = readyRoom();
  room.sideEvidence = [{ id: 'timestamp', title: 'Timestamp mismatch', summary: 'Two dates', discovered: true }];
  const projected = projectWorkstation(room, { role: 'A', playerId: 'player-a' });
  const note = projected.files.entries.find(item => item.id === 'evidence.timestamp');
  assert.equal(note.parentId, 'folder.notes');
  assert.equal(note.text, 'Two dates');
  const opened = openEntry(room, { role: 'A', playerId: 'player-a' }, 'evidence.timestamp');
  assert.equal(opened.entry.id, 'evidence.timestamp');
  assert.ok(room.workstation.A.openedEntryIds.includes('evidence.timestamp'));
  assert.ok(!room.workstation.B.openedEntryIds.includes('evidence.timestamp'));
});

test('terminal projection omits locked or future contextual entries', () => {
  const room = createRoomState('ROOM42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated', 'hostJoined', 'guestJoined'];
  refreshWorkstation(room);
  const terminal = projectWorkstation(room, { role: 'A', playerId: 'player-a' }).terminal.entries;
  assert.ok(terminal.every(item => item.locked !== true));
  assert.ok(!terminal.some(item => item.id === 'ai.a2.cleanup_request'));
});

test('available side investigations project as Files/NOTES launch entries', () => {
  const room = readyRoom();
  room.publicProgress = { sidePuzzles: [{ puzzleId: 'side2', title: 'ANOMALY', hook: 'Inspect the anomaly.', opened: false, complete: false }] };
  const files = projectWorkstation(room, { role: 'A', playerId: 'player-a' }).files.entries;
  const note = files.find(item => item.id === 'investigation.side2');
  assert.equal(note.parentId, 'folder.notes');
  assert.equal(note.puzzleId, 'side2');
  assert.equal(note.opened, false);
  assert.equal(note.text, 'Inspect the anomaly.');
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

test('pair protocol comparison requires both solo protocol documents', () => {
  const room = readyRoom();
  assert.ok(!room.workstation.A.activeOperations.includes('pair_validate_protocol'));
  openEntry(room, { role: 'A', playerId: 'player-a' }, 'doc.a_solo_protocol');
  refreshWorkstation(room);
  assert.ok(!room.workstation.A.activeOperations.includes('pair_validate_protocol'));
  openEntry(room, { role: 'B', playerId: 'player-b' }, 'doc.b_solo_protocol');
  refreshWorkstation(room);
  assert.ok(room.publicFacts.includes('soloProtocolsReady'));
  assert.ok(room.workstation.A.activeOperations.includes('pair_validate_protocol'));
  executeOperation(room, { role: 'A', playerId: 'player-a' }, 'pair_validate_protocol');
  assert.ok(room.publicFacts.includes('comparedSoloFiles'));
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

test('terminal commands return safe output and only expose visible records', () => {
  const room = readyRoom();
  const help = executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'HELP');
  assert.equal(help.stateChanged, false);
  assert.match(help.output, /SEARCH|SCAN|UNZIP|SEND/);

  const search = executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'SEARCH log');
  assert.match(search.output, /log\./);
  assert.doesNotMatch(search.output, /experiment_roster|b_incident_report/);

  const scan = executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'SCAN log.original_index_time');
  assert.match(scan.output, /02:11/);
});

test('HINT and SEND produce public ORPHEUS events without audience labels', () => {
  const room = readyRoom();
  const hint = executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'HINT');
  assert.equal(hint.publicEvents.length, 1);
  assert.deepEqual(hint.publicEvents[0].audience, { kind: 'both' });
  assert.match(hint.publicEvents[0].text, /ORPHEUS/);
  assert.doesNotMatch(hint.publicEvents[0].text, /AI_BROADCAST|AI_DIRECT|audience|channel/i);
  const send = executeTerminalCommand(room, { role: 'B', playerId: 'player-b' }, 'SEND checksum 02:17');
  assert.equal(send.publicEvents.length, 1);
  assert.deepEqual(send.publicEvents[0].audience, { kind: 'both' });
  assert.match(send.publicEvents[0].text, /ORPHEUS/);
  assert.match(send.publicEvents[0].text, /checksum 02:17/);
});

test('terminal rejects unsafe, malformed, locked, and cross-room commands without mutation', () => {
  const room = readyRoom();
  const before = structuredClone(room);
  for (const command of ['', 'UNKNOWN', 'SEARCH', 'SCAN ../secret', 'UNZIP C:\\\\tmp\\\\evil.zip', 'UNZIP __proto__', 'UNZIP constructor', 'SEND ' + 'x'.repeat(1001)]) {
    assert.throws(() => executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, command), /invalid|locked|unsafe|command/i);
  }
  assert.throws(() => executeTerminalCommand(room, { role: 'A', playerId: 'wrong-player' }, 'HELP'), /identity/i);
  assert.deepEqual(room, before);
});

test('locked commands on a fresh authenticated room do not backfill state', () => {
  const room = createRoomState('ROOM42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  const before = structuredClone(room);
  assert.throws(() => executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'SCAN files.secret'), /locked|visible/i);
  assert.throws(() => executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'UNZIP case_bundle.zip'), /locked|visible/i);
  assert.deepEqual(room, before);
});

test('UNZIP expands only authored manifests and is idempotent', () => {
  const room = readyRoom();
  const first = executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'UNZIP case_bundle.zip');
  assert.equal(first.stateChanged, true);
  assert.ok(first.unlockedEntryIds.length > 0);
  const before = structuredClone(room);
  const second = executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'UNZIP case_bundle.zip');
  assert.equal(second.stateChanged, false);
  assert.deepEqual(room, before);
  assert.throws(() => executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'UNZIP client.zip'), /locked|archive|manifest/i);
});

test('Files projection exposes nested folders and locked metadata without content leaks', () => {
  const room = createRoomState('ROOM42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated'];
  refreshWorkstation(room);
  const a = projectWorkstation(room, { role: 'A', playerId: 'player-a' });
  const root = a.files.entries.find(item => item.id === 'folder.root');
  const locked = a.files.entries.find(item => item.id === 'doc.a_incident_report');
  assert.equal(root.kind, 'folder');
  assert.equal(root.parentId, null);
  assert.equal(a.files.rootId, 'folder.root');
  assert.equal(locked.locked, true);
  assert.equal(locked.parentId, 'folder.private_a');
  assert.equal(locked.text, undefined);
  assert.equal(a.files.entries.some(item => item.id === 'files.experiment_roster'), false);
});

test('Files projection keeps the folder root through the actor-safe state adapter', () => {
  const room = createRoomState('ROOM42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated'];
  refreshWorkstation(room);
  const { projectForPlayer } = require('../../game/safeState');
  const state = projectForPlayer(room, { role: 'A', playerId: 'player-a' });
  assert.equal(state.workstation.files.rootId, 'folder.root');
  assert.equal(state.workstation.files.entries.find(item => item.id === 'folder.case').parentId, 'folder.root');
  assert.equal(state.workstation.files.entries.find(item => item.id === 'answer.main1').parentId, 'folder.case');
});

test('opening the current answer gate is actor-local and unlocks only that actor form state', () => {
  const room = createRoomState('ROOM42', 0);
  room.players.A = { playerId: 'player-a' };
  room.players.B = { playerId: 'player-b' };
  room.publicFacts = ['roomCreated'];
  refreshWorkstation(room);
  const before = projectWorkstation(room, { role: 'A', playerId: 'player-a' });
  assert.equal(before.answerGate.open, false);
  const gateId = before.answerGate.entryId;
  openEntry(room, { role: 'A', playerId: 'player-a' }, gateId);
  const a = projectWorkstation(room, { role: 'A', playerId: 'player-a' });
  const b = projectWorkstation(room, { role: 'B', playerId: 'player-b' });
  assert.equal(a.answerGate.open, true);
  assert.equal(b.answerGate.open, false);
});

test('archive metadata remains closed until authored UNZIP and child files are revealed safely', () => {
  const room = readyRoom();
  const before = projectWorkstation(room, { role: 'A', playerId: 'player-a' });
  const archive = before.files.entries.find(item => item.archive?.id === 'case_bundle.zip');
  assert.ok(archive);
  assert.equal(archive.archive.expanded, false);
  assert.equal(before.files.entries.some(item => item.id === 'archive.case_bundle.index'), false);
  executeTerminalCommand(room, { role: 'A', playerId: 'player-a' }, 'UNZIP case_bundle.zip');
  const after = projectWorkstation(room, { role: 'A', playerId: 'player-a' });
  assert.ok(after.files.entries.some(item => item.id === 'archive.case_bundle.index'));
  assert.equal(after.files.entries.find(item => item.archive?.id === 'case_bundle.zip').archive.expanded, true);
});
