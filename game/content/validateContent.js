const { validateAudience } = require('../audience');
const { content: defaultContent, AUDIENCE_KINDS, CHANNELS, INTENTS, OPERATION_KINDS, PREDICATES } = require('./contentSchema');

const DELIVERY_LABEL_RE = /AI_BROADCAST|AI_DIRECT|\bbroadcast\b|\bdirect\b|公開頻道|私人頻道/i;
const REQUIRED_ENTRY_KEYS = ['id', 'sourceEntryId', 'sourceGroup', 'audience', 'unlockWhen', 'verificationEntries', 'requiresPrivateFacts', 'mainlineFallbackOperationIds', 'debriefFactIds'];
const REQUIRED_OPERATION_KEYS = ['operationId', 'kind', 'unlockWhen', 'effects'];

function allStrings(value, path = '') {
  if (typeof value === 'string') return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => allStrings(item, path ? `${path}.${key}` : key));
}

function predicateErrors(predicate, path, errors) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) {
    errors.push(`${path} must be a predicate object`); return;
  }
  const keys = Object.keys(predicate);
  for (const key of keys) {
    if (!['all', 'any', 'not', ...PREDICATES].includes(key)) errors.push(`${path} has invalid predicate ${key}`);
  }
  if (Array.isArray(predicate.all)) predicate.all.forEach((item, i) => predicateErrors(item, `${path}.all[${i}]`, errors));
  else if (predicate.all !== undefined) errors.push(`${path}.all must be an array`);
  if (Array.isArray(predicate.any)) predicate.any.forEach((item, i) => predicateErrors(item, `${path}.any[${i}]`, errors));
  else if (predicate.any !== undefined) errors.push(`${path}.any must be an array`);
  if (predicate.not !== undefined) predicateErrors(predicate.not, `${path}.not`, errors);
  for (const key of PREDICATES) {
    if (predicate[key] !== undefined && !['string', 'number'].includes(typeof predicate[key])) errors.push(`${path}.${key} must be a string or number`);
  }
}

function publicReachable(predicate, facts) {
  if (!predicate || typeof predicate !== 'object') return false;
  if (Array.isArray(predicate.all)) return predicate.all.every(item => publicReachable(item, facts));
  if (Array.isArray(predicate.any)) return predicate.any.some(item => publicReachable(item, facts));
  if (predicate.not !== undefined) return !publicReachable(predicate.not, facts);
  if (predicate.publicFact !== undefined) return facts.has(predicate.publicFact);
  // Role facts, opened entries and attempted actions are player-controlled and may be reached.
  if (predicate.roleFact !== undefined || predicate.entryOpened !== undefined || predicate.actionAttempted !== undefined) return true;
  if (predicate.chapterAtLeast !== undefined) return Number(predicate.chapterAtLeast) <= 6;
  return false;
}

function operationReachability(operations) {
  const facts = new Set(['roomCreated', 'hostJoined', 'guestJoined']);
  const nodes = new Set(['roomCreated', 'hostJoined', 'guestJoined']);
  const reached = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const operation of operations) {
      if (reached.has(operation.operationId)) continue;
      if (!publicReachable(operation.unlockWhen, facts)) continue;
      reached.add(operation.operationId); changed = true;
      const effects = operation.effects || {};
      for (const fact of effects.publicFacts || []) facts.add(fact);
      for (const node of effects.completeNodeIds || []) nodes.add(node);
    }
  }
  return { reached, facts, nodes };
}

function validateContent(bundle = defaultContent) {
  const errors = [];
  const terminalEntries = Array.isArray(bundle.terminalEntries) ? bundle.terminalEntries : [];
  const dialogue = Array.isArray(bundle.dialogue) ? bundle.dialogue : [];
  const privateMissions = Array.isArray(bundle.privateMissions) ? bundle.privateMissions : [];
  const operations = Array.isArray(bundle.operations) ? bundle.operations : [];
  const debrief = Array.isArray(bundle.debrief) ? bundle.debrief : [];
  const allIds = new Map();
  const addId = (id, label) => {
    if (typeof id !== 'string' || !id.trim()) { errors.push(`${label} requires id`); return; }
    if (allIds.has(id)) errors.push(`duplicate id ${id}`); else allIds.set(id, label);
  };
  for (const item of terminalEntries) addId(item.id, 'terminal entry');
  for (const item of dialogue) addId(item.id, 'dialogue');
  for (const item of privateMissions) addId(item.id, 'private mission');
  const operationIds = new Set();
  for (const operation of operations) {
    addId(operation.operationId, 'operation');
    operationIds.add(operation.operationId);
    for (const key of REQUIRED_OPERATION_KEYS) if (!(key in operation)) errors.push(`operation ${operation.operationId || '?'} missing ${key}`);
    if (!OPERATION_KINDS.includes(operation.kind)) errors.push(`operation ${operation.operationId} has invalid kind`);
    predicateErrors(operation.unlockWhen, `operation ${operation.operationId}.unlockWhen`, errors);
    const effects = operation.effects || {};
    for (const key of ['publicFacts', 'roleFacts', 'unlockEntryIds', 'completeNodeIds', 'appendContentIds']) {
      if (!Array.isArray(effects[key])) errors.push(`operation ${operation.operationId}.effects.${key} must be an array`);
    }
    if (operation.kind === 'mainline' && (effects.roleFacts || []).length) errors.push(`mainline operation ${operation.operationId} depends on private facts`);
    if (operation.kind === 'mainline' && predicateContainsRoleFact(operation.unlockWhen)) errors.push(`mainline operation ${operation.operationId} depends on private role fact`);
  }
  const entryIds = new Set(terminalEntries.map(item => item.id));
  for (const entry of terminalEntries) {
    for (const key of REQUIRED_ENTRY_KEYS) if (!(key in entry)) errors.push(`entry ${entry.id || '?'} missing ${key}`);
    try { validateAudience(entry.audience); } catch { errors.push(`entry ${entry.id} has invalid audience`); }
    predicateErrors(entry.unlockWhen, `entry ${entry.id}.unlockWhen`, errors);
    for (const verification of entry.verificationEntries || []) {
      if (!entryIds.has(verification.entryId)) errors.push(`entry ${entry.id} references missing verification ${verification.entryId}`);
      if (!verification.sourceGroup) errors.push(`entry ${entry.id} verification missing sourceGroup`);
      if (verification.sourceGroup === entry.sourceGroup) errors.push(`entry ${entry.id} verification must use different sourceGroup`);
    }
    for (const fallback of entry.mainlineFallbackOperationIds || []) if (!operationIds.has(fallback)) errors.push(`entry ${entry.id} fallback ${fallback} missing`);
    for (const { value, path } of allStrings(entry.text || '', `entry ${entry.id}.text`)) if (DELIVERY_LABEL_RE.test(value)) errors.push(`entry ${entry.id} visible copy contains delivery label`);
  }
  for (const item of dialogue) {
    try { validateAudience(item.audience); } catch { errors.push(`dialogue ${item.id} has invalid audience`); }
    if (!CHANNELS.includes(item.channel)) errors.push(`dialogue ${item.id} has invalid channel`);
    if (!INTENTS.includes(item.intent)) errors.push(`dialogue ${item.id} has invalid intent`);
    const bothAudience = item.audience?.kind === 'both';
    const directAudience = item.audience?.kind === 'role' || item.audience?.kind === 'player';
    if (item.channel === 'broadcast' && (!(item.intent === 'system' || item.intent === 'common_task') || !bothAudience)) errors.push(`dialogue ${item.id} invalid broadcast audience or intent`);
    if (item.channel === 'direct' && (!(item.intent === 'rapport' || item.intent === 'observation' || item.intent === 'manipulation' || item.intent === 'private_task') || !directAudience)) errors.push(`dialogue ${item.id} invalid direct audience or intent`);
    predicateErrors(item.unlockWhen, `dialogue ${item.id}.unlockWhen`, errors);
    if (!Array.isArray(item.variants) || !item.variants.length) errors.push(`dialogue ${item.id} requires visible variants`);
    for (const { value } of allStrings(item.variants || [])) if (DELIVERY_LABEL_RE.test(value)) errors.push(`dialogue ${item.id} visible copy contains delivery label`);
  }
  const missionIds = new Set();
  for (const mission of privateMissions) {
    missionIds.add(mission.id);
    predicateErrors(mission.unlockWhen, `mission ${mission.id}.unlockWhen`, errors);
    for (const operationId of mission.operationIds || []) if (!operationIds.has(operationId)) errors.push(`mission ${mission.id} references missing operation ${operationId}`);
    for (const fallback of mission.mainlineFallbackOperationIds || []) if (!operationIds.has(fallback)) errors.push(`mission ${mission.id} fallback ${fallback} missing`);
    for (const factId of mission.debriefFactIds || []) if (!debrief.some(item => item.factId === factId)) errors.push(`mission ${mission.id} missing debrief outcome fact ${factId}`);
  }
  const debriefIds = new Set();
  for (const item of debrief) {
    if (debriefIds.has(item.factId)) errors.push(`duplicate debrief fact ${item.factId}`); debriefIds.add(item.factId);
    for (const id of item.verificationEntryIds || []) if (!entryIds.has(id)) errors.push(`debrief fact ${item.factId} references missing entry ${id}`);
    for (const field of ['surfaceClaim', 'actualEffect', 'verificationEntryIds']) if (!(field in item)) errors.push(`debrief fact ${item.factId} missing ${field}`);
  }
  const reach = operationReachability(operations);
  for (const item of [...terminalEntries, ...privateMissions]) {
    for (const fallback of item.mainlineFallbackOperationIds || []) if (!reach.reached.has(fallback)) errors.push(`${item.id} fallback ${fallback} is unreachable`);
  }
  for (const entry of terminalEntries) {
    if (!entry.verificationEntries?.length && entry.isDeception) errors.push(`deception ${entry.id} missing verification`);
    if (entry.isDeception && !entry.verificationEntries.some(v => entryIds.has(v.entryId) && v.sourceGroup !== entry.sourceGroup)) errors.push(`deception ${entry.id} lacks independently sourced verification`);
  }
  if (!operations.some(item => item.operationId === 'commit_finale' && item.kind === 'neutral_finale')) errors.push('missing neutral finale operation commit_finale');
  if (!reach.nodes.has('finale_ready')) errors.push('finale_ready is unreachable');
  if (!reach.nodes.has('finaleCommitted.A') || !reach.nodes.has('finaleCommitted.B') || !reach.nodes.has('endingCommitted')) errors.push('finale commit nodes are unreachable');
  return errors;
}

function predicateContainsRoleFact(predicate) {
  if (!predicate || typeof predicate !== 'object') return false;
  if (predicate.roleFact !== undefined) return true;
  if (Array.isArray(predicate.all) && predicate.all.some(predicateContainsRoleFact)) return true;
  if (Array.isArray(predicate.any) && predicate.any.some(predicateContainsRoleFact)) return true;
  return predicate.not !== undefined && predicateContainsRoleFact(predicate.not);
}

function assertValidContent(bundle = defaultContent) {
  const errors = validateContent(bundle);
  if (errors.length) throw new Error(`Narrative content validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
  return true;
}

module.exports = { validateContent, assertValidContent, operationReachability, predicateContainsRoleFact };
