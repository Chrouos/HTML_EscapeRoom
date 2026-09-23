const { evaluatePredicate } = require('./content/contentSchema');
const { terminalEntries } = require('./content/terminalEntries');
const { operations } = require('./content/operations');
const { createWorkstationState } = require('./createRoomState');
const { refreshPrivateMissions, missionForOperation } = require('./privateEventEngine');

const ROLES = ['A', 'B'];
const MAX_TERMINAL_TEXT = 1000;
const MAX_TERMINAL_ARGUMENT = 120;

// Archive contents are authored on the server.  The client may request an
// archive by name, but it can never provide bytes or choose arbitrary paths.
// Task 2 can extend this table with richer folder metadata without changing
// the command contract.
const ARCHIVE_MANIFESTS = Object.freeze({
  'case_bundle.zip': Object.freeze(['files.mainline', 'log.original_index_time', 'log.personnel_transfer', 'archive.case_bundle.index']),
  'incident_bundle.zip': Object.freeze(['audio.original_incident_timestamp', 'doc.a_incident_report', 'doc.b_incident_report', 'archive.incident.raw_notes']),
  'mirror_backup.zip': Object.freeze(['log.mirror_backup', 'log.token_reissue', 'archive.mirror.checksum'])
});

function authoredEntries() {
  return [...terminalEntries];
}

function discoveredEvidenceEntries(room) {
  const evidence = Array.isArray(room?.sideEvidence) ? room.sideEvidence : [];
  return evidence.filter(item => item && item.discovered !== false && item.found !== false && item.isDiscovered !== false
    && typeof item.id === 'string' && item.id).map(item => ({
    id: `evidence.${item.id}`,
    sourceEntryId: `evidence.${item.id}`,
    sourceGroup: 'discovered_evidence',
    audience: { kind: 'both' },
    kind: 'document',
    parentId: 'folder.notes',
    filename: `${item.id}.note`,
    text: typeof item.summary === 'string' ? item.summary : typeof item.title === 'string' ? item.title : '',
    evidenceId: item.id
  }));
}

function investigationEntries(room) {
  const views = Array.isArray(room?.publicProgress?.sidePuzzles) ? room.publicProgress.sidePuzzles : [];
  return views.filter(view => view && typeof view.puzzleId === 'string' && view.puzzleId).map(view => ({
    id: `investigation.${view.puzzleId}`,
    sourceEntryId: `investigation.${view.puzzleId}`,
    sourceGroup: 'side_investigation',
    audience: { kind: 'both' },
    kind: 'document',
    parentId: 'folder.notes',
    filename: `${view.puzzleId}.case`,
    text: typeof view.prompt === 'string' && view.opened ? view.prompt
      : typeof view.hook === 'string' ? view.hook : typeof view.title === 'string' ? view.title : '',
    title: view.title,
    puzzleId: view.puzzleId,
    stepId: view.stepId || 'inspect',
    opened: view.opened === true,
    complete: view.complete === true,
    hook: view.hook || '',
    prompt: view.prompt || ''
  }));
}

function allEntries(room) {
  return [...authoredEntries(), ...discoveredEvidenceEntries(room), ...investigationEntries(room)];
}

const TERMINAL_HINTS = Object.freeze([
  'ORPHEUS：先確認目前能看見的檔案索引，再決定要不要打開它。',
  'ORPHEUS：時間戳記不會自己改變；把不同來源的紀錄放在一起比對。',
  'ORPHEUS：有些檔案只在正確的工作站出現，別把看不見的內容當成不存在。',
  'ORPHEUS：如果一份紀錄要求你相信另一份紀錄，先找第三個來源。',
  'ORPHEUS：目前的路徑仍然可以回頭檢查，先保留你們各自看到的版本。',
  'ORPHEUS：最後的決定會留下操作痕跡；現在看到的提示不等於命令。'
]);
const PRIVATE_OPERATION_ROLES = Object.freeze({
  archive_index: 'A', decline_index_repair: 'A', skip_a1: 'A',
  delete_local_mirror: 'A', share_mirror_first: 'A', decline_mirror_cleanup: 'A', skip_a2: 'A',
  request_solo_validation: 'A', publish_fragment: 'A', request_pair_validation: 'A', skip_a3: 'A',
  flag_identity: 'B', share_roster: 'B', decline_identity_check: 'B', skip_b1: 'B',
  pause_local_mirror: 'B', keep_local_mirror: 'B', warn_partner_first: 'B', skip_b2: 'B',
  file_full_report: 'B', file_anonymous_summary: 'B', disclose_report: 'B', skip_b3: 'B'
});

function roleOf(player) {
  const role = typeof player === 'string' ? player : player?.role;
  if (!ROLES.includes(role)) throw Object.assign(new Error('Invalid player role'), { code: 'INVALID_PLAYER', status: 400 });
  return role;
}

function assertPlayer(room, player) {
  const role = roleOf(player);
  if (player && typeof player === 'object'
    && player.roomCode !== undefined && String(player.roomCode) !== String(room?.roomCode)) {
    throw Object.assign(new Error('Player identity does not match room'), { code: 'INVALID_PLAYER', status: 409 });
  }
  const occupant = room.players?.[role];
  if (!occupant || typeof occupant.playerId !== 'string' || !occupant.playerId) {
    throw Object.assign(new Error('Player identity does not match room'), { code: 'INVALID_PLAYER', status: 409 });
  }
  if (player && typeof player === 'object'
    && (typeof player.playerId !== 'string' || player.playerId !== occupant.playerId)) {
    throw Object.assign(new Error('Player identity does not match room'), { code: 'INVALID_PLAYER', status: 409 });
  }
  return role;
}

function commandError(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

function safeArgument(value, label) {
  if (typeof value !== 'string' || !value || value.length > MAX_TERMINAL_ARGUMENT
    || /[\u0000-\u001f\u007f]/.test(value)
    || value.includes('/') || value.includes('\\') || value.includes('..')
    || /%2f|%5c|%2e/i.test(value)) {
    throw commandError('INVALID_COMMAND', 400, `Invalid ${label}`);
  }
  return value;
}

function parseTerminalCommand(value) {
  if (typeof value !== 'string' || value.length > MAX_TERMINAL_TEXT) {
    throw commandError('INVALID_COMMAND', 400, 'Invalid terminal command');
  }
  const input = value.trim();
  if (!input) throw commandError('INVALID_COMMAND', 400, 'Invalid terminal command');
  const match = /^(HELP|HINT|SEARCH|SCAN|UNZIP|SEND)(?:\s+([\s\S]*))?$/i.exec(input);
  if (!match) throw commandError('INVALID_COMMAND', 400, 'Unknown terminal command');
  const command = match[1].toUpperCase();
  const argument = match[2] === undefined ? '' : match[2].trim();
  if (command === 'HELP' || command === 'HINT') {
    if (argument) throw commandError('INVALID_COMMAND', 400, `${command} does not take an argument`);
    return { command, argument: '' };
  }
  if (command === 'SEND') {
    if (!argument || argument.length > MAX_TERMINAL_TEXT || /[\u0000-\u001f\u007f]/.test(argument)) {
      throw commandError('INVALID_COMMAND', 400, 'Invalid SEND text');
    }
    return { command, argument };
  }
  if (command === 'UNZIP') {
    const [target, ...passwordParts] = argument.split(/\s+/);
    if (!target || target.length > MAX_TERMINAL_ARGUMENT) {
      throw commandError('INVALID_COMMAND', 400, 'Invalid terminal command: UNZIP requires one argument');
    }
    const password = passwordParts.join(' ');
    if (password.length > MAX_TERMINAL_ARGUMENT || /[\u0000-\u001f\u007f]/.test(password)) {
      throw commandError('INVALID_COMMAND', 400, 'Invalid archive password');
    }
    return { command, argument: safeArgument(target, 'UNZIP target'), password };
  }
  if (!argument || /\s/.test(argument)) throw commandError('INVALID_COMMAND', 400, `Invalid terminal command: ${command} requires one argument`);
  return { command, argument: safeArgument(argument, `${command} target`) };
}

function archivePasswordFor(archiveId) {
  const archive = authoredEntries().find(entry => entry.archive?.id?.toLowerCase() === archiveId);
  return typeof archive?.archive?.password === 'string' && archive.archive.password
    ? archive.archive.password : null;
}

function visibleEntries(room, role) {
  const visible = new Set(room.workstation[role].unlockedEntryIds || []);
  return allEntries(room).filter(entry => visible.has(entry.id) || entry.sourceGroup === 'discovered_evidence');
}

function entryLabel(entry) {
  return entry.filename || entry.name || entry.id;
}

function executeTerminalCommand(room, player, value) {
  const parsed = parseTerminalCommand(value);
  const role = assertPlayer(room, player);
  // Reject locked targets before ensureRoom/refreshWorkstation can backfill
  // any state, preserving no-mutation semantics for direct callers.
  const currentVisible = new Set(room.workstation?.[role]?.unlockedEntryIds || []);
  if (parsed.command === 'SCAN') {
    const target = allEntries(room).find(entry => entry.id.toLowerCase() === parsed.argument.toLowerCase()
      || entryLabel(entry).toLowerCase() === parsed.argument.toLowerCase());
    if (!target || (!currentVisible.has(target.id) && target.sourceGroup !== 'discovered_evidence')) {
      throw commandError('ENTRY_LOCKED', 423, 'File is locked or not visible');
    }
  }
  if (parsed.command === 'UNZIP') {
    const archiveId = parsed.argument.toLowerCase();
    if (!Object.hasOwn(ARCHIVE_MANIFESTS, archiveId)
      || !ARCHIVE_MANIFESTS[archiveId].some(id => currentVisible.has(id))) {
      throw commandError('ARCHIVE_LOCKED', 423, 'Archive is locked or not visible');
    }
    const requiredPassword = archivePasswordFor(archiveId);
    if (requiredPassword && parsed.password !== requiredPassword) {
      throw commandError('ARCHIVE_PASSWORD', 423, 'Archive password is incorrect');
    }
  }
  ensureRoom(room);
  refreshWorkstation(room);
  if (room.ending) {
    return { stateChanged: false, command: parsed.command, output: 'CONNECTION CLOSED', publicEvents: [], unlockedEntryIds: [] };
  }

  const visible = visibleEntries(room, role);
  if (parsed.command === 'HELP') {
    return {
      stateChanged: false,
      command: parsed.command,
      output: 'HELP\nSEARCH <node>\nSCAN <filename>\nUNZIP <filename> [password]\nHINT\nSEND <text>',
      publicEvents: [], unlockedEntryIds: []
    };
  }
  if (parsed.command === 'HINT') {
    const index = Math.min(Math.max(Number(room.chapter || 1) - 1, 0), TERMINAL_HINTS.length - 1);
    const text = TERMINAL_HINTS[index];
    return {
      stateChanged: true,
      command: parsed.command,
      output: text,
      publicEvents: [{ type: 'story', text, audience: { kind: 'both' } }],
      unlockedEntryIds: []
    };
  }
  if (parsed.command === 'SEND') {
    const text = parsed.argument.replace(/[<>]/g, '').trim();
    if (!text) throw commandError('INVALID_COMMAND', 400, 'Invalid SEND text');
    const eventText = `ORPHEUS：收到線索「${text}」。我會把它放進共同紀錄。`;
    return {
      stateChanged: true,
      command: parsed.command,
      output: eventText,
      publicEvents: [{ type: 'story', text: eventText, audience: { kind: 'both' } }],
      unlockedEntryIds: []
    };
  }
  if (parsed.command === 'SEARCH') {
    const needle = parsed.argument.toLowerCase();
    const matches = visible.filter(entry => [entry.id, entryLabel(entry), entry.sourceGroup, entry.text]
      .some(value => String(value || '').toLowerCase().includes(needle)));
    return {
      stateChanged: false,
      command: parsed.command,
      output: matches.length
        ? matches.map(entry => `${entry.id}  ${entryLabel(entry)}`).join('\n')
        : 'SEARCH: no visible records',
      publicEvents: [],
      unlockedEntryIds: []
    };
  }
  if (parsed.command === 'SCAN') {
    const target = visible.find(entry => entry.id.toLowerCase() === parsed.argument.toLowerCase()
      || entryLabel(entry).toLowerCase() === parsed.argument.toLowerCase());
    if (!target) throw commandError('ENTRY_LOCKED', 423, 'File is locked or not visible');
    return {
      stateChanged: false,
      command: parsed.command,
      output: `${target.id}\n${target.text}`,
      publicEvents: [],
      unlockedEntryIds: []
    };
  }

  const archiveId = parsed.argument.toLowerCase();
  if (!Object.hasOwn(ARCHIVE_MANIFESTS, archiveId)) {
    throw commandError('ARCHIVE_LOCKED', 423, 'Archive is not authored or not available');
  }
  const manifest = ARCHIVE_MANIFESTS[archiveId];
  const manifestEntries = manifest
    .map(id => authoredEntries().find(entry => entry.id === id))
    .filter(Boolean);
  if (!manifestEntries.length || !manifestEntries.some(entry => visible.includes(entry))) {
    throw commandError('ARCHIVE_LOCKED', 423, 'Archive is locked or not visible');
  }
  const ws = room.workstation[role];
  ws.unzippedArchiveIds ??= [];
  if (ws.unzippedArchiveIds.includes(archiveId)) {
    return {
      stateChanged: false,
      command: parsed.command,
      output: 'Archive already expanded',
      publicEvents: [],
      unlockedEntryIds: manifestEntries.filter(entry => ws.unlockedEntryIds.includes(entry.id)).map(entry => entry.id)
    };
  }
  const beforeUnlocked = new Set(ws.unlockedEntryIds);
  ws.unzippedArchiveIds.push(archiveId);
  refreshWorkstation(room);
  const unlockedEntryIds = manifestEntries
    .filter(entry => room.workstation[role].unlockedEntryIds.includes(entry.id) && !beforeUnlocked.has(entry.id))
    .map(entry => entry.id);
  return {
    stateChanged: true,
    command: parsed.command,
    output: `Archive expanded: ${parsed.argument}\n${unlockedEntryIds.join('\n')}`,
    publicEvents: [],
    unlockedEntryIds
  };
}

function ensureRoom(room) {
  if (!room || typeof room !== 'object') throw new TypeError('Room is required');
  room.publicFacts ??= [];
  room.completedNodes ??= [];
  room.actionAttempts ??= [];
  room.completedOperations ??= [];
  room.publicFacts ??= [];
  // Rooms and joins are authoritative public facts. Older room snapshots did
  // not persist these facts, so derive them once from the authenticated
  // occupants before projecting operation availability.
  if (room.roomCode && !room.publicFacts.includes('roomCreated')) room.publicFacts.push('roomCreated');
  if (room.players?.A && !room.publicFacts.includes('hostJoined')) room.publicFacts.push('hostJoined');
  if (room.players?.B && !room.publicFacts.includes('guestJoined')) room.publicFacts.push('guestJoined');
  room.workstation ??= {};
  for (const role of ROLES) {
    const current = room.workstation[role];
    if (!current || typeof current !== 'object' || Array.isArray(current)) room.workstation[role] = createWorkstationState();
    else {
      for (const [key, value] of Object.entries(createWorkstationState())) {
        if (!Array.isArray(current[key])) current[key] = [...value];
      }
    }
  }
  refreshPrivateMissions(room);
  return room;
}

function audienceAllows(entry, role) {
  const audience = entry.audience;
  if (!audience || typeof audience !== 'object') return false;
  if (audience.kind === 'both') return true;
  if (audience.kind === 'role') {
    if (audience.role !== 'host' && audience.role !== 'guest') return false;
    return (audience.role === 'host' ? 'A' : 'B') === role;
  }
  if (audience.kind === 'player') return false;
  return false;
}

function predicateState(room, role) {
  const ws = room.workstation[role];
  const roleFacts = targetRole => {
    const facts = new Set(room.workstation[targetRole]?.roleFacts || []);
    const dialogue = room.directDialogueState?.[targetRole] || {};
    if (Number(dialogue.rapportCount) >= 1) facts.add('rapportReady');
    if (Number(dialogue.rapportCount) >= 2) facts.add('rapportCount2');
    if (Number(dialogue.rapportSincePressure) >= 1) facts.add('rapportSincePressure');
    return [...facts];
  };
  return {
    chapter: room.chapter,
    publicFacts: room.publicFacts,
    role,
    roleFacts: { A: roleFacts('A'), B: roleFacts('B') },
    openedEntryIds: ws.openedEntryIds,
    actionIds: [...ws.actionAttempts]
  };
}

function hasPrivateFacts(entry, ws) {
  return (entry.requiresPrivateFacts || []).every(fact => ws.roleFacts.includes(fact));
}

function entryVisible(room, role, entry) {
  if (entry.archiveOnly && !room.workstation[role].unzippedArchiveIds?.includes(entry.archiveId)) return false;
  if ((entry.id === 'doc.a_incident_report' || entry.id === 'doc.b_incident_report')
    && !room.publicFacts.includes('main1Completed')) return false;
  return audienceAllows(entry, role)
    && evaluatePredicate(entry.unlockWhen || { all: [] }, predicateState(room, role))
    && hasPrivateFacts(entry, room.workstation[role]);
}

function expandedEntryVisible(room, role, entry, archiveIds) {
  if (!archiveIds.some(archiveId => Object.hasOwn(ARCHIVE_MANIFESTS, archiveId)
    && ARCHIVE_MANIFESTS[archiveId].includes(entry.id))) return false;
  // Extraction can reveal authored records before their ordinary index
  // predicate, but never crosses audience/private boundaries or the incident
  // report's chapter gate.
  if ((entry.id === 'doc.a_incident_report' || entry.id === 'doc.b_incident_report')
    && !room.publicFacts.includes('main1Completed')) return false;
  return audienceAllows(entry, role) && hasPrivateFacts(entry, room.workstation[role]);
}

function operationVisible(room, role, operation) {
  const owner = PRIVATE_OPERATION_ROLES[operation.operationId];
  if (operation.kind === 'private' && owner !== role) return false;
  const mission = operation.kind === 'private' && missionForOperation(operation.operationId);
  if (mission) {
    const state = room.privateMissions?.[role]?.find(item => item.id === mission.id);
    if (!state || state.state !== 'available') return false;
  }
  if (operation.kind === 'mainline' && operation.operationId !== 'verify_incident_timestamp'
    && room.completedOperations.includes(operation.operationId)) return false;
  if (operation.operationId === 'verify_incident_timestamp') {
    const openedA = room.workstation.A.openedEntryIds.includes('doc.a_incident_report');
    const openedB = room.workstation.B.openedEntryIds.includes('doc.b_incident_report');
    return openedA && openedB && evaluatePredicate(operation.unlockWhen || { all: [] }, predicateState(room, role));
  }
  if (operation.operationId === 'pair_validate_protocol'
    && !room.publicFacts.includes('soloProtocolsReady')) return false;
  return evaluatePredicate(operation.unlockWhen || { all: [] }, predicateState(room, role));
}

function refreshWorkstation(room) {
  ensureRoom(room);
  for (const role of ROLES) {
    const ws = room.workstation[role];
    ws.unzippedArchiveIds ??= [];
    const unlocked = authoredEntries().filter(entry => entryVisible(room, role, entry)
      || expandedEntryVisible(room, role, entry, ws.unzippedArchiveIds)).map(entry => entry.id);
    ws.unlockedEntryIds = [...new Set(unlocked)];
    const completed = new Set(ws.completedOperations);
    ws.activeOperations = operations
      .filter(operation => operationVisible(room, role, operation)
        && (!completed.has(operation.operationId) || operation.operationId === 'verify_incident_timestamp'))
      .map(operation => operation.operationId);
  }
  return room.workstation;
}

function appForEntry(entry) {
  if (entry.id.startsWith('log.') || entry.id.startsWith('audio.')) return 'logs';
  if (entry.id.startsWith('ai.')) return 'terminal';
  return 'files';
}

function entryParentId(entry) {
  if (entry.parentId !== undefined) return entry.parentId;
  if (entry.kind === 'folder') return null;
  if (entry.archiveOnly) return entry.archiveId === 'case_bundle.zip' ? 'archive.case_bundle'
    : entry.archiveId === 'incident_bundle.zip' ? 'archive.incident_bundle' : 'archive.mirror_backup';
  if (entry.id.startsWith('ai.') || entry.id.startsWith('doc.') || entry.id.startsWith('files.')) {
    const rolePrivate = entry.audience?.kind === 'role';
    return rolePrivate ? (entry.audience.role === 'host' ? 'folder.private_a' : 'folder.private_b') : 'folder.case';
  }
  return 'folder.case';
}

function currentMainPuzzleId(room) {
  const explicit = room.publicProgress?.puzzleId;
  if (typeof explicit === 'string' && /^main[1-6]$/.test(explicit)) return explicit;
  const done = new Set(room.mainProgress || []);
  return ['main1', 'main2', 'main3', 'main4', 'main5', 'main6'].find(id => !done.has(id)) || 'main6';
}

function displayEntry(entry, opened, locked = false, archiveExpanded = false) {
  const result = {
    id: entry.id,
    parentId: entryParentId(entry),
    name: entry.filename || entry.name || entry.id,
    kind: entry.kind || 'document',
    locked: Boolean(locked),
    metadataVisible: true,
    opened: Boolean(opened || entry.opened),
    answerGate: entry.answerGate || null,
    launchApp: entry.launchApp || null
  };
  if (entry.puzzleId) {
    result.puzzleId = entry.puzzleId;
    result.stepId = entry.stepId || 'inspect';
    result.investigation = { opened: entry.opened === true, complete: entry.complete === true };
  }
  if (entry.archive) result.archive = {
    id: entry.archive.id,
    expanded: Boolean(archiveExpanded),
    passwordRequired: typeof entry.archive.password === 'string' && entry.archive.password.length > 0
  };
  if (entry.archiveId && entry.archiveOnly) result.archive = { id: entry.archiveId, expanded: Boolean(archiveExpanded) };
  if (locked) return result;
  result.text = entry.text;
  result.verificationEntries = (entry.verificationEntries || []).map(item => item.entryId);
  return result;
}

function projectWorkstation(room, player) {
  const role = assertPlayer(room, player);
  ensureRoom(room);
  refreshWorkstation(room);
  const ws = room.workstation[role];
  const visible = new Set(ws.unlockedEntryIds);
  const opened = new Set(ws.openedEntryIds);
  const buckets = { files: [], terminal: [], logs: [] };
  const archiveIds = new Set(ws.unzippedArchiveIds || []);
  for (const item of allEntries(room)) {
    if (item.archiveOnly && !archiveIds.has(item.archiveId)) continue;
    if (!audienceAllows(item, role)) continue;
    const app = appForEntry(item);
    const unlocked = visible.has(item.id) || item.sourceGroup === 'discovered_evidence' || item.sourceGroup === 'side_investigation';
    if (!unlocked && item.archiveOnly) continue;
    if (!unlocked && item.sourceGroup === 'history_timeline') continue;
    if (!unlocked && app !== 'files') continue;
    buckets[app].push(displayEntry(item, opened.has(item.id), !unlocked,
      archiveIds.has(item.archive?.id || item.archiveId)));
  }
  // Keep the filesystem anchor explicit in the actor-safe projection.  The
  // client can then render the root deterministically even when a future
  // content pack adds another top-level folder or reorders authored entries.
  const fileRoot = buckets.files.find(item => item.kind === 'folder' && item.parentId == null);
  const answer = authoredEntries().find(item => item.answerGate?.puzzleId === currentMainPuzzleId(room)
    && audienceAllows(item, role));
  const answerGate = answer ? {
    entryId: answer.id,
    puzzleId: answer.answerGate.puzzleId,
    open: opened.has(answer.id)
  } : { entryId: null, puzzleId: currentMainPuzzleId(room), open: false };
  return {
    // Keep the active puzzle clue in the operations monitor while Files /
    // Terminal / Logs provide the explorable records.  This preserves the
    // legacy answer flow and ensures the dual-console migration does not
    // silently remove each role's starting clue.
    text: room.privateClues?.[role]?.text || '',
    audioUrl: room.privateClues?.[role]?.audioUrl || '',
    files: { rootId: fileRoot?.id || null, entries: buckets.files },
    terminal: { entries: buckets.terminal, activeOperations: ws.activeOperations.filter(operationId => operationId !== 'open_entry') },
    logs: { entries: buckets.logs },
    unlockedEntryIds: [...ws.unlockedEntryIds],
    openedEntryIds: [...ws.openedEntryIds],
    answerGate,
    // `open_entry` is a transport-only callback used by Files clicks; it is
    // intentionally not rendered as a generic Terminal button.
    activeOperations: ws.activeOperations.filter(operationId => operationId !== 'open_entry'),
    roleFacts: [...ws.roleFacts]
  };
}

function openEntry(room, player, entryId) {
  const role = assertPlayer(room, player);
  ensureRoom(room);
  refreshWorkstation(room);
  const entry = allEntries(room).find(item => item.id === entryId);
    const dynamicEntry = entry?.sourceGroup === 'discovered_evidence' || entry?.sourceGroup === 'side_investigation';
    if (!entry || (!dynamicEntry && !room.workstation[role].unlockedEntryIds.includes(entryId))) {
    throw Object.assign(new Error('Entry is locked or not visible'), { code: 'ENTRY_LOCKED', status: 423 });
  }
  const ws = room.workstation[role];
  if (ws.openedEntryIds.includes(entryId)) return { stateChanged: false, entry: displayEntry(entry, true) };
  ws.openedEntryIds.push(entryId);
  if (room.workstation.A.openedEntryIds.includes('doc.a_solo_protocol')
    && room.workstation.B.openedEntryIds.includes('doc.b_solo_protocol')) {
    if (!room.publicFacts.includes('soloProtocolsReady')) room.publicFacts.push('soloProtocolsReady');
  }
  refreshWorkstation(room);
  refreshPrivateMissions(room);
  return { stateChanged: true, entry: displayEntry(entry, true) };
}

function applyEffects(room, role, operation, overrides = {}) {
  const effects = { ...(operation.effects || {}), ...overrides };
  for (const fact of effects.publicFacts || []) if (!room.publicFacts.includes(fact)) room.publicFacts.push(fact);
  for (const fact of effects.roleFacts || []) if (!room.workstation[role].roleFacts.includes(fact)) room.workstation[role].roleFacts.push(fact);
  const nodes = operation.kind === 'private'
    ? (room.workstation[role].completedNodes ??= [])
    : (room.completedNodes ??= []);
  for (const node of effects.completeNodeIds || []) if (!nodes.includes(node)) nodes.push(node);
  for (const id of effects.unlockEntryIds || []) {
    for (const targetRole of ROLES) {
      if (audienceAllows(terminalEntries.find(entry => entry.id === id) || {}, targetRole)
        && !room.workstation[targetRole].unlockedEntryIds.includes(id)) room.workstation[targetRole].unlockedEntryIds.push(id);
    }
  }
}

function executeOperation(room, player, operationId, value, options = {}) {
  const role = assertPlayer(room, player);
  ensureRoom(room);
  refreshWorkstation(room);
  const operation = operations.find(item => item.operationId === operationId);
  if (!operation || (operationId !== 'open_entry' && !room.workstation[role].activeOperations.includes(operationId))) {
    throw Object.assign(new Error('Operation is locked'), { code: 'OPERATION_LOCKED', status: 423 });
  }
  if (operationId === 'pair_validate_protocol' && !room.publicFacts.includes('soloProtocolsReady')) {
    throw Object.assign(new Error('Operation is locked'), { code: 'OPERATION_LOCKED', status: 423 });
  }
  const ws = room.workstation[role];
  if (operationId === 'open_entry') {
    const entryId = typeof value === 'string' ? value : '';
    const entry = allEntries(room).find(item => item.id === entryId);
    const dynamicEntry = entry?.sourceGroup === 'discovered_evidence' || entry?.sourceGroup === 'side_investigation';
    if (!entry || (!dynamicEntry && !ws.unlockedEntryIds.includes(entryId))) {
      throw Object.assign(new Error('Entry is locked or not visible'), { code: 'ENTRY_LOCKED', status: 423 });
    }
    if (ws.openedEntryIds.includes(entryId)) return { stateChanged: false, operationId, value };
    ws.openedEntryIds.push(entryId);
    ws.actionAttempts.push(operationId);
    if (room.workstation.A.openedEntryIds.includes('doc.a_solo_protocol')
      && room.workstation.B.openedEntryIds.includes('doc.b_solo_protocol')) {
      if (!room.publicFacts.includes('soloProtocolsReady')) room.publicFacts.push('soloProtocolsReady');
    }
    refreshWorkstation(room);
    refreshPrivateMissions(room);
    return { stateChanged: true, operationId, value };
  }
  if (operation.kind === 'mainline' && operationId !== 'verify_incident_timestamp'
    && room.completedOperations.includes(operationId)) {
    return { stateChanged: false, operationId, value };
  }
  if (operationId !== 'verify_incident_timestamp' && ws.completedOperations.includes(operationId)) {
    return { stateChanged: false, operationId, value };
  }
  room.actionAttempts.push(operationId);
  ws.actionAttempts.push(operationId);
  if (!options.skipEffects) {
    const overrides = operation.kind === 'neutral_finale'
      ? { completeNodeIds: [`finaleCommitted.${role}`,
          ...(Object.values(room.finaleCommittedByRole || {}).some(Boolean) ? ['endingCommitted'] : [])] }
      : {};
    applyEffects(room, role, operation, overrides);
  }
  if (operation.kind === 'mainline' && operationId !== 'verify_incident_timestamp'
    && !room.completedOperations.includes(operationId)) room.completedOperations.push(operationId);
  if (!ws.completedOperations.includes(operationId) && operationId !== 'verify_incident_timestamp') ws.completedOperations.push(operationId);
  refreshWorkstation(room);
  refreshPrivateMissions(room);
  return { stateChanged: true, operationId, value };
}

module.exports = {
  ensureRoom,
  refreshWorkstation,
  projectWorkstation,
  openEntry,
  executeOperation,
  executeTerminalCommand,
  parseTerminalCommand,
  assertPlayer,
  audienceAllows
};
