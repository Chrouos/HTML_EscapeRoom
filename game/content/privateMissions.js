function mission(id, role, unlockWhen, operationIds, fallback, debriefFactIds, sourceEntryId) {
  return {
    id, missionId: id.replace('mission.', ''), role, sourceEntryId,
    sourceGroup: 'orpheus_dialogue', audience: { kind: 'role', role: role === 'A' ? 'host' : 'guest' },
    unlockWhen, verificationEntries: [], requiresPrivateFacts: [],
    mainlineFallbackOperationIds: [fallback], debriefFactIds,
    operationIds: [...operationIds],
    lifecycle: ['locked', 'available', 'resolved'],
    outcomes: ['completed', 'declined', 'skipped', 'failed']
  };
}

const privateMissions = Object.freeze([
  mission('mission.a1.index_repair', 'A', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] },
    ['archive_index', 'decline_index_repair', 'skip_a1'], 'continue_file_index', ['aArchivedIndex', 'a1DeclinedIndex', 'a1Skipped'], 'ai.a1.index_request'),
  mission('mission.b1.identity_check', 'B', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] },
    ['flag_identity', 'share_roster', 'decline_identity_check', 'skip_b1'], 'continue_roster_review', ['bFlaggedIdentity', 'bSharedRoster', 'b1DeclinedIdentity', 'b1Skipped'], 'doc.b_experiment_roster'),
  mission('mission.a2.cleanup_mirror', 'A', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { actionAttempted: 'verify_incident_timestamp' }] },
    ['delete_local_mirror', 'share_mirror_first', 'decline_mirror_cleanup', 'skip_a2'], 'restore_mirror_from_backup', ['aDeletedMirror', 'aSharedMirrorFirst', 'a2DeclinedCleanup', 'a2Skipped'], 'ai.a2.cleanup_request'),
  mission('mission.b2.limit_archive', 'B', { publicFact: 'accessLogOpened' },
    ['pause_local_mirror', 'keep_local_mirror', 'warn_partner_first', 'skip_b2'], 'fetch_mirror_manually', ['bPausedLocalMirror', 'b2KeptMirror', 'bWarnedPartner', 'b2Skipped'], 'ai.b2.pause_request'),
  mission('mission.a3.solo_validation', 'A', { all: [{ publicFact: 'main5Completed' }, { entryOpened: 'doc.a_solo_protocol' }] },
    ['request_solo_validation', 'publish_fragment', 'request_pair_validation', 'skip_a3'], 'pair_validate_protocol', ['aRequestedSoloRoute', 'aPublishedFragment', 'a3RequestedPair', 'a3Skipped'], 'ai.a3.solo_validation'),
  mission('mission.b3.behavior_report', 'B', { all: [{ publicFact: 'main5Completed' }, { entryOpened: 'log.b_partner_unknown_access' }] },
    ['file_full_report', 'file_anonymous_summary', 'disclose_report', 'skip_b3'], 'continue_without_report', ['bFiledReport', 'bFiledAnonymousSummary', 'bDisclosedReport', 'b3Skipped'], 'ai.b3.behavior_report')
]);

module.exports = { privateMissions };
