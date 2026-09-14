const { validateAudience } = require('../audience');
const { content: defaultContent, AUDIENCE_KINDS, CHANNELS, INTENTS, OPERATION_KINDS, PREDICATES } = require('./contentSchema');

const DELIVERY_LABEL_RE = /AI_BROADCAST|AI_DIRECT|\bbroadcast\b|\bdirect\b|公開頻道|私人頻道/i;
const REQUIRED_ENTRY_KEYS = ['id', 'sourceEntryId', 'sourceGroup', 'audience', 'unlockWhen', 'verificationEntries', 'requiresPrivateFacts', 'mainlineFallbackOperationIds', 'debriefFactIds'];
const REQUIRED_OPERATION_KEYS = ['operationId', 'kind', 'unlockWhen', 'effects'];
const KNOWN_MISSION_NODES = new Set([
  'mission.a1.completed', 'mission.a1.declined', 'mission.a1.skipped',
  'mission.b1.completed', 'mission.b1.shared', 'mission.b1.declined', 'mission.b1.skipped',
  'mission.a2.completed', 'mission.a2.shared', 'mission.a2.declined', 'mission.a2.skipped',
  'mission.b2.completed', 'mission.b2.kept', 'mission.b2.warned', 'mission.b2.skipped',
  'mission.a3.requested', 'mission.a3.published', 'mission.a3.paired', 'mission.a3.skipped',
  'mission.b3.filed', 'mission.b3.anonymous', 'mission.b3.disclosed', 'mission.b3.skipped'
]);

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
  if (!keys.length) { errors.push(`${path} cannot be an empty predicate`); return; }
  const combinators = keys.filter(key => ['all', 'any', 'not'].includes(key));
  const leaves = keys.filter(key => PREDICATES.includes(key));
  if (combinators.length && leaves.length) errors.push(`${path} cannot mix combinators and leaf predicates`);
  if (combinators.length > 1) errors.push(`${path} predicate combination must contain one combinator at a time`);
  if (leaves.length > 1) errors.push(`${path} must contain exactly one leaf predicate`);
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

/**
 * Explore the declarative operation graph until no new facts or nodes appear.
 * Role-local predicates are treated as choices the relevant player can make;
 * callers can remove operation kinds/IDs to prove that optional branches are
 * not prerequisites for the shared route.
 */
function traverseOperationGraph(operations, options = {}) {
  const excludedKinds = new Set(options.excludeKinds || []);
  const excludedOperationIds = new Set(options.excludeOperationIds || []);
  const facts = new Set(options.startFacts || ['roomCreated', 'hostJoined', 'guestJoined']);
  const nodes = new Set(options.startNodes || ['roomCreated', 'hostJoined', 'guestJoined']);
  const actionIds = new Set(options.startActionIds || []);
  const roleFacts = { A: new Set(options.startRoleFacts?.A || []), B: new Set(options.startRoleFacts?.B || []) };
  const reached = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const operation of operations) {
      if (reached.has(operation.operationId)) continue;
      if (excludedKinds.has(operation.kind) || excludedOperationIds.has(operation.operationId)) continue;
      if (!graphPredicateReachable(operation.unlockWhen, { facts, actionIds, roleFacts })) continue;
      reached.add(operation.operationId); changed = true;
      const effects = operation.effects || {};
      for (const fact of effects.publicFacts || []) facts.add(fact);
      for (const node of effects.completeNodeIds || []) nodes.add(node);
      for (const fact of effects.roleFacts || []) {
        // A manifest operation has a role at runtime. For graph safety, make
        // the fact available to at least one actor (and never to mainline).
        roleFacts.A.add(fact); roleFacts.B.add(fact);
      }
      actionIds.add(operation.operationId);
    }
  }
  return { reached, facts, nodes, actionIds, roleFacts };
}

function graphPredicateReachable(predicate, state) {
  if (!predicate || typeof predicate !== 'object') return false;
  if (Array.isArray(predicate.all)) return predicate.all.every(item => graphPredicateReachable(item, state));
  if (Array.isArray(predicate.any)) return predicate.any.some(item => graphPredicateReachable(item, state));
  if (predicate.not !== undefined) return !graphPredicateReachable(predicate.not, state);
  if (predicate.publicFact !== undefined) return state.facts.has(predicate.publicFact);
  if (predicate.actionAttempted !== undefined) return state.actionIds.has(predicate.actionAttempted);
  // Entry discovery and role rapport are player-controlled decisions. They
  // are possible whenever the operation itself is reachable.
  if (predicate.roleFact !== undefined || predicate.entryOpened !== undefined) return true;
  if (predicate.chapterAtLeast !== undefined) return Number(predicate.chapterAtLeast) <= 6;
  return false;
}

function operationReachability(operations, options = {}) {
  return traverseOperationGraph(operations, options);
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
  for (const item of debrief) addId(item.factId, 'debrief fact');
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
    // A mainline operation may record an actor-local audit fact (for example
    // a verification attempt); only its unlock predicate may not depend on
    // private facts.
    if (operation.kind === 'mainline' && predicateContainsRoleFact(operation.unlockWhen)) errors.push(`mainline operation ${operation.operationId} depends on private role fact`);
  }
  const entryIds = new Set(terminalEntries.map(item => item.id));
  const contentIds = new Set([...entryIds, ...dialogue.map(item => item.id), 'neutral_finale']);
  const reach = operationReachability(operations);
  for (const entry of terminalEntries) {
    for (const key of REQUIRED_ENTRY_KEYS) if (!(key in entry)) errors.push(`entry ${entry.id || '?'} missing ${key}`);
    try { validateAudience(entry.audience); } catch { errors.push(`entry ${entry.id} has invalid audience`); }
    predicateErrors(entry.unlockWhen, `entry ${entry.id}.unlockWhen`, errors);
    if (!entryIds.has(entry.sourceEntryId)) errors.push(`entry ${entry.id} references missing source entry ${entry.sourceEntryId}`);
    for (const verification of entry.verificationEntries || []) {
      const target = terminalEntries.find(item => item.id === verification.entryId);
      if (!target) errors.push(`entry ${entry.id} references missing verification ${verification.entryId}`);
      if (!verification.sourceGroup) errors.push(`entry ${entry.id} verification missing sourceGroup`);
      if (verification.sourceGroup === entry.sourceGroup) errors.push(`entry ${entry.id} verification must use different sourceGroup`);
      if (target && verification.sourceGroup !== target.sourceGroup) errors.push(`entry ${entry.id} verification sourceGroup does not match target ${verification.entryId}`);
    }
    for (const fallback of entry.mainlineFallbackOperationIds || []) if (!operationIds.has(fallback)) errors.push(`entry ${entry.id} fallback ${fallback} missing`);
    for (const factId of entry.debriefFactIds || []) if (!debrief.some(item => item.factId === factId)) errors.push(`entry ${entry.id} references missing debrief fact ${factId}`);
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
    if (!entryIds.has(item.sourceEntryId) && !dialogue.some(candidate => candidate.id === item.sourceEntryId)) errors.push(`dialogue ${item.id} references missing source entry ${item.sourceEntryId}`);
    if (!Array.isArray(item.variants) || !item.variants.length) errors.push(`dialogue ${item.id} requires visible variants`);
    for (const { value } of allStrings(item.variants || [])) if (DELIVERY_LABEL_RE.test(value)) errors.push(`dialogue ${item.id} visible copy contains delivery label`);
    for (const factId of item.debriefFactIds || []) if (!debrief.some(entry => entry.factId === factId)) errors.push(`dialogue ${item.id} references missing debrief fact ${factId}`);
    for (const verification of item.verificationEntries || []) {
      const target = terminalEntries.find(entry => entry.id === verification.entryId);
      if (!target) errors.push(`dialogue ${item.id} references missing verification ${verification.entryId}`);
      else {
        if (target.sourceGroup !== verification.sourceGroup) errors.push(`dialogue ${item.id} verification sourceGroup does not match target`);
        if (target.sourceGroup === item.sourceGroup) errors.push(`dialogue ${item.id} verification must use an independent sourceGroup`);
        if (!publicReachable(target.unlockWhen, reach.facts)) errors.push(`dialogue ${item.id} verification target is unreachable`);
      }
    }
  }
  const missionIds = new Set();
  for (const mission of privateMissions) {
    missionIds.add(mission.id);
    predicateErrors(mission.unlockWhen, `mission ${mission.id}.unlockWhen`, errors);
    for (const operationId of mission.operationIds || []) if (!operationIds.has(operationId)) errors.push(`mission ${mission.id} references missing operation ${operationId}`);
    if (!entryIds.has(mission.sourceEntryId)) errors.push(`mission ${mission.id} references missing source entry ${mission.sourceEntryId}`);
    for (const fallback of mission.mainlineFallbackOperationIds || []) if (!operationIds.has(fallback)) errors.push(`mission ${mission.id} fallback ${fallback} missing`);
    for (const factId of mission.debriefFactIds || []) if (!debrief.some(item => item.factId === factId)) errors.push(`mission ${mission.id} missing debrief outcome fact ${factId}`);
  }
  const debriefIds = new Set();
  for (const item of debrief) {
    if (debriefIds.has(item.factId)) errors.push(`duplicate debrief fact ${item.factId}`); debriefIds.add(item.factId);
    for (const id of item.verificationEntryIds || []) if (!entryIds.has(id)) errors.push(`debrief fact ${item.factId} references missing entry ${id}`);
    for (const field of ['surfaceClaim', 'actualEffect', 'verificationEntryIds']) if (!(field in item)) errors.push(`debrief fact ${item.factId} missing ${field}`);
    for (const { value } of allStrings([item.surfaceClaim, item.actualEffect], `debrief ${item.factId}`)) if (DELIVERY_LABEL_RE.test(value)) errors.push(`debrief fact ${item.factId} visible copy contains delivery label`);
  }
  const knownNodes = new Set([
    'roomCreated', 'hostJoined', 'guestJoined', 'main1Completed', 'file_index_ready', 'roster_review_ready',
    'incident_verification_ready', 'main2Completed', 'mirror_restored', 'mirror_fetched', 'main3Completed',
    'main4Completed', 'protocol_pair_validated', 'main5Completed', 'report_review_continued', 'finale_ready',
    'finaleCommitted.A', 'finaleCommitted.B', 'endingCommitted',
    ...privateMissions.flatMap(mission => (mission.operationIds || []).map(id => `mission.${mission.missionId}.${id}`))
  ]);
  for (const item of [...terminalEntries, ...privateMissions]) {
    for (const fallback of item.mainlineFallbackOperationIds || []) {
      const operation = operations.find(candidate => candidate.operationId === fallback);
      if (operation && operation.kind !== 'mainline') errors.push(`${item.id} fallback ${fallback} must be mainline`);
      if (!reach.reached.has(fallback)) errors.push(`${item.id} fallback ${fallback} is unreachable`);
    }
    for (const factId of item.debriefFactIds || []) if (!debriefIds.has(factId)) errors.push(`${item.id} references missing debrief fact ${factId}`);
  }
  for (const entry of terminalEntries) {
    if (!entry.verificationEntries?.length && entry.isDeception) errors.push(`deception ${entry.id} missing verification`);
    if (entry.isDeception && !entry.verificationEntries.some(v => {
      const target = terminalEntries.find(item => item.id === v.entryId);
      return target && v.sourceGroup === target.sourceGroup && target.sourceGroup !== entry.sourceGroup && publicReachable(target.unlockWhen, reach.facts);
    })) errors.push(`deception ${entry.id} lacks independently sourced reachable verification`);
  }
  const deceptionGroups = new Set(terminalEntries.filter(item => item.isDeception).map(item => item.deceptionId));
  for (const group of ['A-1', 'B-1', 'D-1', 'A-2', 'B-2', 'D-2', 'A-3', 'B-3', 'L-1']) if (!deceptionGroups.has(group)) errors.push(`missing deception group ${group}`);
  for (const operation of operations) {
    const refs = operation.effects || {};
    for (const id of refs.unlockEntryIds || []) if (!entryIds.has(id)) errors.push(`operation ${operation.operationId} references missing entry ${id}`);
    for (const id of refs.appendContentIds || []) if (!contentIds.has(id)) errors.push(`operation ${operation.operationId} references missing content ${id}`);
    for (const id of refs.completeNodeIds || []) if (!knownNodes.has(id) && !KNOWN_MISSION_NODES.has(id)) errors.push(`operation ${operation.operationId} references missing node ${id}`);
    for (const id of refs.appendContentIds || []) {
      const target = [...terminalEntries, ...dialogue].find(item => item.id === id);
      if (target?.requiresPrivateFacts?.length && operation.kind === 'mainline') errors.push(`mainline operation ${operation.operationId} appends private content ${id}`);
    }
  }
  for (const operation of operations.filter(item => item.kind === 'mainline')) {
    for (const id of operation.effects.unlockEntryIds || []) {
      const target = terminalEntries.find(item => item.id === id);
      if (target?.requiresPrivateFacts?.length) errors.push(`mainline operation ${operation.operationId} unlocks private content ${id}`);
    }
    if (predicateReferencesPrivateEntry(operation.unlockWhen, terminalEntries)) errors.push(`mainline operation ${operation.operationId} has private entry prerequisite`);
    if (predicateReferencesPrivateAction(operation.unlockWhen, operations)) errors.push(`mainline operation ${operation.operationId} has private action prerequisite`);
  }
  if (!operations.some(item => item.operationId === 'commit_finale' && item.kind === 'neutral_finale')) errors.push('missing neutral finale operation commit_finale');
  if (!reach.nodes.has('finale_ready')) errors.push('finale_ready is unreachable');
  if (!reach.nodes.has('finaleCommitted.A') || !reach.nodes.has('finaleCommitted.B') || !reach.nodes.has('endingCommitted')) errors.push('finale commit nodes are unreachable');

  // Safety proof: the shared route must survive removal of every private edge,
  // and removal of each mission's complete outcome set independently.
  const requiredFinaleNodes = ['finale_ready', 'finaleCommitted.A', 'finaleCommitted.B', 'endingCommitted'];
  const reportGraphFailure = (label, graph) => {
    for (const node of requiredFinaleNodes) if (!graph.nodes.has(node)) errors.push(`${label} blocks ${node}`);
  };
  reportGraphFailure('private operation edges', traverseOperationGraph(operations, { excludeKinds: ['private'] }));
  for (const mission of privateMissions) {
    reportGraphFailure(`${mission.id} outcome edges`, traverseOperationGraph(
      operations.filter(operation => !(mission.operationIds || []).includes(operation.operationId))
    ));
  }
  return errors;
}

function predicateContainsRoleFact(predicate) {
  if (!predicate || typeof predicate !== 'object') return false;
  if (predicate.roleFact !== undefined) return true;
  if (Array.isArray(predicate.all) && predicate.all.some(predicateContainsRoleFact)) return true;
  if (Array.isArray(predicate.any) && predicate.any.some(predicateContainsRoleFact)) return true;
  return predicate.not !== undefined && predicateContainsRoleFact(predicate.not);
}

function predicateReferencesPrivateEntry(predicate, entries) {
  if (!predicate || typeof predicate !== 'object') return false;
  if (predicate.entryOpened !== undefined) {
    const entry = entries.find(item => item.id === predicate.entryOpened);
    return Boolean(entry?.requiresPrivateFacts?.length);
  }
  if (Array.isArray(predicate.all) && predicate.all.some(item => predicateReferencesPrivateEntry(item, entries))) return true;
  if (Array.isArray(predicate.any) && predicate.any.some(item => predicateReferencesPrivateEntry(item, entries))) return true;
  return predicate.not !== undefined && predicateReferencesPrivateEntry(predicate.not, entries);
}

function predicateReferencesPrivateAction(predicate, operations) {
  if (!predicate || typeof predicate !== 'object') return false;
  if (predicate.actionAttempted !== undefined) {
    const operation = operations.find(item => item.operationId === predicate.actionAttempted);
    return operation?.kind === 'private';
  }
  if (Array.isArray(predicate.all) && predicate.all.some(item => predicateReferencesPrivateAction(item, operations))) return true;
  if (Array.isArray(predicate.any) && predicate.any.some(item => predicateReferencesPrivateAction(item, operations))) return true;
  return predicate.not !== undefined && predicateReferencesPrivateAction(predicate.not, operations);
}

function assertValidContent(bundle = defaultContent) {
  const errors = validateContent(bundle);
  if (errors.length) throw new Error(`Narrative content validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
  return true;
}

module.exports = { validateContent, assertValidContent, operationReachability, traverseOperationGraph,
  predicateContainsRoleFact, predicateReferencesPrivateEntry, predicateReferencesPrivateAction };
