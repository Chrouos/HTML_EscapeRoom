const { createHash } = require('node:crypto');

const { dialogue } = require('./content/dialogue');
const { privateMissions } = require('./content/privateMissions');
const { operations } = require('./content/operations');
const { evaluatePredicate } = require('./content/contentSchema');
const { createDialogueState, createNarrativeBehaviorState } = require('./createRoomState');

const ROLES = Object.freeze(['A', 'B']);
const PRESSURE_INTENTS = new Set(['manipulation', 'private_task']);
const PUBLIC_INTENTS = new Set(['system', 'common_task']);
const DIRECT_INTENTS = new Set(['rapport', 'observation', 'manipulation', 'private_task']);
const COOPERATIVE_OPERATIONS = new Set([
  'share_roster', 'share_mirror_first', 'warn_partner_first',
  'request_pair_validation', 'disclose_report', 'pair_validate_protocol'
]);
const SOLO_OPERATIONS = new Set(['request_solo_validation']);
const IDLE_THRESHOLD_MS = 60_000;
const IDLE_COOLDOWN_MS = 120_000;
const MAX_IDLE_OBSERVATIONS = 2;

const MISSION_OUTCOMES = new Set(['completed', 'declined', 'skipped', 'failed']);
const MISSION_STATES = new Set(['locked', 'available', 'resolved']);

function missionForOperation(operationId) {
  return privateMissions.find(item => item.operationIds.includes(operationId)) || null;
}

function missionPredicateState(room, role) {
  const workstation = room.workstation?.[role] || {};
  const roleFactList = targetRole => {
    const ws = room.workstation?.[targetRole] || {};
    const direct = room.directDialogueState?.[targetRole] || {};
    const facts = new Set(Array.isArray(ws.roleFacts) ? ws.roleFacts : []);
    if (Number(direct.rapportCount) >= 1) facts.add('rapportReady');
    if (Number(direct.rapportCount) >= 2) facts.add('rapportCount2');
    if (Number(direct.rapportSincePressure) >= 1) facts.add('rapportSincePressure');
    return [...facts];
  };
  return {
    chapter: room.chapter,
    publicFacts: Array.isArray(room.publicFacts) ? room.publicFacts : [],
    role,
    roleFacts: { A: roleFactList('A'), B: roleFactList('B') },
    openedEntryIds: Array.isArray(workstation.openedEntryIds) ? workstation.openedEntryIds : [],
    actionIds: [...(Array.isArray(workstation.actionAttempts) ? workstation.actionAttempts : [])]
  };
}

function ensurePrivateMissions(room) {
  if (!room || typeof room !== 'object') throw new TypeError('Room is required');
  room.privateMissions ??= {};
  for (const role of ROLES) {
    const existing = Array.isArray(room.privateMissions[role]) ? room.privateMissions[role] : [];
    const byId = new Map(existing.map(item => [item.id, item]));
    room.privateMissions[role] = privateMissions.filter(item => item.role === role).map(item => {
      const previous = byId.get(item.id);
      const state = MISSION_STATES.has(previous?.state) ? previous.state : 'locked';
      return {
        id: item.id,
        missionId: item.missionId,
        role: item.role,
        state,
        outcome: state === 'resolved' ? (previous.outcome || null) : null,
        operationId: state === 'resolved' ? (previous.operationId || null) : null,
        sourceEntryId: item.sourceEntryId,
        operationIds: [...item.operationIds],
        mainlineFallbackOperationIds: [...item.mainlineFallbackOperationIds],
        debriefFactIds: [...item.debriefFactIds]
      };
    });
  }
  return room.privateMissions;
}

function refreshPrivateMissions(room) {
  ensurePrivateMissions(room);
  for (const role of ROLES) {
    for (const mission of room.privateMissions[role]) {
      if (mission.state !== 'locked') continue;
      const definition = privateMissions.find(item => item.id === mission.id);
      if (definition && evaluatePredicate(definition.unlockWhen, missionPredicateState(room, role))) {
        mission.state = 'available';
      }
    }
  }
  return room.privateMissions;
}

function resolvePrivateMission(room, role, missionId, outcome = 'completed', operationId = null) {
  if (role && typeof role === 'object') role = role.role;
  if (!ROLES.includes(role)) throw Object.assign(new Error('Invalid player role'), { code: 'INVALID_PLAYER', status: 400 });
  if (!MISSION_OUTCOMES.has(outcome)) throw Object.assign(new Error('Invalid mission outcome'), { code: 'INVALID_OUTCOME', status: 400 });
  refreshPrivateMissions(room);
  const mission = room.privateMissions[role].find(item => item.id === missionId);
  if (!mission) throw Object.assign(new Error('Mission is not assigned to this player'), { code: 'MISSION_NOT_FOUND', status: 404 });
  if (mission.state === 'resolved') {
    if (mission.outcome === outcome && (!operationId || mission.operationId === operationId)) return { stateChanged: false, mission };
    throw Object.assign(new Error('Mission is already resolved'), { code: 'MISSION_RESOLVED', status: 423 });
  }
  if (mission.state !== 'available') throw Object.assign(new Error('Mission is locked'), { code: 'MISSION_LOCKED', status: 423 });
  mission.state = 'resolved';
  mission.outcome = outcome;
  mission.operationId = operationId;
  const workstation = room.workstation?.[role] || (room.workstation = { ...(room.workstation || {}), [role]: { roleFacts: [], completedNodes: [] } })[role];
  workstation.roleFacts ??= [];
  workstation.completedNodes ??= [];
  if (outcome === 'skipped' && !operationId) {
    const skipOperation = operations.find(item => item.kind === 'private'
      && item.operationId.startsWith('skip_') && item.operationId.endsWith(mission.missionId.slice(0, 2)));
    for (const fact of skipOperation?.effects?.roleFacts || []) if (!workstation.roleFacts.includes(fact)) workstation.roleFacts.push(fact);
    for (const node of skipOperation?.effects?.completeNodeIds || []) if (!workstation.completedNodes.includes(node)) workstation.completedNodes.push(node);
  }
  if (outcome === 'failed' && operationId) {
    const failedFact = `${operationId}Failed`;
    if (!workstation.roleFacts.includes(failedFact)) workstation.roleFacts.push(failedFact);
  }
  return { stateChanged: true, mission };
}

function roleName(role) {
  return role === 'A' ? 'host' : 'guest';
}

function normalizeRole(player) {
  const role = typeof player === 'string' ? player : player?.role;
  return ROLES.includes(role) ? role : null;
}

function finiteMap(value, predicate) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof key === 'string' && key && predicate(item)) result[key] = item;
  }
  return result;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === 'string' && item.trim()))];
}

function ensureNarrativeBehavior(room, now = Date.now()) {
  if (!room || typeof room !== 'object') throw new TypeError('Room is required');
  const fallback = Number.isFinite(room.createdAt) && room.createdAt >= 0
    ? room.createdAt : (Number.isFinite(now) && now >= 0 ? now : 0);
  const defaults = createNarrativeBehaviorState(fallback);
  const current = room.narrativeBehavior && typeof room.narrativeBehavior === 'object'
    && !Array.isArray(room.narrativeBehavior) ? room.narrativeBehavior : {};
  const next = createNarrativeBehaviorState(fallback);

  for (const role of ROLES) {
    next.entryOpenCount[role] = finiteMap(current.entryOpenCount?.[role],
      value => Number.isSafeInteger(value) && value >= 0);
    const lastAction = current.lastMeaningfulActionAt?.[role];
    next.lastMeaningfulActionAt[role] = Number.isFinite(lastAction) && lastAction >= 0
      ? lastAction : defaults.lastMeaningfulActionAt[role];
    const pending = current.pendingObservation?.[role];
    next.pendingObservation[role] = typeof pending === 'string' && pending.trim() ? pending : null;
    next.sharedEvidenceIds[role] = stringList(current.sharedEvidenceIds?.[role]);
    next.ignoredPromptIds[role] = stringList(current.ignoredPromptIds?.[role]);
    next.reactionFactIds[role] = stringList(current.reactionFactIds?.[role]);
    next.lastReactionAt[role] = finiteMap(current.lastReactionAt?.[role],
      value => Number.isFinite(value) && value >= 0);
  }

  room.narrativeBehavior = next;
  return next;
}

function recordNarrativeBehavior(room, role, trigger = {}, now = Date.now()) {
  const normalized = normalizeRole(role);
  if (!normalized) return ensureNarrativeBehavior(room, now);
  const behavior = ensureNarrativeBehavior(room, now);
  if (typeof trigger.entryOpened === 'string' && trigger.entryOpened) {
    const counts = behavior.entryOpenCount[normalized];
    counts[trigger.entryOpened] = (counts[trigger.entryOpened] || 0) + 1;
  }
  if (trigger.meaningful === true && Number.isFinite(now) && now >= 0) {
    behavior.lastMeaningfulActionAt[normalized] = now;
  }
  return behavior;
}

function ensureDialogueState(room) {
  if (!room || typeof room !== 'object') throw new TypeError('Room is required');
  const defaults = createDialogueState();
  if (!room.publicDialogueState || typeof room.publicDialogueState !== 'object') {
    room.publicDialogueState = defaults.publicDialogueState;
  }
  room.directDialogueState ??= {};
  for (const role of ROLES) {
    const current = room.directDialogueState[role];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      room.directDialogueState[role] = {
        rapportCount: 0,
        rapportSincePressure: 0,
        lastIntent: null,
        deliveredContentIds: []
      };
      continue;
    }
    current.rapportCount = Number.isSafeInteger(current.rapportCount) && current.rapportCount >= 0
      ? current.rapportCount : 0;
    current.rapportSincePressure = Number.isSafeInteger(current.rapportSincePressure)
      && current.rapportSincePressure >= 0 ? current.rapportSincePressure : 0;
    current.lastIntent = typeof current.lastIntent === 'string' ? current.lastIntent : null;
    if (!Array.isArray(current.deliveredContentIds)) current.deliveredContentIds = [];
  }
  if (!Array.isArray(room.publicDialogueState.deliveredContentIds)) {
    room.publicDialogueState.deliveredContentIds = [];
  }
  return room.directDialogueState;
}

function resolveSeed(roomCode, playerId, contentId) {
  if (contentId === undefined) {
    contentId = playerId;
    return `${String(roomCode)}:broadcast:${String(contentId)}`;
  }
  return `${String(roomCode)}:${String(playerId)}:${String(contentId)}`;
}

function digestIndex(seed, length) {
  if (!length) return 0;
  const digest = createHash('sha256').update(Buffer.from(seed, 'utf8')).digest();
  return digest.readUInt32BE(0) % length;
}

function roleFacts(room, role) {
  const workstationFacts = room.workstation?.[role]?.roleFacts;
  const facts = new Set(Array.isArray(workstationFacts) ? workstationFacts : []);
  const state = room.directDialogueState[role];
  if (state.rapportCount >= 1) facts.add('rapportReady');
  if (state.rapportCount >= 2) facts.add('rapportCount2');
  if (state.rapportSincePressure >= 1) facts.add('rapportSincePressure');
  return [...facts];
}

function predicateState(room, role, now = Date.now()) {
  const workstation = room.workstation?.[role] || {};
  const behavior = ensureNarrativeBehavior(room, now);
  return {
    chapter: room.chapter,
    publicFacts: Array.isArray(room.publicFacts) ? room.publicFacts : [],
    role,
    roleFacts: { A: roleFacts(room, 'A'), B: roleFacts(room, 'B') },
    openedEntryIds: Array.isArray(workstation.openedEntryIds) ? workstation.openedEntryIds : [],
    actionIds: [
      ...(Array.isArray(room.actionAttempts) ? room.actionAttempts : []),
      ...(Array.isArray(workstation.actionAttempts) ? workstation.actionAttempts : [])
    ],
    entryOpenCount: behavior.entryOpenCount[role],
    lastMeaningfulActionAt: behavior.lastMeaningfulActionAt[role],
    reactionFactIds: behavior.reactionFactIds[role],
    now
  };
}

function audienceMatches(item, role) {
  if (item.audience?.kind === 'both') return true;
  return item.audience?.kind === 'role' && item.audience.role === roleName(role);
}

function hasDelivered(room, role, id) {
  const state = role ? room.directDialogueState[role] : room.publicDialogueState;
  return state.deliveredContentIds.includes(id);
}

function eligibleDialogue(room, role, intent, now = Date.now()) {
  ensureDialogueState(room);
  const direct = Boolean(role);
  return dialogue.filter(item => {
    if (item.triggerOnly) return false;
    if (intent && item.intent !== intent) return false;
    if (direct) {
      if (item.channel !== 'direct' || !DIRECT_INTENTS.has(item.intent)) return false;
      if (!audienceMatches(item, role)) return false;
      if (!room.publicFacts?.includes('main1Completed')) return false;
      if (!item.repeatable && hasDelivered(room, role, item.id)) return false;
      if (!evaluatePredicate(item.unlockWhen || { all: [] }, predicateState(room, role, now))) return false;
      const state = room.directDialogueState[role];
      if (PRESSURE_INTENTS.has(item.intent)) {
        if (state.lastIntent && PRESSURE_INTENTS.has(state.lastIntent)) return false;
        if (state.rapportCount < 2 || state.rapportSincePressure < 1) return false;
      }
      return true;
    }
    if (item.channel !== 'broadcast' || !PUBLIC_INTENTS.has(item.intent)) return false;
    if (item.audience?.kind !== 'both') return false;
    if (!item.repeatable && hasDelivered(room, null, item.id)) return false;
    return evaluatePredicate(item.unlockWhen || { all: [] }, predicateState(room, 'A', now));
  });
}

function selectDialogue(room, role, intent, now = Date.now()) {
  ensureDialogueState(room);
  const directRole = normalizeRole(role);
  const pool = eligibleDialogue(room, directRole, intent, now);
  if (!pool.length) return null;
  const playerId = directRole ? room.players?.[directRole]?.playerId : null;
  const seed = directRole
    ? resolveSeed(room.roomCode, playerId || directRole, pool[0].id)
    : resolveSeed(room.roomCode, pool[0].id);
  return pool[digestIndex(seed, pool.length)];
}

function selectDialogueById(room, role, id, now = Date.now()) {
  ensureDialogueState(room);
  const directRole = normalizeRole(role);
  if (!directRole) return null;
  const item = dialogue.find(candidate => candidate.id === id);
  if (!item || item.channel !== 'direct' || item.intent !== 'observation') return null;
  if (!audienceMatches(item, directRole)) return null;
  if (!room.publicFacts?.includes('main1Completed')) return null;
  if (!item.repeatable && hasDelivered(room, directRole, item.id)) return null;
  if (!evaluatePredicate(item.unlockWhen || { all: [] }, predicateState(room, directRole, now))) return null;
  return item;
}

function resolveText(room, item, role) {
  const variants = Array.isArray(item.variants) && item.variants.length ? item.variants : ['ORPHEUS'];
  const playerId = role ? room.players?.[role]?.playerId || role : null;
  const seed = role
    ? resolveSeed(room.roomCode, playerId, item.id)
    : resolveSeed(room.roomCode, item.id);
  return variants[digestIndex(seed, variants.length)];
}

function projectDialogueEvent(item, audience, text) {
  return {
    contentId: item.id,
    type: 'system',
    text: text === undefined ? item.variants?.[0] || 'ORPHEUS' : text,
    audience: structuredClone(audience)
  };
}

function markDelivered(room, role, item, now = Date.now()) {
  const state = role ? room.directDialogueState[role] : room.publicDialogueState;
  if (!state.deliveredContentIds.includes(item.id)) state.deliveredContentIds.push(item.id);
  if (!role) return;
  if (item.id.startsWith('echo.behavior.')) {
    const behavior = ensureNarrativeBehavior(room, now);
    if (!behavior.reactionFactIds[role].includes(item.id)) behavior.reactionFactIds[role].push(item.id);
    behavior.lastReactionAt[role][item.id] = now;
  }
  state.lastIntent = item.intent;
  if (item.intent === 'rapport') {
    state.rapportCount += 1;
    state.rapportSincePressure += 1;
  } else if (PRESSURE_INTENTS.has(item.intent)) {
    state.rapportSincePressure = 0;
  }
}

function emitSelected(room, item, role, events, now = Date.now()) {
  if (!item) return null;
  const audience = role ? { kind: 'role', role: roleName(role) } : { kind: 'both' };
  const event = projectDialogueEvent(item, audience, resolveText(room, item, role));
  markDelivered(room, role, item, now);
  if (events) events.push(event);
  return event;
}

function emitPublic(room, intent, events, now = Date.now()) {
  const item = selectDialogue(room, null, intent, now);
  return emitSelected(room, item, null, events, now);
}

function emitDirect(room, role, intent, events, now = Date.now()) {
  if (!normalizeRole(role)) return null;
  return emitSelected(room, selectDialogue(room, role, intent, now), role, events, now);
}

function emitDirectById(room, role, id, events, now = Date.now()) {
  return emitSelected(room, selectDialogueById(room, role, id, now), role, events, now);
}

function triggerDialogue(room, trigger = {}, pendingEvents = []) {
  ensureDialogueState(room);
  const beforeEvents = pendingEvents.length;
  // Dialogue and workstation triggers share the same deterministic mission
  // predicates; refresh here so callers that only dispatch a trigger still
  // observe the lifecycle transition in the same transaction.
  refreshPrivateMissions(room);
  const role = normalizeRole(trigger.role || trigger.player);
  const operationId = trigger.operationId;
  const entryOpened = trigger.entryOpened;
  const now = Number.isFinite(trigger.now) && trigger.now >= 0 ? trigger.now : Date.now();
  let behaviorChanged = false;
  if (role && (entryOpened || trigger.meaningful === true)) {
    const before = ensureNarrativeBehavior(room, now);
    const beforeCount = entryOpened ? Number(before.entryOpenCount[role][entryOpened] || 0) : null;
    const beforeActionAt = before.lastMeaningfulActionAt[role];
    const after = recordNarrativeBehavior(room, role, trigger, now);
    behaviorChanged = (entryOpened && Number(after.entryOpenCount[role][entryOpened] || 0) !== beforeCount)
      || (trigger.meaningful === true && after.lastMeaningfulActionAt[role] !== beforeActionAt);
  }
  if (role && entryOpened) {
    room.workstation ??= {};
    room.workstation[role] ??= { openedEntryIds: [], roleFacts: [], actionAttempts: [] };
    const workstation = room.workstation[role];
    if (!Array.isArray(workstation.openedEntryIds)) workstation.openedEntryIds = [];
    if (!Array.isArray(workstation.roleFacts)) workstation.roleFacts = [];
    if (!Array.isArray(workstation.actionAttempts)) workstation.actionAttempts = [];
    if (!workstation.openedEntryIds.includes(entryOpened)) workstation.openedEntryIds.push(entryOpened);
  }

  // Operation events are the only public cadence source. These three lines are
  // deliberately tied to room lifecycle transitions, never a clock.
  if (operationId === 'create_room') emitPublic(room, 'system', pendingEvents, now);
  if (operationId === 'host_join') emitPublic(room, 'common_task', pendingEvents, now);
  if (operationId === 'guest_join') emitPublic(room, 'common_task', pendingEvents, now);
  if (['complete_main2', 'complete_main3', 'complete_main4', 'complete_main5', 'complete_main6'].includes(operationId)) {
    emitPublic(room, 'common_task', pendingEvents, now);
  }
  if (operationId === 'complete_main1') {
    for (const target of ROLES) emitDirect(room, target, 'rapport', pendingEvents, now);
  }

  if (role && entryOpened && (entryOpened === 'files.mainline' || entryOpened === 'files.experiment_roster')) {
    emitDirect(room, role, 'rapport', pendingEvents, now);
  }
  if (role && entryOpened === 'archive.protocol_versions') {
    emitDirect(room, role, 'observation', pendingEvents, now);
  }
  if (role && operationId === 'verify_incident_timestamp') {
    // Give the player space to breathe before another pressure instruction.
    emitDirect(room, role, 'rapport', pendingEvents, now);
  }

  if (role && trigger.intent) emitDirect(room, role, trigger.intent, pendingEvents, now);
  if (role && entryOpened && entryOpened.startsWith('ai.')) emitDirect(room, role, 'private_task', pendingEvents, now);

  const privateOperations = new Set([
    'archive_index', 'flag_identity', 'delete_local_mirror', 'share_mirror_first',
    'pause_local_mirror', 'keep_local_mirror', 'warn_partner_first',
    'request_solo_validation', 'publish_fragment', 'request_pair_validation',
    'file_full_report', 'file_anonymous_summary', 'disclose_report'
  ]);
  if (role && privateOperations.has(operationId)) emitDirect(room, role, 'private_task', pendingEvents, now);

  if (role && COOPERATIVE_OPERATIONS.has(operationId)) {
    const resisted = PRESSURE_INTENTS.has(trigger.previousIntent);
    const suffix = role.toLowerCase();
    emitDirectById(room, role, resisted
      ? `echo.behavior.resist.${suffix}`
      : `echo.behavior.cooperate.${suffix}`, pendingEvents, now);
  } else if (role && SOLO_OPERATIONS.has(operationId)) {
    emitDirectById(room, role, `echo.behavior.solo.${role.toLowerCase()}`, pendingEvents, now);
  }

  refreshPrivateMissions(room);
  return behaviorChanged || pendingEvents.length > beforeEvents;
}

function idleReactionIds(room, role, now = Date.now()) {
  const behavior = ensureNarrativeBehavior(room, now);
  return behavior.reactionFactIds[role].filter(id => id.startsWith('echo.behavior.idle.'));
}

function shouldTriggerIdleObservation(room, role, now = Date.now()) {
  const normalized = normalizeRole(role);
  if (!normalized || !room?.players?.A || !room?.players?.B || room?.ending
    || !room?.publicFacts?.includes('main1Completed')) return false;
  if (!Number.isFinite(now) || now < 0) return false;
  const behavior = ensureNarrativeBehavior(room, now);
  const lastMeaningful = Number(behavior.lastMeaningfulActionAt[normalized]);
  if (!Number.isFinite(lastMeaningful) || now - lastMeaningful < IDLE_THRESHOLD_MS) return false;
  const ids = idleReactionIds(room, normalized, now);
  if (ids.length >= MAX_IDLE_OBSERVATIONS) return false;
  if (ids.length > 0) {
    const lastReaction = Math.max(...ids.map(id => Number(behavior.lastReactionAt[normalized][id] || 0)));
    if (now - lastReaction < IDLE_COOLDOWN_MS) return false;
  }
  return true;
}

function triggerIdleObservation(room, role, now = Date.now(), pendingEvents = []) {
  const normalized = normalizeRole(role);
  if (!normalized || !shouldTriggerIdleObservation(room, normalized, now)) return false;
  ensureDialogueState(room);
  const count = idleReactionIds(room, normalized, now).length + 1;
  const id = `echo.behavior.idle.${count}.${normalized.toLowerCase()}`;
  const text = count === 1
    ? 'ECHO：你停了一段時間。沒有操作也是一種選擇；我不會替你填上答案。'
    : 'ECHO：你又停下來了。這次我仍然只記錄，不替你決定下一步。';
  const item = { id, intent: 'observation', variants: [text] };
  return Boolean(emitSelected(room, item, normalized, pendingEvents, now));
}

// Friendly aliases keep callers decoupled from the cadence name used in the UI.
const scheduleDialogue = triggerDialogue;
const appendDialogueEvents = triggerDialogue;
const resolveBroadcast = (room, item) => projectDialogueEvent(item, { kind: 'both' }, resolveText(room, item));
const resolveDirect = (room, role, item) => projectDialogueEvent(item, { kind: 'role', role: roleName(role) }, resolveText(room, item, role));

module.exports = {
  IDLE_THRESHOLD_MS,
  IDLE_COOLDOWN_MS,
  MISSION_OUTCOMES,
  missionForOperation,
  ensurePrivateMissions,
  refreshPrivateMissions,
  resolvePrivateMission,
  ensureDialogueState,
  ensureNarrativeBehavior,
  recordNarrativeBehavior,
  shouldTriggerIdleObservation,
  triggerIdleObservation,
  resolveSeed,
  eligibleDialogue,
  selectDialogue,
  resolveText,
  projectDialogueEvent,
  resolveBroadcast,
  resolveDirect,
  eligiblePool: eligibleDialogue,
  triggerDialogue,
  handleTrigger: triggerDialogue,
  scheduleDialogue,
  appendDialogueEvents
};
