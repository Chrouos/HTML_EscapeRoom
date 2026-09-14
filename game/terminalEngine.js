const { evaluatePredicate } = require('./content/contentSchema');
const { terminalEntries } = require('./content/terminalEntries');
const { operations } = require('./content/operations');
const { createWorkstationState } = require('./createRoomState');
const { refreshPrivateMissions, missionForOperation } = require('./privateEventEngine');

const ROLES = ['A', 'B'];
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

function ensureRoom(room) {
  if (!room || typeof room !== 'object') throw new TypeError('Room is required');
  room.publicFacts ??= [];
  room.completedNodes ??= [];
  room.actionAttempts ??= [];
  room.completedOperations ??= [];
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
  if ((entry.id === 'doc.a_incident_report' || entry.id === 'doc.b_incident_report')
    && !room.publicFacts.includes('main1Completed')) return false;
  return audienceAllows(entry, role)
    && evaluatePredicate(entry.unlockWhen || { all: [] }, predicateState(room, role))
    && hasPrivateFacts(entry, room.workstation[role]);
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
  return evaluatePredicate(operation.unlockWhen || { all: [] }, predicateState(room, role));
}

function refreshWorkstation(room) {
  ensureRoom(room);
  for (const role of ROLES) {
    const ws = room.workstation[role];
    ws.unlockedEntryIds = terminalEntries.filter(entry => entryVisible(room, role, entry)).map(entry => entry.id);
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

function displayEntry(entry, opened) {
  return {
    id: entry.id,
    name: entry.filename || entry.id,
    text: entry.text,
    kind: entry.kind,
    opened: Boolean(opened),
    verificationEntries: (entry.verificationEntries || []).map(item => item.entryId)
  };
}

function projectWorkstation(room, player) {
  const role = assertPlayer(room, player);
  ensureRoom(room);
  refreshWorkstation(room);
  const ws = room.workstation[role];
  const visible = new Set(ws.unlockedEntryIds);
  const opened = new Set(ws.openedEntryIds);
  const buckets = { files: [], terminal: [], logs: [] };
  for (const item of terminalEntries) {
    if (!visible.has(item.id)) continue;
    buckets[appForEntry(item)].push(displayEntry(item, opened.has(item.id)));
  }
  return {
    files: { entries: buckets.files },
    terminal: { entries: buckets.terminal, activeOperations: [...ws.activeOperations] },
    logs: { entries: buckets.logs },
    unlockedEntryIds: [...ws.unlockedEntryIds],
    openedEntryIds: [...ws.openedEntryIds],
    activeOperations: [...ws.activeOperations],
    roleFacts: [...ws.roleFacts]
  };
}

function openEntry(room, player, entryId) {
  const role = assertPlayer(room, player);
  ensureRoom(room);
  refreshWorkstation(room);
  const entry = terminalEntries.find(item => item.id === entryId);
  if (!entry || !room.workstation[role].unlockedEntryIds.includes(entryId)) {
    throw Object.assign(new Error('Entry is locked or not visible'), { code: 'ENTRY_LOCKED', status: 423 });
  }
  const ws = room.workstation[role];
  if (ws.openedEntryIds.includes(entryId)) return { stateChanged: false, entry: displayEntry(entry, true) };
  ws.openedEntryIds.push(entryId);
  refreshWorkstation(room);
  refreshPrivateMissions(room);
  return { stateChanged: true, entry: displayEntry(entry, true) };
}

function applyEffects(room, role, operation) {
  const effects = operation.effects || {};
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
  if (!operation || !room.workstation[role].activeOperations.includes(operationId)) {
    throw Object.assign(new Error('Operation is locked'), { code: 'OPERATION_LOCKED', status: 423 });
  }
  const ws = room.workstation[role];
  if (operationId === 'open_entry') {
    const entryId = typeof value === 'string' ? value : '';
    const entry = terminalEntries.find(item => item.id === entryId);
    if (!entry || !ws.unlockedEntryIds.includes(entryId)) {
      throw Object.assign(new Error('Entry is locked or not visible'), { code: 'ENTRY_LOCKED', status: 423 });
    }
    if (ws.openedEntryIds.includes(entryId)) return { stateChanged: false, operationId, value };
    ws.openedEntryIds.push(entryId);
    ws.actionAttempts.push(operationId);
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
  if (operationId === 'verify_incident_timestamp') {
    if (!room.publicFacts.includes('incidentVerificationAttempted')) room.publicFacts.push('incidentVerificationAttempted');
    if (!ws.roleFacts.includes('incidentVerificationAttempted')) ws.roleFacts.push('incidentVerificationAttempted');
  }
  if (!options.skipEffects) applyEffects(room, role, operation);
  if (operation.kind === 'mainline' && operationId !== 'verify_incident_timestamp'
    && !room.completedOperations.includes(operationId)) room.completedOperations.push(operationId);
  if (!ws.completedOperations.includes(operationId) && operationId !== 'verify_incident_timestamp') ws.completedOperations.push(operationId);
  refreshWorkstation(room);
  refreshPrivateMissions(room);
  return { stateChanged: true, operationId, value };
}

module.exports = { ensureRoom, refreshWorkstation, projectWorkstation, openEntry, executeOperation, audienceAllows };
