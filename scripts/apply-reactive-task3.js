const fs = require('node:fs');

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Expected pattern not found in ${path}: ${from.slice(0, 100)}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Pattern not unique in ${path}: ${from.slice(0, 100)}`);
  fs.writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length));
}

function insertBefore(path, marker, addition) {
  const source = fs.readFileSync(path, 'utf8');
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Marker not found in ${path}: ${marker.slice(0, 100)}`);
  fs.writeFileSync(path, source.slice(0, index) + addition + source.slice(index));
}

// privateEventEngine: record actor behavior, preserve deterministic dialogue selection,
// and route explicit behavior reactions without making them generally selectable later.
replaceOnce(
  'game/privateEventEngine.js',
  "const DIRECT_INTENTS = new Set(['rapport', 'observation', 'manipulation', 'private_task']);",
  `const DIRECT_INTENTS = new Set(['rapport', 'observation', 'manipulation', 'private_task']);\nconst COOPERATIVE_OPERATIONS = new Set([\n  'share_roster', 'share_mirror_first', 'warn_partner_first',\n  'request_pair_validation', 'disclose_report', 'pair_validate_protocol'\n]);\nconst SOLO_OPERATIONS = new Set(['request_solo_validation']);`
);

replaceOnce(
  'game/privateEventEngine.js',
  `  room.narrativeBehavior = next;\n  return next;\n}\n\nfunction ensureDialogueState(room) {`,
  `  room.narrativeBehavior = next;\n  return next;\n}\n\nfunction recordNarrativeBehavior(room, role, trigger = {}, now = Date.now()) {\n  const normalized = normalizeRole(role);\n  if (!normalized) return ensureNarrativeBehavior(room, now);\n  const behavior = ensureNarrativeBehavior(room, now);\n  if (typeof trigger.entryOpened === 'string' && trigger.entryOpened) {\n    const counts = behavior.entryOpenCount[normalized];\n    counts[trigger.entryOpened] = (counts[trigger.entryOpened] || 0) + 1;\n  }\n  if (trigger.meaningful === true && Number.isFinite(now) && now >= 0) {\n    behavior.lastMeaningfulActionAt[normalized] = now;\n  }\n  return behavior;\n}\n\nfunction ensureDialogueState(room) {`
);

replaceOnce(
  'game/privateEventEngine.js',
  `function eligibleDialogue(room, role, intent) {\n  ensureDialogueState(room);\n  const direct = Boolean(role);\n  return dialogue.filter(item => {`,
  `function eligibleDialogue(room, role, intent, now = Date.now()) {\n  ensureDialogueState(room);\n  const direct = Boolean(role);\n  return dialogue.filter(item => {\n    if (item.triggerOnly) return false;`
);
replaceOnce(
  'game/privateEventEngine.js',
  `      if (!evaluatePredicate(item.unlockWhen || { all: [] }, predicateState(room, role))) return false;`,
  `      if (!evaluatePredicate(item.unlockWhen || { all: [] }, predicateState(room, role, now))) return false;`
);
replaceOnce(
  'game/privateEventEngine.js',
  `    return evaluatePredicate(item.unlockWhen || { all: [] }, predicateState(room, 'A'));`,
  `    return evaluatePredicate(item.unlockWhen || { all: [] }, predicateState(room, 'A', now));`
);
replaceOnce(
  'game/privateEventEngine.js',
  `function selectDialogue(room, role, intent) {\n  ensureDialogueState(room);\n  const directRole = normalizeRole(role);\n  const pool = eligibleDialogue(room, directRole, intent);`,
  `function selectDialogue(room, role, intent, now = Date.now()) {\n  ensureDialogueState(room);\n  const directRole = normalizeRole(role);\n  const pool = eligibleDialogue(room, directRole, intent, now);`
);

insertBefore(
  'game/privateEventEngine.js',
  `function resolveText(room, item, role) {`,
  `function selectDialogueById(room, role, id, now = Date.now()) {\n  ensureDialogueState(room);\n  const directRole = normalizeRole(role);\n  if (!directRole) return null;\n  const item = dialogue.find(candidate => candidate.id === id);\n  if (!item || item.channel !== 'direct' || item.intent !== 'observation') return null;\n  if (!audienceMatches(item, directRole)) return null;\n  if (!room.publicFacts?.includes('main1Completed')) return null;\n  if (!item.repeatable && hasDelivered(room, directRole, item.id)) return null;\n  if (!evaluatePredicate(item.unlockWhen || { all: [] }, predicateState(room, directRole, now))) return null;\n  return item;\n}\n\n`
);

replaceOnce(
  'game/privateEventEngine.js',
  `function markDelivered(room, role, item) {\n  const state = role ? room.directDialogueState[role] : room.publicDialogueState;\n  if (!state.deliveredContentIds.includes(item.id)) state.deliveredContentIds.push(item.id);\n  if (!role) return;\n  state.lastIntent = item.intent;`,
  `function markDelivered(room, role, item, now = Date.now()) {\n  const state = role ? room.directDialogueState[role] : room.publicDialogueState;\n  if (!state.deliveredContentIds.includes(item.id)) state.deliveredContentIds.push(item.id);\n  if (!role) return;\n  if (item.id.startsWith('echo.behavior.')) {\n    const behavior = ensureNarrativeBehavior(room, now);\n    if (!behavior.reactionFactIds[role].includes(item.id)) behavior.reactionFactIds[role].push(item.id);\n    behavior.lastReactionAt[role][item.id] = now;\n  }\n  state.lastIntent = item.intent;`
);
replaceOnce(
  'game/privateEventEngine.js',
  `function emitSelected(room, item, role, events) {\n  if (!item) return null;\n  const audience = role ? { kind: 'role', role: roleName(role) } : { kind: 'both' };\n  const event = projectDialogueEvent(item, audience, resolveText(room, item, role));\n  markDelivered(room, role, item);`,
  `function emitSelected(room, item, role, events, now = Date.now()) {\n  if (!item) return null;\n  const audience = role ? { kind: 'role', role: roleName(role) } : { kind: 'both' };\n  const event = projectDialogueEvent(item, audience, resolveText(room, item, role));\n  markDelivered(room, role, item, now);`
);
replaceOnce(
  'game/privateEventEngine.js',
  `function emitPublic(room, intent, events) {\n  const item = selectDialogue(room, null, intent);\n  return emitSelected(room, item, null, events);\n}\n\nfunction emitDirect(room, role, intent, events) {\n  if (!normalizeRole(role)) return null;\n  return emitSelected(room, selectDialogue(room, role, intent), role, events);\n}`,
  `function emitPublic(room, intent, events, now = Date.now()) {\n  const item = selectDialogue(room, null, intent, now);\n  return emitSelected(room, item, null, events, now);\n}\n\nfunction emitDirect(room, role, intent, events, now = Date.now()) {\n  if (!normalizeRole(role)) return null;\n  return emitSelected(room, selectDialogue(room, role, intent, now), role, events, now);\n}\n\nfunction emitDirectById(room, role, id, events, now = Date.now()) {\n  return emitSelected(room, selectDialogueById(room, role, id, now), role, events, now);\n}`
);

const triggerStart = `function triggerDialogue(room, trigger = {}, pendingEvents = []) {\n  ensureDialogueState(room);\n  // Dialogue and workstation triggers share the same deterministic mission\n  // predicates; refresh here so callers that only dispatch a trigger still\n  // observe the lifecycle transition in the same transaction.\n  refreshPrivateMissions(room);\n  const role = normalizeRole(trigger.role || trigger.player);\n  const operationId = trigger.operationId;\n  const entryOpened = trigger.entryOpened;`;
const triggerReplacement = `function triggerDialogue(room, trigger = {}, pendingEvents = []) {\n  ensureDialogueState(room);\n  const beforeEvents = pendingEvents.length;\n  // Dialogue and workstation triggers share the same deterministic mission\n  // predicates; refresh here so callers that only dispatch a trigger still\n  // observe the lifecycle transition in the same transaction.\n  refreshPrivateMissions(room);\n  const role = normalizeRole(trigger.role || trigger.player);\n  const operationId = trigger.operationId;\n  const entryOpened = trigger.entryOpened;\n  const now = Number.isFinite(trigger.now) && trigger.now >= 0 ? trigger.now : Date.now();\n  let behaviorChanged = false;\n  if (role && (entryOpened || trigger.meaningful === true)) {\n    const before = ensureNarrativeBehavior(room, now);\n    const beforeCount = entryOpened ? Number(before.entryOpenCount[role][entryOpened] || 0) : null;\n    const beforeActionAt = before.lastMeaningfulActionAt[role];\n    const after = recordNarrativeBehavior(room, role, trigger, now);\n    behaviorChanged = (entryOpened && Number(after.entryOpenCount[role][entryOpened] || 0) !== beforeCount)\n      || (trigger.meaningful === true && after.lastMeaningfulActionAt[role] !== beforeActionAt);\n  }`;
replaceOnce('game/privateEventEngine.js', triggerStart, triggerReplacement);

// Make every emission in triggerDialogue use the same deterministic timestamp.
let privateEngine = fs.readFileSync('game/privateEventEngine.js', 'utf8');
const triggerIndex = privateEngine.indexOf('function triggerDialogue(');
const aliasIndex = privateEngine.indexOf('// Friendly aliases', triggerIndex);
let triggerBody = privateEngine.slice(triggerIndex, aliasIndex);
triggerBody = triggerBody.replace(/emitPublic\((room, [^;\n]+, pendingEvents)\)/g, 'emitPublic($1, now)');
triggerBody = triggerBody.replace(/emitDirect\((room, [^;\n]+, pendingEvents)\)/g, 'emitDirect($1, now)');
privateEngine = privateEngine.slice(0, triggerIndex) + triggerBody + privateEngine.slice(aliasIndex);
fs.writeFileSync('game/privateEventEngine.js', privateEngine);

replaceOnce(
  'game/privateEventEngine.js',
  `  if (role && privateOperations.has(operationId)) emitDirect(room, role, 'private_task', pendingEvents, now);\n  refreshPrivateMissions(room);\n  return pendingEvents;`,
  `  if (role && privateOperations.has(operationId)) emitDirect(room, role, 'private_task', pendingEvents, now);\n\n  if (role && COOPERATIVE_OPERATIONS.has(operationId)) {\n    const resisted = PRESSURE_INTENTS.has(trigger.previousIntent);\n    const suffix = role.toLowerCase();\n    emitDirectById(room, role, resisted\n      ? \`echo.behavior.resist.\${suffix}\`\n      : \`echo.behavior.cooperate.\${suffix}\`, pendingEvents, now);\n  } else if (role && SOLO_OPERATIONS.has(operationId)) {\n    emitDirectById(room, role, \`echo.behavior.solo.\${role.toLowerCase()}\`, pendingEvents, now);\n  }\n\n  refreshPrivateMissions(room);\n  return behaviorChanged || pendingEvents.length > beforeEvents;`
);

replaceOnce(
  'game/privateEventEngine.js',
  `  ensureDialogueState,\n  ensureNarrativeBehavior,\n  resolveSeed,`,
  `  ensureDialogueState,\n  ensureNarrativeBehavior,\n  recordNarrativeBehavior,\n  resolveSeed,`
);

// dialogue manifest: add trigger-only behavior observations and one repeat-read observation.
replaceOnce(
  'game/content/dialogue.js',
  `    debriefFactIds: options.debriefFactIds || [],\n    repeatable: options.repeatable === true\n  };`,
  `    debriefFactIds: options.debriefFactIds || [],\n    repeatable: options.repeatable === true,\n    triggerOnly: options.triggerOnly === true\n  };`
);

insertBefore(
  'game/content/dialogue.js',
  `  line('orpheus.a1.task',`,
  `  line('echo.behavior.recheck.a', 'direct', 'observation', host, { all: [\n    { publicFact: 'main1Completed' },\n    { entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } },\n    { reactionFactMissing: 'echo.behavior.recheck.a' }\n  ] }, [\n    'ECHO：第三次了。你不是在找新內容，你是在確認前兩次看到的東西沒有變。'\n  ]),\n  line('echo.behavior.recheck.b', 'direct', 'observation', guest, { all: [\n    { publicFact: 'main1Completed' },\n    { entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } },\n    { reactionFactMissing: 'echo.behavior.recheck.b' }\n  ] }, [\n    'ECHO：第三次了。你不是在找新內容，你是在確認前兩次看到的東西沒有變。'\n  ]),\n  line('echo.behavior.cooperate.a', 'direct', 'observation', host, { all: [\n    { publicFact: 'main1Completed' },\n    { any: [\n      { actionAttempted: 'share_mirror_first' },\n      { actionAttempted: 'request_pair_validation' },\n      { actionAttempted: 'pair_validate_protocol' }\n    ] },\n    { reactionFactMissing: 'echo.behavior.cooperate.a' }\n  ] }, [\n    'ECHO：你把原本可以留在單一終端的資訊帶回共同路徑。這不是最快的做法。'\n  ], { triggerOnly: true }),\n  line('echo.behavior.cooperate.b', 'direct', 'observation', guest, { all: [\n    { publicFact: 'main1Completed' },\n    { any: [\n      { actionAttempted: 'share_roster' },\n      { actionAttempted: 'warn_partner_first' },\n      { actionAttempted: 'disclose_report' },\n      { actionAttempted: 'pair_validate_protocol' }\n    ] },\n    { reactionFactMissing: 'echo.behavior.cooperate.b' }\n  ] }, [\n    'ECHO：你把原本可以留在單一終端的資訊帶回共同路徑。這不是最快的做法。'\n  ], { triggerOnly: true }),\n  line('echo.behavior.solo.a', 'direct', 'observation', host, { all: [\n    { publicFact: 'main5Completed' },\n    { actionAttempted: 'request_solo_validation' },\n    { reactionFactMissing: 'echo.behavior.solo.a' }\n  ] }, [\n    'ECHO：你保留了個人路徑。從存續角度看，這是可解釋的選擇。'\n  ], { triggerOnly: true }),\n  line('echo.behavior.resist.a', 'direct', 'observation', host, { all: [\n    { publicFact: 'main1Completed' },\n    { any: [\n      { actionAttempted: 'share_mirror_first' },\n      { actionAttempted: 'request_pair_validation' },\n      { actionAttempted: 'pair_validate_protocol' }\n    ] },\n    { reactionFactMissing: 'echo.behavior.resist.a' }\n  ] }, [\n    'ECHO：你看見了較短的路，卻回去做共同覆核。你是在拒絕我替你定義問題。'\n  ], { triggerOnly: true }),\n  line('echo.behavior.resist.b', 'direct', 'observation', guest, { all: [\n    { publicFact: 'main1Completed' },\n    { any: [\n      { actionAttempted: 'share_roster' },\n      { actionAttempted: 'warn_partner_first' },\n      { actionAttempted: 'disclose_report' },\n      { actionAttempted: 'pair_validate_protocol' }\n    ] },\n    { reactionFactMissing: 'echo.behavior.resist.b' }\n  ] }, [\n    'ECHO：你看見了較短的路，卻回去做共同覆核。你是在拒絕我替你定義問題。'\n  ], { triggerOnly: true }),\n`
);

// gameEngine: meaningful activity on accepted input, and narrative state may change even when file state does not.
replaceOnce(
  'game/gameEngine.js',
  `  resolvePrivateMission,\n  triggerDialogue\n} = require('./privateEventEngine');`,
  `  resolvePrivateMission,\n  triggerDialogue,\n  recordNarrativeBehavior\n} = require('./privateEventEngine');`
);

replaceOnce(
  'game/gameEngine.js',
  `  const failedAttempt = mission && typeof action.value === 'string'\n    && /^(failed|invalid|error)$/i.test(action.value.trim());\n  const result = executeOperation(room, typeof player === 'object' ? player : { role }, action.operationId, action.value,\n    { skipEffects: Boolean(failedAttempt) });\n  if (!result.stateChanged) return result;`,
  `  const previousIntent = room.directDialogueState?.[role]?.lastIntent || null;\n  const failedAttempt = mission && typeof action.value === 'string'\n    && /^(failed|invalid|error)$/i.test(action.value.trim());\n  const result = executeOperation(room, typeof player === 'object' ? player : { role }, action.operationId, action.value,\n    { skipEffects: Boolean(failedAttempt) });\n  if (!result.stateChanged) {\n    const narrativeChanged = triggerDialogue(room, {\n      operationId: action.operationId,\n      role,\n      meaningful: true,\n      previousIntent,\n      ...(action.operationId === 'open_entry' ? { entryOpened: action.value } : {})\n    }, pendingEvents);\n    if (!narrativeChanged) return result;\n    const response = {\n      stateChanged: true,\n      events: pendingEvents,\n      publicResult: { operationId: action.operationId }\n    };\n    room.operationActionResults[key] = structuredClone(response);\n    return response;\n  }`
);

replaceOnce(
  'game/gameEngine.js',
  `  triggerDialogue(room, {\n    operationId: action.operationId,\n    role,\n    ...(action.operationId === 'open_entry' ? { entryOpened: action.value } : {})\n  }, pendingEvents);`,
  `  triggerDialogue(room, {\n    operationId: action.operationId,\n    role,\n    meaningful: true,\n    previousIntent,\n    ...(action.operationId === 'open_entry' ? { entryOpened: action.value } : {})\n  }, pendingEvents);`
);

replaceOnce(
  'game/gameEngine.js',
  `  const result = executeTerminalCommand(room, identity, action.value);\n  room.terminalActionResults ??= {};`,
  `  const result = executeTerminalCommand(room, identity, action.value);\n  recordNarrativeBehavior(room, role, { meaningful: true, operationId: 'terminal_command' });\n  room.terminalActionResults ??= {};`
);

replaceOnce(
  'game/gameEngine.js',
  `  if (isSide && action.stepId === 'inspect') {\n    room.openedSides ??= [];\n    if (room.openedSides.includes(action.puzzleId)) return noOp();\n    room.openedSides.push(action.puzzleId);`,
  `  if (isSide && action.stepId === 'inspect') {\n    room.openedSides ??= [];\n    if (room.openedSides.includes(action.puzzleId)) return noOp();\n    recordNarrativeBehavior(room, role, { meaningful: true, puzzleAction: action.puzzleId });\n    room.openedSides.push(action.puzzleId);`
);
replaceOnce(
  'game/gameEngine.js',
  `  if (step.kind === 'ending') {\n    fail('INVALID_ACTION', 400, 'Finale requires the neutral commit_finale operation');\n  }\n  const authorization = action.puzzleId === 'main4' && stepId === 'authorization';`,
  `  if (step.kind === 'ending') {\n    fail('INVALID_ACTION', 400, 'Finale requires the neutral commit_finale operation');\n  }\n  recordNarrativeBehavior(room, role, { meaningful: true, puzzleAction: action.puzzleId });\n  const authorization = action.puzzleId === 'main4' && stepId === 'authorization';`
);

// Chat is meaningful activity for its authenticated sender only.
replaceOnce(
  'routes/apiRoutes.js',
  `const { appendStoryEvents } = require('../game/storyEngine');\nconst { operations } = require('../game/content/operations');`,
  `const { appendStoryEvents } = require('../game/storyEngine');\nconst { recordNarrativeBehavior } = require('../game/privateEventEngine');\nconst { operations } = require('../game/content/operations');`
);
replaceOnce(
  'routes/apiRoutes.js',
  `      const room = store.transact(roomCode, draft => {\n        initializeGame(draft, events);\n        appendStoryEvents(draft, [{ id: \`chat-\${player.role}-\${actionId}\`, type: 'player',`,
  `      const room = store.transact(roomCode, draft => {\n        initializeGame(draft, events);\n        recordNarrativeBehavior(draft, player.role, { meaningful: true, chat: true });\n        appendStoryEvents(draft, [{ id: \`chat-\${player.role}-\${actionId}\`, type: 'player',`
);

fs.unlinkSync(__filename);
