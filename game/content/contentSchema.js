const AUDIENCE_KINDS = Object.freeze(['both', 'role', 'player']);
const ROLES = Object.freeze(['host', 'guest']);
const CHANNELS = Object.freeze(['broadcast', 'direct']);
const INTENTS = Object.freeze([
  'system', 'common_task', 'rapport', 'observation', 'manipulation', 'private_task'
]);
const OPERATION_KINDS = Object.freeze(['mainline', 'private', 'neutral_finale']);
const PREDICATES = Object.freeze([
  'chapterAtLeast', 'publicFact', 'roleFact', 'entryOpened', 'actionAttempted',
  'entryOpenedTimes', 'elapsedSinceMeaningfulAction', 'reactionFactMissing'
]);

function predicateList(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  if (value.all || value.any) return [...(value.all || []), ...(value.any || [])].flatMap(predicateList);
  if (value.not) return predicateList(value.not);
  return Object.keys(value).filter(key => PREDICATES.includes(key));
}

function entryOpenedTimesShape(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 2
    && typeof value.entryId === 'string' && value.entryId.trim().length > 0
    && Number.isSafeInteger(value.atLeast) && value.atLeast >= 1;
}

function evaluatePredicate(predicate, state = {}) {
  if (!isPredicateShapeValid(predicate)) return false;
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
  if (predicate.entryOpenedTimes !== undefined) {
    const count = Number(state.entryOpenCount?.[predicate.entryOpenedTimes.entryId] || 0);
    return count >= predicate.entryOpenedTimes.atLeast;
  }
  if (predicate.elapsedSinceMeaningfulAction !== undefined) {
    const now = Number(state.now);
    const last = Number(state.lastMeaningfulActionAt);
    return Number.isFinite(now) && Number.isFinite(last)
      && now - last >= predicate.elapsedSinceMeaningfulAction;
  }
  if (predicate.reactionFactMissing !== undefined) {
    return !new Set(Array.isArray(state.reactionFactIds) ? state.reactionFactIds : [])
      .has(predicate.reactionFactMissing);
  }
  return false;
}

function isPredicateShapeValid(predicate) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) return false;
  const keys = Object.keys(predicate);
  if (!keys.length) return false;
  const combinators = keys.filter(key => ['all', 'any', 'not'].includes(key));
  const leaves = keys.filter(key => PREDICATES.includes(key));
  if (keys.some(key => !['all', 'any', 'not', ...PREDICATES].includes(key))) return false;
  if (combinators.length > 1 || (combinators.length && leaves.length) || leaves.length > 1) return false;
  if (predicate.all !== undefined && (!Array.isArray(predicate.all) || !predicate.all.every(isPredicateShapeValid))) return false;
  if (predicate.any !== undefined && (!Array.isArray(predicate.any) || !predicate.any.every(isPredicateShapeValid))) return false;
  if (predicate.not !== undefined && !isPredicateShapeValid(predicate.not)) return false;
  if (predicate.entryOpenedTimes !== undefined && !entryOpenedTimesShape(predicate.entryOpenedTimes)) return false;
  if (predicate.elapsedSinceMeaningfulAction !== undefined
    && (!Number.isFinite(predicate.elapsedSinceMeaningfulAction) || predicate.elapsedSinceMeaningfulAction < 0)) return false;
  if (predicate.reactionFactMissing !== undefined
    && (typeof predicate.reactionFactMissing !== 'string' || !predicate.reactionFactMissing.trim())) return false;
  return true;
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
  isPredicateShapeValid,
  get content() { return buildContent(); }
};
