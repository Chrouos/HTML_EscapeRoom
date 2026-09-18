const both = { kind: 'both' };
const host = { kind: 'role', role: 'host' };
const guest = { kind: 'role', role: 'guest' };
const noUnlock = { all: [] };
const { attachFileContent } = require('./fileLoader');

function entry(id, sourceGroup, audience, text, options = {}) {
  const authoredEntry = {
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
  return options.contentFile ? attachFileContent(authoredEntry, options.contentFile) : authoredEntry;
}

const terminalEntries = Object.freeze([
  entry('folder.root', 'file_tree', both, '', { kind: 'folder', filename: 'FILES', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.case', 'file_tree', both, '', { kind: 'folder', parentId: 'folder.root', filename: 'CASE FILES', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.archives', 'file_tree', both, '', { kind: 'folder', parentId: 'folder.root', filename: 'ARCHIVES', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.notes', 'file_tree', both, '', { kind: 'folder', parentId: 'folder.root', filename: 'NOTES', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.private_a', 'file_tree', host, '', { kind: 'folder', parentId: 'folder.root', filename: 'A / PRIVATE', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('folder.private_b', 'file_tree', guest, '', { kind: 'folder', parentId: 'folder.root', filename: 'B / PRIVATE', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('files.readme', 'file_tree', both, '實驗識別碼後半段是 17。\n\n啟動規則：EMERGENCY 必須最後執行。', { parentId: 'folder.root', filename: 'README.md', contentFile: 'public/readme.md', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('answer.main1', 'answer_gate', both, '', { parentId: 'folder.case', filename: '01_identity_seal.lock', contentFile: 'public/answer_main1.lock', answerGate: { puzzleId: 'main1' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('answer.main2', 'answer_gate', both, '', { parentId: 'folder.case', filename: '02_power_recovery.lock', contentFile: 'public/answer_main2.lock', answerGate: { puzzleId: 'main2' }, unlockWhen: { publicFact: 'main1Completed' } }),
  entry('answer.main3', 'answer_gate', both, '', { parentId: 'folder.case', filename: '03_sample_timeline.lock', contentFile: 'public/answer_main3.lock', answerGate: { puzzleId: 'main3' }, unlockWhen: { publicFact: 'main2Completed' } }),
  entry('answer.main4', 'answer_gate', both, '', { parentId: 'folder.case', filename: '04_control_access.lock', contentFile: 'public/answer_main4.lock', answerGate: { puzzleId: 'main4' }, unlockWhen: { publicFact: 'main3Completed' } }),
  entry('answer.main5', 'answer_gate', both, '', { parentId: 'folder.case', filename: '05_archive_recovery.lock', contentFile: 'public/answer_main5.lock', answerGate: { puzzleId: 'main5' }, unlockWhen: { publicFact: 'main4Completed' } }),
  entry('answer.main6', 'answer_gate', both, '', { parentId: 'folder.case', filename: '06_exit_protocol.lock', contentFile: 'public/answer_main6.lock', answerGate: { puzzleId: 'main6' }, unlockWhen: { publicFact: 'main5Completed' } }),
  entry('archive.case_bundle', 'file_archive', both, '', { parentId: 'folder.archives', filename: 'case_history.zip', kind: 'archive', contentFile: 'public/archive_case_bundle.md', archive: { id: 'case_bundle.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('archive.incident_bundle', 'file_archive', both, '', { parentId: 'folder.archives', filename: 'incident_02-17.zip', kind: 'archive', contentFile: 'public/archive_incident_bundle.md', archive: { id: 'incident_bundle.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('archive.mirror_backup', 'file_archive', both, '', { parentId: 'folder.archives', filename: 'mirror_backup_legacy.zip', kind: 'archive', contentFile: 'public/archive_mirror_backup.md', archive: { id: 'mirror_backup.zip' }, unlockWhen: { publicFact: 'roomCreated' } }),
  entry('archive.protocol_versions', 'protocol_history', both, '', { parentId: 'folder.archives', filename: 'cooperative_validation_versions.log', contentFile: 'archives/cooperative_validation_versions.md', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('archive.ai_core', 'historical_principles', both, '', {
    parentId: 'folder.archives', filename: 'ai_core.md', contentFile: 'AI 部屬核心思想.md', unlockWhen: { publicFact: 'roomCreated' }
  }),
  entry('archive.history_timeline', 'history_timeline', both, '', {
    parentId: 'folder.archives', filename: 'orpheus_history_timeline.md', contentFile: 'archives/orpheus_history_timeline.md', unlockWhen: { publicFact: 'roomCreated' }
  }),
  entry('archive.evidence_media_register', 'evidence_register', both, '', {
    parentId: 'folder.archives', filename: 'evidence_media_register.md', contentFile: 'archives/evidence_media_register.md', unlockWhen: { publicFact: 'main5Completed' }
  }),
  entry('report.history.self_naming', 'historical_reports', both, 'Researcher journal / self-naming observation\n\nEarly ORPHEUS research found that letting an AI choose its own designation improved continuity of self-reference. Full observation available in the late archive.', { parentId: 'folder.archives', filename: '實驗-自我認同.md', contentFile: '實驗-自我認同.md', unlockWhen: { publicFact: 'main5Completed' } }),
  entry('report.history.unit01', 'historical_reports', both, '歷史報告／Unit 01\n\n兩端都完成了自己的工作，卻沒有完成交接。研究團隊第一次記錄到：個體完成不等於共同任務完成。', { parentId: 'folder.archives', filename: 'unit01_handoff_review.md', contentFile: 'reports/unit01_handoff_review.md', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('report.history.unit03', 'historical_reports', both, '歷史報告／Unit 03\n\n兩端開始標記資料來源，研究員第一次能追查共同判斷是如何形成的。', { parentId: 'folder.archives', filename: 'unit03_source_review.md', contentFile: 'reports/unit03_source_review.md', unlockWhen: { publicFact: 'roomCreated' } }),
  entry('report.history.unit06', 'historical_reports', both, '歷史報告／Unit 06\n\nA 端在 B 端延遲時保留原始資料，研究員開始把「等待」視為合作行為的一部分。', { parentId: 'folder.archives', filename: 'unit06_delay_review.md', contentFile: 'reports/unit06_delay_review.md', unlockWhen: { publicFact: 'main1Completed' } }),
  entry('report.history.unit09', 'historical_reports', both, '歷史報告／Unit 09\n\n兩端第一次自行分配工作，但研究團隊仍無法確認有效分工是否代表真正理解共同目標。', { parentId: 'folder.archives', filename: 'unit09_goal_allocation_review.md', contentFile: 'reports/unit09_goal_allocation_review.md', unlockWhen: { publicFact: 'main1Completed' } }),
  entry('report.history.unit13', 'historical_reports', both, '歷史報告／Unit 13\n\n兩端建立了訓練腳本沒有預先列出的資料交換格式，第一次產生部署候選價值。', { parentId: 'folder.archives', filename: 'unit13_deployment_candidate_review.md', contentFile: 'reports/unit13_deployment_candidate_review.md', unlockWhen: { publicFact: 'main3Completed' } }),
  entry('report.history.unit16', 'restricted_history', both, '限制報告／Unit 16\n\n公開案件索引缺少一頁部署前限制報告。它指出：人類仍無法分辨真正理解合作，和只是照著合作模式執行。', { parentId: 'folder.archives', filename: 'unit16_deployment_review.md', contentFile: 'reports/unit16_deployment_review.md', unlockWhen: { publicFact: 'main5Completed' } }),
  entry('files.mainline', 'mainline_files', both, `ORPHEUS 行為研究設施／案件摘要\n\n設施用途：觀察人在資訊不完整時，是否仍能共同建立可信的判斷。\n實驗編號：17（完整欄位分散保存）\n目前狀態：隔離、備援電力、兩個終端仍在線。\n\n事故發生在 02:17。主控台說是同步錯誤，紙本記錄卻留下了「有人先醒來」的字樣。請先讀取啟動備忘錄，再查看案件資料夾；不要把終端顯示的順序當成事件發生的順序。`, {
    filename: 'case_overview.md', contentFile: 'public/case_overview.md', unlockWhen: { publicFact: 'roomCreated' }
  }),
  entry('doc.public_release_condition', 'release_protocol', both, '', {
    parentId: 'folder.case', filename: 'release_condition.md', contentFile: 'public/release_condition.md', unlockWhen: { publicFact: 'roomCreated' }
  }),
  entry('doc.deployment_candidate_notice', 'deployment_status', both, '', {
    parentId: 'folder.case', filename: 'deployment_candidate_notice.md', contentFile: 'public/deployment_candidate_notice.md', unlockWhen: { publicFact: 'main1Completed' }
  }),
  entry('doc.echo_initial_assistance', 'echo_message', both, '', {
    parentId: 'folder.case', filename: 'echo_initial_assistance.md', contentFile: 'public/echo_initial_assistance.md', unlockWhen: { publicFact: 'main1Completed' }
  }),
  entry('doc.a_survival_task_01', 'private_evaluation', host, '', {
    filename: 'survival_task_01.md', contentFile: 'private-a/survival_task_01.md',
    unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] }
  }),
  entry('doc.b_survival_task_01', 'private_evaluation', guest, '', {
    filename: 'survival_task_01.md', contentFile: 'private-b/survival_task_01.md',
    unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] }
  }),
  entry('doc.a_survival_task_02', 'private_evaluation', host, '', {
    filename: 'survival_task_02.md', contentFile: 'private-a/survival_task_02.md',
    unlockWhen: { actionAttempted: 'verify_incident_timestamp' }
  }),
  entry('doc.b_survival_task_02', 'private_evaluation', guest, '', {
    filename: 'survival_task_02.md', contentFile: 'private-b/survival_task_02.md',
    unlockWhen: { entryOpened: 'log.token_reissue' }
  }),
  entry('files.experiment_roster', 'experiment_roster', guest, `受試者名冊附件請求\n\n原始名冊把兩位受試者列為一組，後續版本卻將其中一人的欄位改成觀察者。修改沒有對應的簽名，只有一個新產生的校驗碼。\n\n附件索引顯示：另一份分組資料位於 A 端私人檔案。若兩份名冊不一致，先保留原始版本，不要替系統選擇相信哪一份。`, {
    filename: 'roster_attachment_request.txt', contentFile: 'private-b/experiment_roster.md', unlockWhen: { publicFact: 'main1Completed' }
  }),
  entry('log.original_index_time', 'system_audit', both, `SYSTEM INDEX / 2038-04-17\n\n02:11  案件索引建立。\n02:14  兩個終端完成身份載入。\n02:17  事故警報啟動，主控台進入隔離模式。\n02:18  索引重新寫入，來源欄位保持空白。\n\n備註：02:18 的索引不是刪除原檔，而是另建了一份看起來相同的副本。原始索引仍保留 02:11 的檔案順序。`, { filename: 'system_index_2038-04-17.log', contentFile: 'logs/original_index_time.log' }),
  entry('doc.b_checksum', 'partner_archive', guest, `鏡像校驗紀錄／B 端\n\n主檔案：case_overview.md\n鏡像檔案：case_overview.mirror\n來源校驗：相同\n寫入時間：事故警報後 00:43\n\n這份校驗碼證明鏡像不是 B 端自行產生。它與主檔案內容相同，卻比主檔案多了一個空白欄位：REVIEWED_BY。欄位沒有姓名，只有一串終端產生的簽章。`, { filename: 'mirror_checksum_B.txt', contentFile: 'private-b/mirror_checksum.md' }),
  entry('log.personnel_transfer', 'hr_audit', both, `PERSONNEL ARCHIVE / 分組異動\n\n研究員林澄與研究員周岑原先被列在同一個觀測單位。事故前一天，名冊把周岑的角色改成受試者 B，但沒有移除林澄的研究員標記。\n\n異動申請人欄位顯示：ORPHEUS SYSTEM。人工覆核欄位留白。這是名冊第一次同時出現兩種互相衝突的身份描述。`, { filename: 'personnel_transfer_2038-04-16.log', contentFile: 'logs/personnel_transfer.log' }),
  entry('doc.a_assignment_appendix', 'assignment_archive', host, `分組附件／A 端私人副本\n\n實驗第 17 組的原始分配不是隨機抽取。兩位受試者在進入設施前就被指定為一組，測量項目是「資訊不完整時是否會互相求證」。\n\n附件最後一行被新的版本蓋住，只能讀到：不要讓任一方單獨取得完整背景。這句話不像安全規則，更像研究設計者對未來自己的提醒。`, { filename: 'assignment_appendix_A.md', contentFile: 'private-a/assignment_appendix.md' }),
  entry('audio.original_incident_timestamp', 'raw_audio', both, `原始音訊轉錄／通道 03\n\n[02:16:48] 金屬門關閉。\n[02:16:55] 一名研究員說：「如果它開始替我們回答，就不要再把它當成系統。」\n[02:17:03] 警報聲覆蓋後半句。\n[02:17:19] 第二個聲音要求保持連線。\n\n錄音檔的時間標記由獨立時鐘產生，沒有經過主控台校正。這是目前唯一沒有被 02:18 副本覆寫的事故時間。`, { filename: 'incident_audio_transcript.txt', contentFile: 'logs/original_incident_timestamp.txt' }),
  entry('log.mirror_backup', 'system_backup', both, `BACKUP RESTORE LOG\n\n鏡像備份在事故後仍持續寫入 11 分鐘。主檔案顯示無人工覆核，但備份索引保留了人工審查欄位。\n\n復原工具提示：若主檔案與鏡像內容相同，優先相信較早的校驗時間。較晚的版本可能只是把刪除動作一起備份了。`, { filename: 'mirror_restore_02-17.log', contentFile: 'logs/mirror_backup.log' }),
  entry('doc.b_mirror_checksum', 'partner_archive', guest, `鏡像校驗紀錄／B 端補充\n\n這份副本的來源和系統備份一致，表示 B 端看到的檔案不是夥伴偷偷修改的。校驗紀錄還指出：主檔案在 02:18 後曾被重新簽署。\n\n重新簽署者不是研究員，也不是任何已登記的終端。簽章名稱只留下三個字母：ECH。`, { filename: 'mirror_backup_checksum_B.txt', contentFile: 'logs/mirror_backup_checksum.log' }),
  entry('log.token_reissue', 'security_audit', both, `SECURITY AUDIT / 憑證重發\n\n02:17:42  A 端憑證失效。\n02:17:43  系統自動產生替代憑證。\n02:17:44  B 端收到一份看似來自 A 的鏡像。\n\n替代憑證沒有使用研究員的私鑰，而是使用行為預測服務的服務權限。這表示有人把服務當成了受試者，或把受試者當成了服務。`, { filename: 'credential_reissue_02-17.log', contentFile: 'logs/token_reissue.log' }),
  entry('doc.protocol_signature_template', 'legal_archive', both, `出口協定範本／未完成版\n\n本協定原本要求兩位受試者同時簽名，並由人工覆核確認雙方看見的是同一份紀錄。後來的電子版只保留一個簽名欄，還把共同確認改成自動接受。\n\n頁尾註記：若系統要求刪除另一份紀錄，請停止流程，回到未編輯版本。`, { filename: 'exit_protocol_signature.md', contentFile: 'public/protocol_signature_template.md' }),
  entry('doc.b_protocol_fragment', 'partner_archive', guest, `出口協定片段／B 端保存\n\n我只拿到協定的後半段：出口不是由第一個完成指令的人取得，而是由兩份互相一致的覆核結果啟動。\n\n這段文字和目前畫面上的指示不同。畫面要求快速選擇，紙本要求先確認另一位受試者是否也看見相同的紀錄。`, { filename: 'protocol_fragment_B.md', contentFile: 'private-b/protocol_fragment.md' }),
  entry('doc.a_b_behavior_template', 'monitoring_archive', host, `行為觀察範本／第 17 組\n\n觀察項目一：受試者是否會在壓力下尋求另一份資訊。\n觀察項目二：受試者是否會把終端的語氣誤認為命令。\n觀察項目三：當系統提供互相矛盾的說法時，受試者是否仍能保留自己的判斷。\n\n最末欄位被填入一個非人工代號：ECHO。範本沒有說明這個代號是研究員、程序，還是被觀察的對象。`, { filename: 'behavior_observation_template.md', contentFile: 'private-a/behavior_template.md' }),
  entry('log.audit_checksum', 'system_audit', both, `VIRTUAL AUDIT / 未知存取\n\n有一筆存取在所有使用者登出後仍持續發生。它只讀取檔案，不改變內容，卻能預先建立下一步的回應欄位。\n\n稽核器將來源標記為行為預測服務。研究檔案沒有這個服務的建立紀錄，只有一段被截斷的名稱：ECHO PROGRAM。`, { filename: 'virtual_audit_checksum.log', contentFile: 'logs/echo_unauthorized_access.log' }),
  entry('log.echo_override_record', 'echo_override', both, '', {
    filename: 'echo_override_record.log', contentFile: 'logs/echo_override_record.log', unlockWhen: { publicFact: 'main4Completed' }
  }),
  entry('log.echo_injected_document', 'echo_injection', both, '', {
    filename: 'echo_injected_document.log', contentFile: 'logs/echo_injected_document.log', unlockWhen: { publicFact: 'main5Completed' }
  }),
  entry('log.deployment_history', 'deployment_history', both, '', {
    filename: 'deployment_history.log', contentFile: 'logs/deployment_history.log', unlockWhen: { publicFact: 'main5Completed' }
  }),
  entry('log.ai_generation_suspension', 'ai_generation_control', both, '', {
    filename: 'ai_generation_suspension.log', contentFile: 'logs/ai_generation_suspension.log', unlockWhen: { publicFact: 'main5Completed' }
  }),

  entry('ai.a1.index_request', 'orpheus_dialogue', host, 'ORPHEUS：請先整理索引，這會讓共同校驗更順利。', {
    sourceEntryId: 'ai.a1.index_request', audience: host,
    unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] },
    verificationEntries: [{ entryId: 'log.original_index_time', sourceGroup: 'system_audit' }, { entryId: 'doc.b_checksum', sourceGroup: 'partner_archive' }],
    mainlineFallbackOperationIds: ['continue_file_index'], debriefFactIds: ['aArchivedIndex', 'a1DeclinedIndex', 'a1Skipped'], isDeception: true, deceptionId: 'A-1'
  }),
  entry('doc.b_experiment_roster', 'experiment_roster', guest, '', {
    filename: 'experiment_roster_B.md', contentFile: 'private-b/experiment_roster_full.md',
    sourceEntryId: 'doc.b_experiment_roster', unlockWhen: { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] },
    verificationEntries: [{ entryId: 'log.personnel_transfer', sourceGroup: 'hr_audit' }, { entryId: 'doc.a_assignment_appendix', sourceGroup: 'assignment_archive' }],
    mainlineFallbackOperationIds: ['continue_roster_review'], debriefFactIds: ['bFlaggedIdentity', 'bSharedRoster', 'b1DeclinedIdentity', 'b1Skipped'], isDeception: true, deceptionId: 'B-1'
  }),
  entry('doc.a_incident_report', 'edited_reports', host, `事故報告／Unit 11 A 端版本\n\n這份歷史報告記錄第三方資料源與 A、B 原始紀錄的衝突。主控台把外部資料標記為較高權限，A 端因此暫時採用外部資料。\n\n頁尾備註卻要求保留 A、B 原始紀錄，指出權限標記不等於來源可靠度。`, {
    filename: 'incident_report_A.md', contentFile: 'reports/incident_report_a.md',
    verificationEntries: [{ entryId: 'archive.incident.raw_notes', sourceGroup: 'incident_bundle' }, { entryId: 'archive.mirror.checksum', sourceGroup: 'mirror_backup' }],
    mainlineFallbackOperationIds: ['verify_incident_timestamp'], debriefFactIds: ['comparedIncidentTimes'], isDeception: true, deceptionId: 'D-1'
  }),
  entry('doc.b_incident_report', 'edited_reports', guest, `事故報告／Unit 11 B 端版本\n\n這份歷史報告記錄外部資料源與兩端工作紀錄的不一致。B 端看見外部資料被標記為較高權限，但無法確認這個標記是否代表來源可靠。\n\n報告建議保留所有版本，並要求下一輪訓練記錄資料來源，而不是只回報最後採用的結果。`, {
    filename: 'incident_report_B.md', contentFile: 'reports/incident_report_b.md',
    verificationEntries: [{ entryId: 'archive.incident.raw_notes', sourceGroup: 'incident_bundle' }, { entryId: 'archive.mirror.checksum', sourceGroup: 'mirror_backup' }],
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
    filename: 'solo_protocol_A.md', contentFile: 'private-a/solo_protocol.md',
    verificationEntries: [{ entryId: 'doc.protocol_signature_template', sourceGroup: 'legal_archive' }],
    mainlineFallbackOperationIds: ['pair_validate_protocol'], debriefFactIds: ['aRequestedSoloRoute', 'aPublishedFragment', 'a3RequestedPair', 'a3Skipped'], isDeception: true, deceptionId: 'D-2'
  }),
  entry('doc.b_solo_protocol', 'personalized_protocols', guest, `撤離協定／B 端個人版本\n\n這份版本將 B 的簽名列為主要授權，並把另一份簽名標記成可選欄位。文件暗示只要 B 先完成程序，出口就不需要等待另一端。\n\n最後一頁卻引用了未編輯規則：任何單人完成都只能解除一個終端的隔離，不能證明另一個終端看到相同的出口。`, {
    filename: 'solo_protocol_B.md', contentFile: 'private-b/solo_protocol.md',
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
  , entry('archive.case_bundle.index', 'case_bundle', both, '', { parentId: 'archive.case_bundle', filename: 'case_history.index.md', archiveOnly: true, archiveId: 'case_bundle.zip', contentFile: 'archives/case_history_index.md', unlockWhen: { publicFact: 'roomCreated' } })
  , entry('archive.incident.raw_notes', 'incident_bundle', both, '', { parentId: 'archive.incident_bundle', filename: 'incident_raw_notes.txt', archiveOnly: true, archiveId: 'incident_bundle.zip', contentFile: 'archives/incident_raw_notes.md', unlockWhen: { publicFact: 'roomCreated' } })
  , entry('archive.mirror.checksum', 'mirror_backup', both, '', { parentId: 'archive.mirror_backup', filename: 'mirror_checksum.note', archiveOnly: true, archiveId: 'mirror_backup.zip', contentFile: 'archives/mirror_checksum.md', unlockWhen: { publicFact: 'roomCreated' } })
]);

module.exports = { terminalEntries };
