const { endings } = require('./content/endings');
const { debrief: debriefCatalog } = require('./content/debrief');

function evidenceIds(room) {
  return new Set((room?.sideEvidence || []).map(item => typeof item === 'string' ? item : item?.id).filter(Boolean));
}

function roleFacts(room, role) {
  return new Set(room?.workstation?.[role]?.roleFacts || []);
}

function recordedFacts(room) {
  const facts = new Set(room?.publicFacts || []);
  for (const role of ['A', 'B']) for (const fact of roleFacts(room, role)) facts.add(fact);
  const commits = room?.finaleCommittedByRole || {};
  if (commits.A) facts.add('finaleCommittedA');
  if (commits.B) facts.add('finaleCommittedB');
  if (commits.A && commits.B) facts.add('neutralFinaleCommitted');
  // A mission skipped by commit_finale is an intentional omission.  Older
  // snapshots may not have the role fact, so derive it from the lifecycle too.
  for (const role of ['A', 'B']) {
    for (const mission of room?.privateMissions?.[role] || []) {
      if (mission.state === 'resolved' && mission.outcome === 'skipped') {
        const id = mission.missionId || mission.id?.split('.').slice(1).join('.');
        const prefix = id?.slice(0, 2);
        if (prefix) facts.add(`${prefix}Skipped`);
      }
    }
  }
  return facts;
}

function mainCompleted(room) {
  return Boolean(room?.publicFacts?.includes('mainCompleted')
    || room?.mainProgress?.includes('main6'));
}

/**
 * Return only an ending id.  A result is possible after both authenticated
 * players commit and never from a client-provided choice.
 */
function evaluate(room) {
  if (room?.ending?.id && endings[room.ending.id]) return room.ending.id;
  if (!mainCompleted(room)) return null;
  const commits = room?.finaleCommittedByRole || {};
  if (!commits.A || !commits.B) return null;

  const facts = recordedFacts(room);
  const a = roleFacts(room, 'A');
  const b = roleFacts(room, 'B');

  // Ordered and mutually exclusive: once the audit trail exposes ORPHEUS,
  // no later behavioural label can overwrite that finding.
  if (facts.has('verifiedAuditForgery') || facts.has('comparedIncidentTimes')) return 'exposed_ai_deception';
  if (a.has('aRequestedSoloRoute') || a.has('aPublishedFragment')) return 'a_solo_escape';
  if (b.has('bRequestedSoloRoute') || b.has('bPublishedFragment')) return 'b_solo_escape';
  const aPair = a.has('a3RequestedPair') || a.has('aPublishedFragment');
  const bPair = b.has('b3RequestedPair') || b.has('bDisclosedReport') || b.has('b3DeclinedReport');
  if (aPair && bPair) return 'cooperative_escape';
  return 'ambiguous_containment';
}

function catalogById() {
  return new Map(debriefCatalog.map(item => [item.factId, item]));
}

function buildDebrief(room, endingId = evaluate(room)) {
  if (!endingId || !endings[endingId]) return [];
  const facts = recordedFacts(room);
  const byId = catalogById();
  const requested = endings[endingId].debriefFactIds || [];
  const omissionIds = [...facts].filter(id => /Skipped$/.test(id) && byId.has(id));
  const ids = [...new Set([...omissionIds, ...requested,
    'finaleCommittedA', 'finaleCommittedB', 'neutralFinaleCommitted', 'ambiguousContainment'])];
  return ids.filter(id => facts.has(id) && byId.has(id)).slice(0, 6)
    .map(id => structuredClone(byId.get(id)));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function resolveEnding(room) {
  const id = evaluate(room);
  return id || null;
}

/** Freeze the first resolved ending and its evidence map in the room. */
function commitEnding(room) {
  if (room?.ending) return room.ending;
  const id = resolveEnding(room);
  if (!id) return null;
  const result = deepFreeze(structuredClone(endings[id]));
  const explanation = deepFreeze(buildDebrief(room, id));
  room.ending = result;
  room.debrief = explanation;
  return result;
}

module.exports = {
  evidenceIds,
  recordedFacts,
  evaluate,
  resolveEnding,
  buildDebrief,
  commitEnding
};
