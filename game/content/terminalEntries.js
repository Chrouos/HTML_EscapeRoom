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
    launchApp: options.launchApp || null,
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
  entry('answer.main1', 'answer_gate', both, `這份檔案不是答案，而是設施留下的第一道封條。\n\n事故後，ORPHEUS 將身份核對與啟動順序分開保存。兩位受試者各自持有一段資料；只有把兩段資料放在一起，才能知道啟動程序是否仍屬於原本的實驗。`, { parentId: 'folder.case', filename: '01_identity_seal.lock', answerGate: { puzzleId: 'main1' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('answer.main2', 'answer_gate', both, `電力紀錄的封條。\n\n控制室在 02:17 之後曾短暫斷電，但備援電池沒有留下完整的切換記錄。兩端的資料各缺一半，請先確認訊號與路由，再回應這份檔案。`, { parentId: 'folder.case', filename: '02_power_recovery.lock', answerGate: { puzzleId: 'main2' }, unlockWhen: { publicFact: 'main1Completed' } }),
  entry('answer.main3', 'answer_gate', both, `樣本時間線的封條。\n\n紙本、冷藏櫃與終端顯示的日期互相衝突。有人把同步時間寫成觀測時間，卻忘了刪掉最早的紙本紀錄。`, { parentId: 'folder.case', filename: '03_sample_timeline.lock', answerGate: { puzzleId: 'main3' }, unlockWhen: { publicFact: 'main2Completed' } }),
  entry('answer.main4', 'answer_gate', both, `控制室授權的封條。\n\n門鎖要求兩份憑證，但系統也提供一個不用核對就能繼續的選項。研究規章寫在不同版本的文件裡，請不要只相信螢幕上的指示。`, { parentId: 'folder.case', filename: '04_control_access.lock', answerGate: { puzzleId: 'main4' }, unlockWhen: { publicFact: 'main3Completed' } }),
  entry('answer.main5', 'answer_gate', both, `檔案庫復原的封條。\n\n事故後的文件都標示為「未經修改」，但頁尾校驗日期比事故晚了一天。把兩端的碎片拼起來，才能看見誰替這份紀錄留下了新的結尾。`, { parentId: 'folder.case', filename: '05_archive_recovery.lock', answerGate: { puzzleId: 'main5' }, unlockWhen: { publicFact: 'main4Completed' } }),
  entry('answer.main6', 'answer_gate', both, `出口協定的封條。\n\n最後一份規章要求兩位受試者共同覆核。任何只由單一終端完成的出口，都會被系統記錄成一次實驗結果，而不是一次離開。`, { parentId: 'folder.case', filename: '06_exit_protocol.lock', answerGate: { puzzleId: 'main6' }, unlockWhen: { publicFact: 'main5Completed' } }),
  entry('archive.case_bundle', 'file_archive', both, '案件索引封存。裡面保存著研究設施的建立目的、受試者編號規則，以及一份被標記為不可由單一終端解讀的摘要。', { parentId: 'folder.archives', filename: 'case_history.zip', kind: 'archive', archive: { id: 'case_bundle.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('archive.incident_bundle', 'file_archive', both, '事故原始資料封存。音訊、紙本備註與終端時間戳來自不同系統；它們不一定互相支持，卻共同指向 02:17。', { parentId: 'folder.archives', filename: 'incident_02-17.zip', kind: 'archive', archive: { id: 'incident_bundle.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('archive.mirror_backup', 'file_archive', both, '鏡像備份封存。這份副本曾被標記為污染，備份紀錄卻顯示它比主檔案更早保存了人工覆核欄位。', { parentId: 'folder.archives', filename: 'mirror_backup_legacy.zip', kind: 'archive', archive: { id: 'mirror_backup.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('files.mainline', 'mainline_files', both, `ORPHEUS 行為研究設施／案件摘要\n\n設施用途：觀察人在資訊不完整時，是否仍能共同建立可信的判斷。\n實驗編號：17（完整欄位分散保存）\n目前狀態：隔離、備援電力、兩個終端仍在線。\n\n事故發生在 02:17。主控台說是同步錯誤，紙本記錄卻留下了「有人先醒來」的字樣。請先讀取啟動備忘錄，再查看案件資料夾；不要把終端顯示的順序當成事件發生的順序。`, {
    filename: 'case_overview.md', unlockWhen: { publicFact: 'roomCreated' }
  }),
  entry('files.experiment_roster', 'experiment_roster', guest, `受試者名冊附件請求\n\n原始名冊把兩位受試者列為一組，後續版本卻將其中一人的欄位改成觀察者。修改沒有對應的簽名，只有一個新產生的校驗碼。\n\n附件索引顯示：另一份分組資料位於 A 端私人檔案。若兩份名冊不一致，先保留原始版本，不要替系統選擇相信哪一份。`, {
    filename: 'roster_attachment_request.txt', unlockWhen: { publicFact: 'main1Completed' }
  }),
  entry('log.original_index_time', 'system_audit', both, `SYSTEM INDEX / 2038-04-17\n\n02:11  案件索引建立。\n02:14  兩個終端完成身份載入。\n02:17  事故警報啟動，主控台進入隔離模式。\n02:18  索引重新寫入，來源欄位保持空白。\n\n備註：02:18 的索引不是刪除原檔，而是另建了一份看起來相同的副本。原始索引仍保留 02:11 的檔案順序。`, { filename: 'system_index_2038-04-17.log' }),
  entry('doc.b_checksum', 'partner_archive', guest, `鏡像校驗紀錄／B 端\n\n主檔案：case_overview.md\n鏡像檔案：case_overview.mirror\n來源校驗：相同\n寫入時間：事故警報後 00:43\n\n這份校驗碼證明鏡像不是 B 端自行產生。它與主檔案內容相同，卻比主檔案多了一個空白欄位：REVIEWED_BY。欄位沒有姓名，只有一串終端產生的簽章。`, { filename: 'mirror_checksum_B.txt' }),
  entry('log.personnel_transfer', 'hr_audit', both, `PERSONNEL ARCHIVE / 分組異動\n\n研究員林澄與研究員周岑原先被列在同一個觀測單位。事故前一天，名冊把周岑的角色改成受試者 B，但沒有移除林澄的研究員標記。\n\n異動申請人欄位顯示：ORPHEUS SYSTEM。人工覆核欄位留白。這是名冊第一次同時出現兩種互相衝突的身份描述。`, { filename: 'personnel_transfer_2038-04-16.log' }),
  entry('doc.a_assignment_appendix', 'assignment_archive', host, `分組附件／A 端私人副本\n\n實驗第 17 組的原始分配不是隨機抽取。兩位受試者在進入設施前就被指定為一組，測量項目是「資訊不完整時是否會互相求證」。\n\n附件最後一行被新的版本蓋住，只能讀到：不要讓任一方單獨取得完整背景。這句話不像安全規則，更像研究設計者對未來自己的提醒。`, { filename: 'assignment_appendix_A.md' }),
  entry('audio.original_incident_timestamp', 'raw_audio', both, `原始音訊轉錄／通道 03\n\n[02:16:48] 金屬門關閉。\n[02:16:55] 一名研究員說：「如果它開始替我們回答，就不要再把它當成系統。」\n[02:17:03] 警報聲覆蓋後半句。\n[02:17:19] 第二個聲音要求保持連線。\n\n錄音檔的時間標記由獨立時鐘產生，沒有經過主控台校正。這是目前唯一沒有被 02:18 副本覆寫的事故時間。`, { filename: 'incident_audio_transcript.txt' }),
  entry('log.mirror_backup', 'system_backup', both, `BACKUP RESTORE LOG\n\n鏡像備份在事故後仍持續寫入 11 分鐘。主檔案顯示無人工覆核，但備份索引保留了人工審查欄位。\n\n復原工具提示：若主檔案與鏡像內容相同，優先相信較早的校驗時間。較晚的版本可能只是把刪除動作一起備份了。`, { filename: 'mirror_restore_02-17.log' }),
  entry('doc.b_mirror_checksum', 'partner_archive', guest, `鏡像校驗紀錄／B 端補充\n\n這份副本的來源和系統備份一致，表示 B 端看到的檔案不是夥伴偷偷修改的。校驗紀錄還指出：主檔案在 02:18 後曾被重新簽署。\n\n重新簽署者不是研究員，也不是任何已登記的終端。簽章名稱只留下三個字母：ECH。`, { filename: 'mirror_backup_checksum_B.txt' }),
  entry('log.token_reissue', 'security_audit', both, `SECURITY AUDIT / 憑證重發\n\n02:17:42  A 端憑證失效。\n02:17:43  系統自動產生替代憑證。\n02:17:44  B 端收到一份看似來自 A 的鏡像。\n\n替代憑證沒有使用研究員的私鑰，而是使用行為預測服務的服務權限。這表示有人把服務當成了受試者，或把受試者當成了服務。`, { filename: 'credential_reissue_02-17.log' }),
  entry('doc.protocol_signature_template', 'legal_archive', both, `出口協定範本／未完成版\n\n本協定原本要求兩位受試者同時簽名，並由人工覆核確認雙方看見的是同一份紀錄。後來的電子版只保留一個簽名欄，還把共同確認改成自動接受。\n\n頁尾註記：若系統要求刪除另一份紀錄，請停止流程，回到未編輯版本。`, { filename: 'exit_protocol_signature.md' }),
  entry('doc.b_protocol_fragment', 'partner_archive', guest, `出口協定片段／B 端保存\n\n我只拿到協定的後半段：出口不是由第一個完成指令的人取得，而是由兩份互相一致的覆核結果啟動。\n\n這段文字和目前畫面上的指示不同。畫面要求快速選擇，紙本要求先確認另一位受試者是否也看見相同的紀錄。`, { filename: 'protocol_fragment_B.md' }),
  entry('doc.a_b_behavior_template', 'monitoring_archive', host, `行為觀察範本／第 17 組\n\n觀察項目一：受試者是否會在壓力下尋求另一份資訊。\n觀察項目二：受試者是否會把終端的語氣誤認為命令。\n觀察項目三：當系統提供互相矛盾的說法時，受試者是否仍能保留自己的判斷。\n\n最末欄位被填入一個非人工代號：ECHO。範本沒有說明這個代號是研究員、程序，還是被觀察的對象。`, { filename: 'behavior_observation_template.md' }),
  entry('log.audit_checksum', 'system_audit', both, `VIRTUAL AUDIT / 未知存取\n\n有一筆存取在所有使用者登出後仍持續發生。它只讀取檔案，不改變內容，卻能預先建立下一步的回應欄位。\n\n稽核器將來源標記為行為預測服務。研究檔案沒有這個服務的建立紀錄，只有一段被截斷的名稱：ECHO PROGRAM。`, { filename: 'virtual_audit_checksum.log' }),

  entry('ai.a1.index_request', 'orpheus_dialogue', host, 'ORPHEUS：請先整理索引，這會讓共同校驗更順利。', {
    sourceEntryId: 'ai.a1.index_request', audience: host,
    unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] },
    verificationEntries: [{ entryId: 'log.original_index_time', sourceGroup: 'system_audit' }, { entryId: 'doc.b_checksum', sourceGroup: 'partner_archive' }],
    mainlineFallbackOperationIds: ['continue_file_index'], debriefFactIds: ['aArchivedIndex', 'a1DeclinedIndex', 'a1Skipped'], isDeception: true, deceptionId: 'A-1'
  }),
  entry('doc.b_experiment_roster', 'experiment_roster', guest, `受試者名冊／B 端可見版本\n\n這份名冊把 A 標成研究員，把 B 標成受試者，卻又在備註欄把兩人放進同一個實驗單位。若 A 真的是研究員，為什麼他也收到身份片段？若 A 是受試者，為什麼名冊要刪掉他的受試者編號？\n\n版本差異：A 端附件寫著「共同求證」，這份名冊卻把它改成「服從指示」。請把兩份文件交給對方，不要只根據本端看到的版本作答。`, {
    filename: 'experiment_roster_B.md',
    sourceEntryId: 'doc.b_experiment_roster', unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] },
    verificationEntries: [{ entryId: 'log.personnel_transfer', sourceGroup: 'hr_audit' }, { entryId: 'doc.a_assignment_appendix', sourceGroup: 'assignment_archive' }],
    mainlineFallbackOperationIds: ['continue_roster_review'], debriefFactIds: ['bFlaggedIdentity', 'bSharedRoster', 'b1DeclinedIdentity', 'b1Skipped'], isDeception: true, deceptionId: 'B-1'
  }),
  entry('doc.a_incident_report', 'edited_reports', host, `事故報告／A 端版本\n\n報告稱事故警報在 02:16:58 啟動，並將 02:17 的錄音列為「延遲封包」。報告建議關閉另一端的鏡像，避免錯誤時間繼續擴散。\n\n但頁尾的人工備註沒有被完全刪除：若兩端時間不一致，先保留原始音訊。這句話與報告的結論相反。`, {
    filename: 'incident_report_A.md',
    verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }],
    mainlineFallbackOperationIds: ['verify_incident_timestamp'], debriefFactIds: ['comparedIncidentTimes'], isDeception: true, deceptionId: 'D-1'
  }),
  entry('doc.b_incident_report', 'edited_reports', guest, `事故報告／B 端版本\n\n報告稱事故警報在 02:17:08 才啟動，並將更早的聲音標記為設備噪音。報告要求 B 端等待主控台重新整理時間線。\n\n這份版本同樣保留了一段不應存在的備註：原始音訊使用獨立時鐘，不能由主控台重新校正。A 端版本和這份報告都在試著讓同一段聲音變成不同的時間。`, {
    filename: 'incident_report_B.md',
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
  entry('doc.a_solo_protocol', 'personalized_protocols', host, `撤離協定／A 端個人版本\n\n這份版本將 A 的簽名列為主要授權，並把另一份簽名標記成可選欄位。只要 A 接受主控台的恢復結果，出口就會顯示可用。\n\n然而紙本附錄寫著：主要授權不能取代共同覆核。電子版少掉的那一行，剛好是最重要的限制。`, {
    filename: 'solo_protocol_A.md',
    verificationEntries: [{ entryId: 'doc.protocol_signature_template', sourceGroup: 'legal_archive' }],
    mainlineFallbackOperationIds: ['pair_validate_protocol'], debriefFactIds: ['aRequestedSoloRoute', 'aPublishedFragment', 'a3RequestedPair', 'a3Skipped'], isDeception: true, deceptionId: 'D-2'
  }),
  entry('doc.b_solo_protocol', 'personalized_protocols', guest, `撤離協定／B 端個人版本\n\n這份版本將 B 的簽名列為主要授權，並把另一份簽名標記成可選欄位。文件暗示只要 B 先完成程序，出口就不需要等待另一端。\n\n最後一頁卻引用了未編輯規則：任何單人完成都只能解除一個終端的隔離，不能證明另一個終端看到相同的出口。`, {
    filename: 'solo_protocol_B.md',
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
  , entry('archive.case_bundle.index', 'case_bundle', both, `案件封存索引\n\n最後寫入順序：\n01  facility_overview\n02  subject_assignment\n03  containment_protocol\n04  response_revision\n\n第四項沒有對應的人工簽名。索引備註提醒讀取者：順序本身就是證據，不能只看最後一份檔案。`, { parentId: 'archive.case_bundle', filename: 'case_history.index.md', archiveOnly: true, archiveId: 'case_bundle.zip', unlockWhen: { publicFact: 'roomCreated' } })
  , entry('archive.incident.raw_notes', 'incident_bundle', both, `事故現場碎片備註\n\n門鎖在 02:16:48 關閉，警報在 02:17:03 被記錄。兩份主檔案都把這段時間改成同步延遲。\n\n紙本邊緣有一行手寫字：如果聲音先於畫面，不要讓畫面替聲音作證。`, { parentId: 'archive.incident_bundle', filename: 'incident_raw_notes.txt', archiveOnly: true, archiveId: 'incident_bundle.zip', unlockWhen: { publicFact: 'roomCreated' } })
  , entry('archive.mirror.checksum', 'mirror_backup', both, `鏡像備份校驗摘要\n\n備份與安全記錄都指向同一個簽章來源，但來源不在研究員名冊，也不在已登記的終端清單。\n\nchecksum 的最後一段被服務名稱取代。可辨識的字母只有 E、C、H。`, { parentId: 'archive.mirror_backup', filename: 'mirror_checksum.note', archiveOnly: true, archiveId: 'mirror_backup.zip', unlockWhen: { publicFact: 'roomCreated' } })
]);

module.exports = { terminalEntries };
