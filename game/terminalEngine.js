const { evaluatePredicate } = require('./content/contentSchema');
const { terminalEntries } = require('./content/terminalEntries');
const { operations } = require('./content/operations');
const { createWorkstationState } = require('./createRoomState');

const ROLES = ['A', 'B'];

function roleOf(player) {
  const role = typeof player === 'string' ? player : player?.role;
  if (!ROLES.includes(role)) throw Object.assign(new Error('Invalid player role'), { code: 'INVALID_PLAYER', status: 400 });
  return role;
}

function assertPlayer(room, player) {
  const role = roleOf(player);
  if (player && typeof player === 'object' && player.playerId !== undefined
    && room.players?.[role]?.playerId !== player.playerId) {
    throw Object.assign(new Error('Player identity does not match room'), { code: 'INVALID_PLAYER', status: 409 });
  }
  return role;
}

function ensureRoom(room) {
  if (!room || typeof room !== 'object') throw new TypeError('Room is required');
  room.publicFacts ??= [];
  room.completedNodes ??= [];
  room.actionAttempts ??= [];
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
  return room;
}

function audienceAllows(entry, role) {
  const audience = entry.audience;
  if (!audience || audience.kind === 'both') return true;
  if (audience.kind === 'role') return (audience.role === 'host' ? 'A' : 'B') === role;
  if (audience.kind === 'player') return false;
  return false;
}

function predicateState(room, role) {
  const ws = room.workstation[role];
  return {
    chapter: room.chapter,
    publicFacts: room.publicFacts,
    role,
    roleFacts: { A: room.workstation.A.roleFacts, B: room.workstation.B.roleFacts },
    openedEntryIds: ws.openedEntryIds,
    actionIds: [...room.actionAttempts, ...ws.actionAttempts]
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
  return { stateChanged: true, entry: displayEntry(entry, true) };
}

function applyEffects(room, role, operation) {
  const effects = operation.effects || {};
  for (const fact of effects.publicFacts || []) if (!room.publicFacts.includes(fact)) room.publicFacts.push(fact);
  for (const fact of effects.roleFacts || []) if (!room.workstation[role].roleFacts.includes(fact)) room.workstation[role].roleFacts.push(fact);
  for (const node of effects.completeNodeIds || []) if (!room.completedNodes.includes(node)) room.completedNodes.push(node);
  for (const id of effects.unlockEntryIds || []) {
    for (const targetRole of ROLES) {
      if (audienceAllows(terminalEntries.find(entry => entry.id === id) || {}, targetRole)
        && !room.workstation[targetRole].unlockedEntryIds.includes(id)) room.workstation[targetRole].unlockedEntryIds.push(id);
    }
  }
}

function executeOperation(room, player, operationId, value) {
  const role = assertPlayer(room, player);
  ensureRoom(room);
  refreshWorkstation(room);
  const operation = operations.find(item => item.operationId === operationId);
  if (!operation || !room.workstation[role].activeOperations.includes(operationId)) {
    throw Object.assign(new Error('Operation is locked'), { code: 'OPERATION_LOCKED', status: 423 });
  }
  const ws = room.workstation[role];
  if (operationId !== 'verify_incident_timestamp' && ws.completedOperations.includes(operationId)) {
    return { stateChanged: false, operationId, value };
  }
  room.actionAttempts.push(operationId);
  ws.actionAttempts.push(operationId);
  if (operationId === 'verify_incident_timestamp') {
    if (!room.publicFacts.includes('incidentVerificationAttempted')) room.publicFacts.push('incidentVerificationAttempted');
    if (!ws.roleFacts.includes('incidentVerificationAttempted')) ws.roleFacts.push('incidentVerificationAttempted');
  }
  applyEffects(room, role, operation);
  if (!ws.completedOperations.includes(operationId) && operationId !== 'verify_incident_timestamp') ws.completedOperations.push(operationId);
  refreshWorkstation(room);
  return { stateChanged: true, operationId, value };
}

module.exports = { ensureRoom, refreshWorkstation, projectWorkstation, openEntry, executeOperation };
