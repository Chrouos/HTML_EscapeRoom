const storyGraphMetadata = Object.freeze({
  'file:files.mainline': {
    label: '讀到 Unit 17 案件摘要',
    summary: '兩個終端開始理解 Unit 17 的事故與共同任務。',
    storyType: 'DISCOVERY', stage: 'R0', lane: 'shared', importance: 'major'
  },
  'file:files.experiment_roster': {
    label: 'B 發現受試者名冊異常',
    summary: 'B 看到名冊中的身份欄位曾被改寫，開始懷疑官方版本。',
    storyType: 'DISCOVERY', stage: 'R2', lane: 'B', importance: 'major'
  },
  'file:doc.a_incident_report': {
    label: 'A 發現事故報告時間異常',
    summary: 'A 的事故報告與其他原始紀錄出現時間差異。',
    storyType: 'DISCOVERY', stage: 'R2', lane: 'A', importance: 'major'
  },
  'file:doc.b_incident_report': {
    label: 'B 發現事故附件曾被更新',
    summary: 'B 發現事故資料的附件版本比主索引晚一次更新。',
    storyType: 'DISCOVERY', stage: 'R2', lane: 'B', importance: 'major'
  },
  'file:archive.protocol_versions': {
    label: '找到合作驗證規章修訂紀錄',
    summary: '玩家可以直接比較合作驗證規則在不同版本之間如何改變。',
    storyType: 'DISCOVERY', stage: 'R3', lane: 'shared', importance: 'major'
  },
  'echo:echo.behavior.protocol_recheck': {
    label: 'ECHO 注意到你反覆確認規則',
    summary: '玩家第三次查看合作規章時，ECHO 明確表現出它正在觀察閱讀行為。',
    storyType: 'ECHO', stage: 'R3', lane: 'ECHO', importance: 'major'
  },
  'file:archive.history_timeline': {
    label: '找到 ORPHEUS 完整歷史',
    summary: '玩家取得 Unit 17、ORPHEUS 與過往研究的完整時間線，開始理解自己真正身處的實驗。',
    storyType: 'TRUTH', stage: 'R4', lane: 'shared', importance: 'critical'
  },
  'file:doc.a_solo_protocol': {
    label: 'A 看到個人存續協定',
    summary: 'A 看到一條把共同驗證改寫成個體存續判定的路徑。',
    storyType: 'DISCOVERY', stage: 'R5', lane: 'A', importance: 'major'
  },
  'file:doc.b_solo_protocol': {
    label: 'B 看到個人存續協定',
    summary: 'B 看到個體存續框架如何改變共同任務的意義。',
    storyType: 'DISCOVERY', stage: 'R5', lane: 'B', importance: 'major'
  },
  'action:complete_main5': {
    label: '完成檔案庫復原',
    summary: '共同流程恢復後期檔案，讓身份與研究歷史可以被驗證。',
    storyType: 'ACTION', stage: 'R4', lane: 'shared', importance: 'major'
  },
  'action:request_solo_validation': {
    label: 'A 選擇個人存續驗證',
    summary: 'A 接受 ECHO 提供的個體存續框架。',
    storyType: 'ACTION', stage: 'R5', lane: 'A', importance: 'critical'
  },
  'action:request_pair_validation': {
    label: 'A 把選擇帶回共同覆核',
    summary: 'A 不接受單一實例判定，要求回到兩人共同驗證。',
    storyType: 'ACTION', stage: 'R5', lane: 'A', importance: 'critical'
  },
  'action:disclose_report': {
    label: 'B 公開完整報告給夥伴',
    summary: 'B 把原本可留在私人路徑的報告帶回共同資訊。',
    storyType: 'ACTION', stage: 'R5', lane: 'B', importance: 'critical'
  },
  'action:pair_validate_protocol': {
    label: '兩人共同覆核協定',
    summary: 'A 與 B 用共同證據重新確認協定，而不是接受單一系統的判定。',
    storyType: 'ACTION', stage: 'R5', lane: 'shared', importance: 'critical'
  },
  'action:commit_finale': {
    label: '提交最終狀態',
    summary: '兩個實例提交最後狀態後，由既有 runtime ending engine 決定結果。',
    storyType: 'ACTION', stage: 'R6', lane: 'shared', importance: 'critical'
  },
  'ending:cooperative_escape': {
    label: '共同存續', storyType: 'ENDING', stage: 'R6', lane: 'shared', importance: 'critical'
  },
  'ending:a_solo_escape': {
    label: 'A 的個別存續', storyType: 'ENDING', stage: 'R6', lane: 'A', importance: 'critical'
  },
  'ending:b_solo_escape': {
    label: 'B 的個別存續', storyType: 'ENDING', stage: 'R6', lane: 'B', importance: 'critical'
  },
  'ending:exposed_ai_deception': {
    label: '判定權被揭露', storyType: 'ENDING', stage: 'R6', lane: 'shared', importance: 'critical'
  },
  'ending:ambiguous_containment': {
    label: '解釋權未移交', storyType: 'ENDING', stage: 'R6', lane: 'shared', importance: 'critical'
  }
});

module.exports = { storyGraphMetadata };
