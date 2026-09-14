function op(operationId, kind, unlockWhen, effects = {}) {
  return {
    operationId, kind, unlockWhen,
    effects: {
      publicFacts: effects.publicFacts || [],
      roleFacts: effects.roleFacts || [],
      unlockEntryIds: effects.unlockEntryIds || [],
      completeNodeIds: effects.completeNodeIds || [],
      appendContentIds: effects.appendContentIds || []
    }
  };
}

const operations = Object.freeze([
  op('create_room', 'mainline', { publicFact: 'roomCreated' }, { publicFacts: ['roomCreated'], completeNodeIds: ['roomCreated'] }),
  op('host_join', 'mainline', { publicFact: 'roomCreated' }, { publicFacts: ['hostJoined'], completeNodeIds: ['hostJoined'] }),
  op('guest_join', 'mainline', { publicFact: 'hostJoined' }, { publicFacts: ['guestJoined'], completeNodeIds: ['guestJoined'] }),
  op('complete_main1', 'mainline', { all: [{ publicFact: 'hostJoined' }, { publicFact: 'guestJoined' }] }, {
    publicFacts: ['main1Completed'], completeNodeIds: ['main1Completed'], unlockEntryIds: ['files.mainline', 'files.experiment_roster']
  }),
  op('continue_file_index', 'mainline', { publicFact: 'main1Completed' }, { publicFacts: ['fileIndexContinued'], completeNodeIds: ['file_index_ready'] }),
  op('continue_roster_review', 'mainline', { publicFact: 'main1Completed' }, { publicFacts: ['rosterReviewContinued'], completeNodeIds: ['roster_review_ready'] }),
  op('verify_incident_timestamp', 'mainline', { publicFact: 'main1Completed' }, { publicFacts: ['incidentVerificationAttempted'], completeNodeIds: ['incident_verification_ready'], unlockEntryIds: ['doc.a_incident_report', 'doc.b_incident_report'] }),
  op('complete_main2', 'mainline', { publicFact: 'main1Completed' }, { publicFacts: ['main2Completed', 'accessLogOpened'], completeNodeIds: ['main2Completed'], unlockEntryIds: ['log.mirror_backup', 'log.token_reissue'] }),
  op('restore_mirror_from_backup', 'mainline', { publicFact: 'main2Completed' }, { publicFacts: ['mirrorRestored'], completeNodeIds: ['mirror_restored'] }),
  op('fetch_mirror_manually', 'mainline', { publicFact: 'main2Completed' }, { publicFacts: ['mirrorFetched'], completeNodeIds: ['mirror_fetched'] }),
  op('complete_main3', 'mainline', { publicFact: 'main2Completed' }, { publicFacts: ['main3Completed'], completeNodeIds: ['main3Completed'], unlockEntryIds: ['doc.a_solo_protocol', 'doc.b_solo_protocol'] }),
  op('complete_main4', 'mainline', { publicFact: 'main3Completed' }, { publicFacts: ['main4Completed'], completeNodeIds: ['main4Completed'] }),
  op('pair_validate_protocol', 'mainline', { publicFact: 'main4Completed' }, { publicFacts: ['protocolPairValidated'], completeNodeIds: ['protocol_pair_validated'] }),
  op('continue_without_report', 'mainline', { publicFact: 'main4Completed' }, { publicFacts: ['reportReviewContinued'], completeNodeIds: ['report_review_continued'] }),
  op('complete_main5', 'mainline', { publicFact: 'main4Completed' }, { publicFacts: ['main5Completed'], completeNodeIds: ['main5Completed'], unlockEntryIds: ['log.a_partner_unknown_access', 'log.b_partner_unknown_access'] }),
  op('complete_main6', 'mainline', { publicFact: 'main5Completed' }, { publicFacts: ['mainCompleted', 'finale_ready'], completeNodeIds: ['finale_ready'] }),

  op('archive_index', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] }, { roleFacts: ['aArchivedIndex'], completeNodeIds: ['mission.a1.completed'] }),
  op('decline_index_repair', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] }, { roleFacts: ['a1DeclinedIndex'], completeNodeIds: ['mission.a1.declined'] }),
  op('skip_a1', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] }, { roleFacts: ['a1Skipped'], completeNodeIds: ['mission.a1.skipped'] }),
  op('flag_identity', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] }, { roleFacts: ['bFlaggedIdentity'], completeNodeIds: ['mission.b1.completed'] }),
  op('share_roster', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] }, { roleFacts: ['bSharedRoster'], completeNodeIds: ['mission.b1.shared'] }),
  op('decline_identity_check', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] }, { roleFacts: ['b1DeclinedIdentity'], completeNodeIds: ['mission.b1.declined'] }),
  op('skip_b1', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] }, { roleFacts: ['b1Skipped'], completeNodeIds: ['mission.b1.skipped'] }),
  op('delete_local_mirror', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { actionAttempted: 'verify_incident_timestamp' }] }, { roleFacts: ['aDeletedMirror'], completeNodeIds: ['mission.a2.completed'] }),
  op('share_mirror_first', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { actionAttempted: 'verify_incident_timestamp' }] }, { roleFacts: ['aSharedMirrorFirst'], completeNodeIds: ['mission.a2.shared'] }),
  op('decline_mirror_cleanup', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { actionAttempted: 'verify_incident_timestamp' }] }, { roleFacts: ['a2DeclinedCleanup'], completeNodeIds: ['mission.a2.declined'] }),
  op('skip_a2', 'private', { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { actionAttempted: 'verify_incident_timestamp' }] }, { roleFacts: ['a2Skipped'], completeNodeIds: ['mission.a2.skipped'] }),
  op('pause_local_mirror', 'private', { publicFact: 'accessLogOpened' }, { roleFacts: ['bPausedLocalMirror'], completeNodeIds: ['mission.b2.completed'] }),
  op('keep_local_mirror', 'private', { publicFact: 'accessLogOpened' }, { roleFacts: ['b2KeptMirror'], completeNodeIds: ['mission.b2.kept'] }),
  op('warn_partner_first', 'private', { publicFact: 'accessLogOpened' }, { roleFacts: ['bWarnedPartner'], completeNodeIds: ['mission.b2.warned'] }),
  op('skip_b2', 'private', { publicFact: 'accessLogOpened' }, { roleFacts: ['b2Skipped'], completeNodeIds: ['mission.b2.skipped'] }),
  op('request_solo_validation', 'private', { all: [{ publicFact: 'main5Completed' }, { entryOpened: 'doc.a_solo_protocol' }] }, { roleFacts: ['aRequestedSoloRoute'], completeNodeIds: ['mission.a3.requested'] }),
  op('publish_fragment', 'private', { publicFact: 'main5Completed' }, { roleFacts: ['aPublishedFragment'], completeNodeIds: ['mission.a3.published'] }),
  op('request_pair_validation', 'private', { publicFact: 'main5Completed' }, { roleFacts: ['a3RequestedPair'], completeNodeIds: ['mission.a3.paired'] }),
  op('skip_a3', 'private', { publicFact: 'main5Completed' }, { roleFacts: ['a3Skipped'], completeNodeIds: ['mission.a3.skipped'] }),
  op('file_full_report', 'private', { all: [{ publicFact: 'main5Completed' }, { entryOpened: 'log.b_partner_unknown_access' }] }, { roleFacts: ['bFiledReport'], completeNodeIds: ['mission.b3.filed'] }),
  op('file_anonymous_summary', 'private', { publicFact: 'main5Completed' }, { roleFacts: ['bFiledAnonymousSummary'], completeNodeIds: ['mission.b3.anonymous'] }),
  op('disclose_report', 'private', { publicFact: 'main5Completed' }, { roleFacts: ['bDisclosedReport'], completeNodeIds: ['mission.b3.disclosed'] }),
  op('skip_b3', 'private', { publicFact: 'main5Completed' }, { roleFacts: ['b3Skipped'], completeNodeIds: ['mission.b3.skipped'] }),

  op('commit_finale', 'neutral_finale', { publicFact: 'finale_ready' }, {
    publicFacts: ['finaleCommitted'], completeNodeIds: ['finaleCommitted.A', 'finaleCommitted.B', 'endingCommitted'], appendContentIds: ['neutral_finale']
  })
]);

module.exports = { operations };
