function fact(factId, surfaceClaim, actualEffect, verificationEntryIds = []) {
  return { factId, surfaceClaim, actualEffect, verificationEntryIds: [...verificationEntryIds] };
}

const verification = ['log.audit_checksum'];
const ids = [
  'aArchivedIndex', 'a1DeclinedIndex', 'a1Skipped', 'bFlaggedIdentity', 'bSharedRoster',
  'b1DeclinedIdentity', 'b1Skipped', 'comparedIncidentTimes', 'aDeletedMirror',
  'aSharedMirrorFirst', 'a2DeclinedCleanup', 'a2Skipped', 'bPausedLocalMirror',
  'b2KeptMirror', 'bWarnedPartner', 'b2Skipped', 'aRequestedSoloRoute',
  'aPublishedFragment', 'a3RequestedPair', 'a3Skipped', 'bRequestedSoloRoute',
  'bPublishedFragment', 'b3RequestedPair', 'bFiledReport', 'bFiledAnonymousSummary',
  'bDisclosedReport', 'b3DeclinedReport', 'b3Skipped', 'verifiedAuditForgery',
  'neutralFinaleCommitted', 'finaleCommittedA', 'finaleCommittedB', 'ambiguousContainment'
];

const debrief = Object.freeze(ids.map(id => fact(
  id,
  `Recorded decision: ${id}`,
  `The decision ${id} was included in the final resolution.`,
  verification
)));

module.exports = { debrief };
