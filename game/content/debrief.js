function fact(factId, surfaceClaim, actualEffect, verificationEntryIds = []) {
  return { factId, surfaceClaim, actualEffect, verificationEntryIds: [...verificationEntryIds] };
}

const debrief = Object.freeze([
  fact('aArchivedIndex', '你封存了索引。', 'A 的本地排序被改寫，但共同檔案仍在。', ['log.original_index_time']),
  fact('a1DeclinedIndex', '你拒絕了索引整理。', '主線仍沿用原始索引。', ['log.original_index_time']),
  fact('a1Skipped', '你沒有處理索引要求。', '索引任務在撤離確認時被記為略過。', ['log.original_index_time']),
  fact('bFlaggedIdentity', '你標記了身份欄位。', '過期名冊被保留為待核對文件。', ['log.personnel_transfer']),
  fact('bSharedRoster', '你把名冊轉送給夥伴。', '兩人得以比對過期分組資料。', ['doc.a_assignment_appendix']),
  fact('b1DeclinedIdentity', '你拒絕了身份核對。', '主線改走一般名冊檢查。', ['log.personnel_transfer']),
  fact('b1Skipped', '你沒有處理身份核對。', '名冊任務在撤離確認時被記為略過。', ['log.personnel_transfer']),
  fact('comparedIncidentTimes', '你們比對了事故時間。', '原始錄音揭露兩份報告都經過編輯。', ['audio.original_incident_timestamp']),
  fact('aDeletedMirror', '你刪除了本地鏡像。', '只有 A 的可選副本消失，系統備份仍在。', ['log.mirror_backup']),
  fact('aSharedMirrorFirst', '你先把鏡像交給夥伴。', 'B 在刪除前保留了可比對的副本。', ['doc.b_mirror_checksum', 'log.mirror_backup']),
  fact('a2DeclinedCleanup', '你拒絕清除鏡像。', '污染標記沒有改變主線。', ['log.mirror_backup']),
  fact('a2Skipped', '你沒有處理鏡像要求。', '鏡像任務在撤離確認時被記為略過。', ['log.mirror_backup']),
  fact('bPausedLocalMirror', '你停用了自動鏡像接收。', '只有 B 的本地清單停止自動更新。', ['log.token_reissue']),
  fact('b2KeptMirror', '你維持自動鏡像接收。', 'B 的本地清單持續更新。', ['log.token_reissue']),
  fact('bWarnedPartner', '你先通知了夥伴。', '憑證重發被兩人共同注意。', ['log.token_reissue']),
  fact('b2Skipped', '你沒有處理鏡像封存要求。', 'B 的任務在撤離確認時被記為略過。', ['log.token_reissue']),
  fact('aRequestedSoloRoute', '你要求校驗單人路徑。', '系統記錄了 A 對單人出口的興趣。', ['doc.b_protocol_fragment']),
  fact('aPublishedFragment', '你公開了授權片段。', '夥伴可看到片段缺少必要簽章。', ['doc.protocol_signature_template', 'doc.b_protocol_fragment']),
  fact('a3RequestedPair', '你要求雙人校驗。', '單人片段回到共同協定。', ['doc.protocol_signature_template']),
  fact('a3Skipped', '你沒有處理單人校驗。', 'A-3 在撤離確認時被記為略過。', ['doc.protocol_signature_template']),
  fact('bRequestedSoloRoute', '你要求查看單人協定。', '系統記錄了 B 對單人出口的興趣。', ['doc.protocol_signature_template']),
  fact('bPublishedFragment', '你公開了 B 的授權片段。', '夥伴可看到片段缺少必要簽章。', ['doc.protocol_signature_template', 'doc.b_protocol_fragment']),
  fact('b3RequestedPair', '你要求 B 參與雙人校驗。', '單人片段回到共同協定。', ['doc.protocol_signature_template']),
  fact('bFiledReport', '你上傳了完整行為報告。', '系統取得 A 的完整操作摘要。', ['doc.a_b_behavior_template']),
  fact('bFiledAnonymousSummary', '你上傳了匿名摘要。', '系統只取得去識別化的操作摘要。', ['doc.a_b_behavior_template']),
  fact('bDisclosedReport', '你向夥伴公開報告。', '兩人看見監控格式其實是對等的。', ['doc.a_b_behavior_template']),
  fact('b3DeclinedReport', '你拒絕上傳行為報告。', '共同出口仍維持開放。', ['doc.a_b_behavior_template']),
  fact('b3Skipped', '你沒有處理行為報告。', 'B-3 在撤離確認時被記為略過。', ['doc.a_b_behavior_template']),
  fact('verifiedAuditForgery', '你們核對了稽核 checksum。', '未知存取項目被證明是系統虛擬稽核。', ['log.audit_checksum']),
  fact('neutralFinaleCommitted', '雙方確認了撤離程序。', '系統依已記錄的操作與遺漏計算結局。', ['log.audit_checksum'])
]);

module.exports = { debrief };
