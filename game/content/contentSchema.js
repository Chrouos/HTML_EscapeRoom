const AUDIENCE_KINDS = Object.freeze(['both', 'role', 'player']);
const ROLES = Object.freeze(['host', 'guest']);
const CHANNELS = Object.freeze(['broadcast', 'direct']);
const INTENTS = Object.freeze([
  'system', 'common_task', 'rapport', 'observation', 'manipulation', 'private_task'
]);
const OPERATION_KINDS = Object.freeze(['mainline', 'private', 'neutral_finale']);
const PREDICATES = Object.freeze([
  'chapterAtLeast', 'publicFact', 'roleFact', 'entryOpened', 'actionAttempted'
]);

function predicateList(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  if (value.all || value.any) return [...(value.all || []), ...(value.any || [])].flatMap(predicateList);
  if (value.not) return predicateList(value.not);
  return Object.keys(value).filter(key => PREDICATES.includes(key));
}

function evaluatePredicate(predicate, state = {}) {
  if (!predicate || typeof predicate !== 'object') return true;
  if (Array.isArray(predicate.all)) return predicate.all.every(item => evaluatePredicate(item, state));
  if (Array.isArray(predicate.any)) return predicate.any.some(item => evaluatePredicate(item, state));
  if (predicate.not !== undefined) return !evaluatePredicate(predicate.not, state);
  if (predicate.chapterAtLeast !== undefined) return Number(state.chapter || 0) >= Number(predicate.chapterAtLeast);
  if (predicate.publicFact !== undefined) return new Set(state.publicFacts || []).has(predicate.publicFact);
  if (predicate.roleFact !== undefined) {
    const roleFacts = state.roleFacts || {};
    if (typeof roleFacts === 'object' && !Array.isArray(roleFacts)) {
      const role = state.role || 'A';
      const facts = roleFacts[role] || roleFacts[role === 'A' ? 'host' : 'guest'] || [];
      return Array.isArray(facts) ? facts.includes(predicate.roleFact) : Boolean(facts[predicate.roleFact]);
    }
    return Array.isArray(roleFacts) && roleFacts.includes(predicate.roleFact);
  }
  if (predicate.entryOpened !== undefined) return new Set(state.openedEntryIds || []).has(predicate.entryOpened);
  if (predicate.actionAttempted !== undefined) return new Set(state.actionIds || []).has(predicate.actionAttempted);
  return false;
}

function buildContent() {
  const { operations } = require('./operations');
  const { terminalEntries } = require('./terminalEntries');
  const { dialogue } = require('./dialogue');
  const { privateMissions } = require('./privateMissions');
  const { debrief } = require('./debrief');
  return Object.freeze({ operations, terminalEntries, dialogue, privateMissions, debrief });
}

module.exports = {
  AUDIENCE_KINDS,
  ROLES,
  CHANNELS,
  INTENTS,
  OPERATION_KINDS,
  PREDICATES,
  predicateList,
  evaluatePredicate,
  get content() { return buildContent(); }
};
