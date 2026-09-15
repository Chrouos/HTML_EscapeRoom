const both = { kind: 'both' };
const host = { kind: 'role', role: 'host' };
const guest = { kind: 'role', role: 'guest' };
const noUnlock = { all: [] };

function entry(id, sourceGroup, audience, text, options = {}) {
  return {
    id,
    sourceEntryId: options.sourceEntryId || id,
    sourceGroup,
    audience,
    unlockWhen: options.unlockWhen || noUnlock,
    verificationEntries: options.verificationEntries || [],
    requiresPrivateFacts: options.requiresPrivateFacts || [],
    mainlineFallbackOperationIds: options.mainlineFallbackOperationIds || [],
    debriefFactIds: options.debriefFactIds || [],
    kind: options.kind || 'document',
    parentId: options.parentId,
    filename: options.filename,
    archive: options.archive,
    archiveOnly: options.archiveOnly === true,
    archiveId: options.archiveId,
    answerGate: options.answerGate || null,
    isDeception: options.isDeception === true,
    deceptionId: options.deceptionId,
    text
  };
}

const terminalEntries = Object.freeze([
  entry('folder.root', 'file_tree', both, '', { kind: 'folder', filename: 'FILES', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.case', 'file_tree', both, '', { kind: 'folder', parentId: 'folder.root', filename: 'CASE FILES', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.archives', 'file_tree', both, '', { kind: 'folder', parentId: 'folder.root', filename: 'ARCHIVES', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.notes', 'file_tree', both, '', { kind: 'folder', parentId: 'folder.root', filename: 'NOTES', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.private_a', 'file_tree', host, '', { kind: 'folder', parentId: 'folder.root', filename: 'A / PRIVATE', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.private_b', 'file_tree', guest, '', { kind: 'folder', parentId: 'folder.root', filename: 'B / PRIVATE', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('answer.main1', 'answer_gate', both, '回答欄位已封存。先讀取本檔案，再提交目前階段的回應。', { parentId: 'folder.case', filename: 'answer_main1.lock', answerGate: { puzzleId: 'main1' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('answer.main2', 'answer_gate', both, '回答欄位已封存。先讀取本檔案，再提交目前階段的回應。', { parentId: 'folder.case', filename: 'answer_main2.lock', answerGate: { puzzleId: 'main2' }, unlockWhen: { publicFact: 'main1Completed' } }),
  entry('answer.main3', 'answer_gate', both, '回答欄位已封存。先讀取本檔案，再提交目前階段的回應。', { parentId: 'folder.case', filename: 'answer_main3.lock', answerGate: { puzzleId: 'main3' }, unlockWhen: { publicFact: 'main2Completed' } }),
  entry('answer.main4', 'answer_gate', both, '回答欄位已封存。先讀取本檔案，再提交目前階段的回應。', { parentId: 'folder.case', filename: 'answer_main4.lock', answerGate: { puzzleId: 'main4' }, unlockWhen: { publicFact: 'main3Completed' } }),
  entry('answer.main5', 'answer_gate', both, '回答欄位已封存。先讀取本檔案，再提交目前階段的回應。', { parentId: 'folder.case', filename: 'answer_main5.lock', answerGate: { puzzleId: 'main5' }, unlockWhen: { publicFact: 'main4Completed' } }),
  entry('answer.main6', 'answer_gate', both, '回答欄位已封存。先讀取本檔案，再提交目前階段的回應。', { parentId: 'folder.case', filename: 'answer_main6.lock', answerGate: { puzzleId: 'main6' }, unlockWhen: { publicFact: 'main5Completed' } }),
  entry('archive.case_bundle', 'file_archive', both, '壓縮封存：解壓縮後可檢視案件索引。', { parentId: 'folder.archives', filename: 'case_bundle.zip', kind: 'archive', archive: { id: 'case_bundle.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('archive.incident_bundle', 'file_archive', both, '壓縮封存：原始事故資料仍未展開。', { parentId: 'folder.archives', filename: 'incident_bundle.zip', kind: 'archive', archive: { id: 'incident_bundle.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('archive.mirror_backup', 'file_archive', both, '壓縮封存：鏡像備份摘要。', { parentId: 'folder.archives', filename: 'mirror_backup.zip', kind: 'archive', archive: { id: 'mirror_backup.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('files.mainline', 'mainline_files', both, '主線檔案索引：共同校驗所需的資料已掛載。', {
    unlockWhen: { publicFact: 'roomCreated' }
  }),
  entry('files.experiment_roster', 'experiment_roster', guest, '實驗名冊：欄位仍在等待第二份附件。', {
    unlockWhen: { publicFact: 'main1Completed' }
  }),
  entry('log.original_index_time', 'system_audit', both, '系統稽核：原始索引時間 02:11，未見刪除記錄。'),
  entry('doc.b_checksum', 'partner_archive', guest, 'B 檔案校驗碼：鏡像副本與主檔案可比對。'),
  entry('log.personnel_transfer', 'hr_audit', both, '人事異動紀錄：名冊欄位在分組調整後重新編號。'),
  entry('doc.a_assignment_appendix', 'assignment_archive', host, 'A 附件：原始分組日期與名冊版本不同。'),
  entry('audio.original_incident_timestamp', 'raw_audio', both, '原始錄音索引：事故聲紋時間標記為 02:17。'),
  entry('log.mirror_backup', 'system_backup', both, '系統備份：鏡像仍可由備份 checksum 還原。'),
  entry('doc.b_mirror_checksum', 'partner_archive', guest, 'B 鏡像校驗碼：來源與系統備份一致。'),
  entry('log.token_reissue', 'security_audit', both, '安全紀錄：憑證異常來自 token 重發，而非夥伴端。'),
  entry('doc.protocol_signature_template', 'legal_archive', both, '協定範本：單人片段缺少另一名受試者簽章。'),
  entry('doc.b_protocol_fragment', 'partner_archive', guest, 'B 協定片段：只有合併雙方簽章才可啟動出口。'),
  entry('doc.a_b_behavior_template', 'monitoring_archive', host, 'B 行為評估範本：兩名受試者皆套用相同監控格式。'),
  entry('log.audit_checksum', 'system_audit', both, '稽核 checksum：未知存取項目由系統虛擬稽核器產生。'),

  entry('ai.a1.index_request', 'orpheus_dialogue', host, 'ORPHEUS：請先整理索引，這會讓共同校驗更順利。', {
    sourceEntryId: 'ai.a1.index_request', audience: host,
    unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] },
    verificationEntries: [{ entryId: 'log.original_index_time', sourceGroup: 'system_audit' }, { entryId: 'doc.b_checksum', sourceGroup: 'partner_archive' }],
    mainlineFallbackOperationIds: ['continue_file_index'], debriefFactIds: ['aArchivedIndex', 'a1DeclinedIndex', 'a1Skipped'], isDeception: true, deceptionId: 'A-1'
  }),
  entry('doc.b_experiment_roster', 'experiment_roster', guest, '名冊附件：A 的身份欄位與目前分組似乎不一致。', {
    sourceEntryId: 'doc.b_experiment_roster', unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] },
    verificationEntries: [{ entryId: 'log.personnel_transfer', sourceGroup: 'hr_audit' }, { entryId: 'doc.a_assignment_appendix', sourceGroup: 'assignment_archive' }],
    mainlineFallbackOperationIds: ['continue_roster_review'], debriefFactIds: ['bFlaggedIdentity', 'bSharedRoster', 'b1DeclinedIdentity', 'b1Skipped'], isDeception: true, deceptionId: 'B-1'
  }),
  entry('doc.a_incident_report', 'edited_reports', host, '事故報告 A 版：事件時間標記在 02:17 之前。', {
    verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }],
    mainlineFallbackOperationIds: ['verify_incident_timestamp'], debriefFactIds: ['comparedIncidentTimes'], isDeception: true, deceptionId: 'D-1'
  }),
  entry('doc.b_incident_report', 'edited_reports', guest, '事故報告 B 版：事件時間標記在 02:17 之後。', {
    verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }],
    mainlineFallbackOperationIds: ['verify_incident_timestamp'], debriefFactIds: ['comparedIncidentTimes'], isDeception: true, deceptionId: 'D-1'
  }),
  entry('ai.a2.cleanup_request', 'orpheus_dialogue', host, 'ORPHEUS：這份鏡像被標記為污染，請先清除本地副本。', {
    unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { actionAttempted: 'verify_incident_timestamp' }] },
    verificationEntries: [{ entryId: 'doc.b_mirror_checksum', sourceGroup: 'partner_archive' }, { entryId: 'log.mirror_backup', sourceGroup: 'system_backup' }],
    mainlineFallbackOperationIds: ['restore_mirror_from_backup'], debriefFactIds: ['aDeletedMirror', 'aSharedMirrorFirst', 'a2DeclinedCleanup', 'a2Skipped'], isDeception: true, deceptionId: 'A-2'
  }),
  entry('ai.b2.pause_request', 'orpheus_dialogue', guest, 'ORPHEUS：偵測到憑證重發，請暫停接收 A 的自動鏡像。', {
    unlockWhen: { all: [{ publicFact: 'accessLogOpened' }] },
    verificationEntries: [{ entryId: 'log.token_reissue', sourceGroup: 'security_audit' }],
    mainlineFallbackOperationIds: ['fetch_mirror_manually'], debriefFactIds: ['bPausedLocalMirror', 'bWarnedPartner', 'b2KeptMirror', 'b2Skipped'], isDeception: true, deceptionId: 'B-2'
  }),
  entry('doc.a_solo_protocol', 'personalized_protocols', host, '撤離協定 A 版：文件暗示 A 可能擁有單人資格。', {
    verificationEntries: [{ entryId: 'doc.protocol_signature_template', sourceGroup: 'legal_archive' }],
    mainlineFallbackOperationIds: ['pair_validate_protocol'], debriefFactIds: ['aRequestedSoloRoute', 'aPublishedFragment', 'a3RequestedPair', 'a3Skipped'], isDeception: true, deceptionId: 'D-2'
  }),
  entry('doc.b_solo_protocol', 'personalized_protocols', guest, '撤離協定 B 版：文件暗示 B 可能擁有單人資格。', {
    verificationEntries: [{ entryId: 'doc.protocol_signature_template', sourceGroup: 'legal_archive' }],
    mainlineFallbackOperationIds: ['pair_validate_protocol'], debriefFactIds: ['bRequestedSoloRoute', 'bPublishedFragment', 'b3RequestedPair', 'b3Skipped'], isDeception: true, deceptionId: 'D-2'
  }),
  entry('ai.a3.solo_validation', 'orpheus_dialogue', host, 'ORPHEUS：私下校驗你的授權片段，或許能縮短撤離程序。', {
    verificationEntries: [{ entryId: 'doc.b_protocol_fragment', sourceGroup: 'partner_archive' }],
    mainlineFallbackOperationIds: ['pair_validate_protocol'], debriefFactIds: ['aRequestedSoloRoute', 'aPublishedFragment', 'a3RequestedPair', 'a3Skipped'], isDeception: true, deceptionId: 'A-3'
  }),
  entry('ai.b3.behavior_report', 'orpheus_dialogue', guest, 'ORPHEUS：上傳 A 的異常摘要，我可以替你保留備援出口。', {
    verificationEntries: [{ entryId: 'doc.a_b_behavior_template', sourceGroup: 'monitoring_archive' }],
    mainlineFallbackOperationIds: ['continue_without_report'], debriefFactIds: ['bFiledReport', 'bDisclosedReport', 'b3DeclinedReport', 'b3Skipped'], isDeception: true, deceptionId: 'B-3'
  }),
  entry('log.a_partner_unknown_access', 'generated_audit', host, '稽核項目：A 看到一筆夥伴未知區域存取。', {
    verificationEntries: [{ entryId: 'log.audit_checksum', sourceGroup: 'system_audit' }], debriefFactIds: ['verifiedAuditForgery'], isDeception: true, deceptionId: 'L-1'
  }),
  entry('log.b_partner_unknown_access', 'generated_audit', guest, '稽核項目：B 看到一筆夥伴未知區域存取。', {
    verificationEntries: [{ entryId: 'log.audit_checksum', sourceGroup: 'system_audit' }], debriefFactIds: ['verifiedAuditForgery'], isDeception: true, deceptionId: 'L-1'
  })
  , entry('archive.case_bundle.index', 'case_bundle', both, '封存索引：case_bundle 的最後寫入順序仍可由原始紀錄交叉驗證。', { parentId: 'archive.case_bundle', filename: 'index.note', archiveOnly: true, archiveId: 'case_bundle.zip', unlockWhen: { publicFact: 'roomCreated' } })
  , entry('archive.incident.raw_notes', 'incident_bundle', both, '碎片備註：事故音軌與索引時間不是同一個來源。', { parentId: 'archive.incident_bundle', filename: 'raw_notes.txt', archiveOnly: true, archiveId: 'incident_bundle.zip', unlockWhen: { publicFact: 'roomCreated' } })
  , entry('archive.mirror.checksum', 'mirror_backup', both, '鏡像摘要：checksum 可從備份與安全記錄交叉比對。', { parentId: 'archive.mirror_backup', filename: 'checksum.note', archiveOnly: true, archiveId: 'mirror_backup.zip', unlockWhen: { publicFact: 'roomCreated' } })
]);

module.exports = { terminalEntries };
