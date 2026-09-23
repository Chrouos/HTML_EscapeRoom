const fs = require('node:fs');

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Expected pattern not found in ${path}: ${from.slice(0, 120)}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Pattern not unique in ${path}: ${from.slice(0, 120)}`);
  fs.writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length));
}

replaceOnce(
  'game/privateEventEngine.js',
  "const { createDialogueState } = require('./createRoomState');",
  "const { createDialogueState, createNarrativeBehaviorState } = require('./createRoomState');"
);

replaceOnce(
  'game/privateEventEngine.js',
  `function normalizeRole(player) {\n  const role = typeof player === 'string' ? player : player?.role;\n  return ROLES.includes(role) ? role : null;\n}\n\nfunction ensureDialogueState(room) {`,
  `function normalizeRole(player) {\n  const role = typeof player === 'string' ? player : player?.role;\n  return ROLES.includes(role) ? role : null;\n}\n\nfunction finiteMap(value, predicate) {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};\n  const result = {};\n  for (const [key, item] of Object.entries(value)) {\n    if (typeof key === 'string' && key && predicate(item)) result[key] = item;\n  }\n  return result;\n}\n\nfunction stringList(value) {\n  if (!Array.isArray(value)) return [];\n  return [...new Set(value.filter(item => typeof item === 'string' && item.trim()))];\n}\n\nfunction ensureNarrativeBehavior(room, now = Date.now()) {\n  if (!room || typeof room !== 'object') throw new TypeError('Room is required');\n  const fallback = Number.isFinite(room.createdAt) && room.createdAt >= 0\n    ? room.createdAt : (Number.isFinite(now) && now >= 0 ? now : 0);\n  const defaults = createNarrativeBehaviorState(fallback);\n  const current = room.narrativeBehavior && typeof room.narrativeBehavior === 'object'\n    && !Array.isArray(room.narrativeBehavior) ? room.narrativeBehavior : {};\n  const next = createNarrativeBehaviorState(fallback);\n\n  for (const role of ROLES) {\n    next.entryOpenCount[role] = finiteMap(current.entryOpenCount?.[role],\n      value => Number.isSafeInteger(value) && value >= 0);\n    const lastAction = current.lastMeaningfulActionAt?.[role];\n    next.lastMeaningfulActionAt[role] = Number.isFinite(lastAction) && lastAction >= 0\n      ? lastAction : defaults.lastMeaningfulActionAt[role];\n    const pending = current.pendingObservation?.[role];\n    next.pendingObservation[role] = typeof pending === 'string' && pending.trim() ? pending : null;\n    next.sharedEvidenceIds[role] = stringList(current.sharedEvidenceIds?.[role]);\n    next.ignoredPromptIds[role] = stringList(current.ignoredPromptIds?.[role]);\n    next.reactionFactIds[role] = stringList(current.reactionFactIds?.[role]);\n    next.lastReactionAt[role] = finiteMap(current.lastReactionAt?.[role],\n      value => Number.isFinite(value) && value >= 0);\n  }\n\n  room.narrativeBehavior = next;\n  return next;\n}\n\nfunction ensureDialogueState(room) {`
);

replaceOnce(
  'game/privateEventEngine.js',
  `function predicateState(room, role) {\n  const workstation = room.workstation?.[role] || {};\n  return {\n    chapter: room.chapter,\n    publicFacts: Array.isArray(room.publicFacts) ? room.publicFacts : [],\n    role,\n    roleFacts: { A: roleFacts(room, 'A'), B: roleFacts(room, 'B') },\n    openedEntryIds: Array.isArray(workstation.openedEntryIds) ? workstation.openedEntryIds : [],\n    actionIds: [\n      ...(Array.isArray(room.actionAttempts) ? room.actionAttempts : []),\n      ...(Array.isArray(workstation.actionAttempts) ? workstation.actionAttempts : [])\n    ]\n  };\n}`,
  `function predicateState(room, role, now = Date.now()) {\n  const workstation = room.workstation?.[role] || {};\n  const behavior = ensureNarrativeBehavior(room, now);\n  return {\n    chapter: room.chapter,\n    publicFacts: Array.isArray(room.publicFacts) ? room.publicFacts : [],\n    role,\n    roleFacts: { A: roleFacts(room, 'A'), B: roleFacts(room, 'B') },\n    openedEntryIds: Array.isArray(workstation.openedEntryIds) ? workstation.openedEntryIds : [],\n    actionIds: [\n      ...(Array.isArray(room.actionAttempts) ? room.actionAttempts : []),\n      ...(Array.isArray(workstation.actionAttempts) ? workstation.actionAttempts : [])\n    ],\n    entryOpenCount: behavior.entryOpenCount[role],\n    lastMeaningfulActionAt: behavior.lastMeaningfulActionAt[role],\n    reactionFactIds: behavior.reactionFactIds[role],\n    now\n  };\n}`
);

replaceOnce(
  'game/privateEventEngine.js',
  `  ensureDialogueState,\n  resolveSeed,`,
  `  ensureDialogueState,\n  ensureNarrativeBehavior,\n  resolveSeed,`
);

replaceOnce(
  'game/content/validateContent.js',
  `  for (const key of PREDICATES) {\n    if (predicate[key] !== undefined && !['string', 'number'].includes(typeof predicate[key])) errors.push(\`${'${path}.${key}'} must be a string or number\`);\n  }`,
  `  if (predicate.entryOpenedTimes !== undefined) {\n    const value = predicate.entryOpenedTimes;\n    if (!value || typeof value !== 'object' || Array.isArray(value)) {\n      errors.push(\`${'${path}'}.entryOpenedTimes must be an object\`);\n    } else {\n      if (typeof value.entryId !== 'string' || !value.entryId.trim()) errors.push(\`${'${path}'}.entryOpenedTimes.entryId must be non-empty\`);\n      if (!Number.isSafeInteger(value.atLeast) || value.atLeast < 1) errors.push(\`${'${path}'}.entryOpenedTimes.atLeast must be an integer >= 1\`);\n      if (Object.keys(value).some(key => !['entryId', 'atLeast'].includes(key))) errors.push(\`${'${path}'}.entryOpenedTimes has invalid fields\`);\n    }\n  }\n  if (predicate.elapsedSinceMeaningfulAction !== undefined\n    && (!Number.isFinite(predicate.elapsedSinceMeaningfulAction) || predicate.elapsedSinceMeaningfulAction < 0)) {\n    errors.push(\`${'${path}'}.elapsedSinceMeaningfulAction must be a non-negative number\`);\n  }\n  if (predicate.reactionFactMissing !== undefined\n    && (typeof predicate.reactionFactMissing !== 'string' || !predicate.reactionFactMissing.trim())) {\n    errors.push(\`${'${path}'}.reactionFactMissing must be a non-empty string\`);\n  }\n  for (const key of PREDICATES.filter(key => !['entryOpenedTimes', 'elapsedSinceMeaningfulAction', 'reactionFactMissing'].includes(key))) {\n    if (predicate[key] !== undefined && !['string', 'number'].includes(typeof predicate[key])) errors.push(\`${'${path}.${key}'} must be a string or number\`);\n  }`
);

replaceOnce(
  'game/content/validateContent.js',
  `  // Role facts, opened entries and attempted actions are player-controlled and may be reached.\n  if (predicate.roleFact !== undefined || predicate.entryOpened !== undefined || predicate.actionAttempted !== undefined) return true;`,
  `  // Role facts, opened entries, attempted actions, and narrative behavior are player-driven and may be reached.\n  if (predicate.roleFact !== undefined || predicate.entryOpened !== undefined || predicate.actionAttempted !== undefined\n    || predicate.entryOpenedTimes !== undefined || predicate.elapsedSinceMeaningfulAction !== undefined\n    || predicate.reactionFactMissing !== undefined) return true;`
);

replaceOnce(
  'game/content/validateContent.js',
  `  // Entry discovery and role rapport are player-controlled decisions. They\n  // are possible whenever the operation itself is reachable.\n  if (predicate.roleFact !== undefined || predicate.entryOpened !== undefined) return true;`,
  `  // Entry discovery, role rapport, and narrative behavior are player-controlled decisions.\n  // They are possible whenever the operation itself is reachable.\n  if (predicate.roleFact !== undefined || predicate.entryOpened !== undefined\n    || predicate.entryOpenedTimes !== undefined || predicate.elapsedSinceMeaningfulAction !== undefined\n    || predicate.reactionFactMissing !== undefined) return true;`
);

replaceOnce(
  'game/content/validateContent.js',
  `    if (operation.kind === 'mainline' && predicateContainsRoleFact(operation.unlockWhen)) errors.push(\`mainline operation ${'${operation.operationId}'} depends on private role fact\`);`,
  `    if (operation.kind === 'mainline' && predicateContainsRoleFact(operation.unlockWhen)) errors.push(\`mainline operation ${'${operation.operationId}'} depends on private role fact\`);\n    if (operation.kind === 'mainline' && predicateContainsBehavior(operation.unlockWhen)) errors.push(\`mainline operation ${'${operation.operationId}'} depends on behavior predicate\`);`
);

replaceOnce(
  'game/content/validateContent.js',
  `function predicateReferencesPrivateEntry(predicate, entries) {`,
  `function predicateContainsBehavior(predicate) {\n  if (!predicate || typeof predicate !== 'object') return false;\n  if (predicate.entryOpenedTimes !== undefined || predicate.elapsedSinceMeaningfulAction !== undefined\n    || predicate.reactionFactMissing !== undefined) return true;\n  if (Array.isArray(predicate.all) && predicate.all.some(predicateContainsBehavior)) return true;\n  if (Array.isArray(predicate.any) && predicate.any.some(predicateContainsBehavior)) return true;\n  return predicate.not !== undefined && predicateContainsBehavior(predicate.not);\n}\n\nfunction predicateReferencesPrivateEntry(predicate, entries) {`
);

replaceOnce(
  'game/content/validateContent.js',
  `  predicateContainsRoleFact, predicateReferencesPrivateEntry, predicateReferencesPrivateAction };`,
  `  predicateContainsRoleFact, predicateContainsBehavior, predicateReferencesPrivateEntry, predicateReferencesPrivateAction };`
);

fs.unlinkSync(__filename);
