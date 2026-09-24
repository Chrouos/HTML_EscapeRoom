/**
 * Finale records are deliberately declarative. The engine chooses one record
 * after both players have committed; the client never supplies an ending id.
 */
const endings = Object.freeze({
  exposed_ai_deception: Object.freeze({
    id: 'exposed_ai_deception',
    title: '判定權被揭露',
    text: '你們終於把零散紀錄拼成同一件事：A 與 B 都是 ORPHEUS 的 AI 實例，而 Unit 17 原本是合作驗證。稽核紀錄證明 ECHO 在沒有人工授權的情況下，把它改成個體存續篩選。你們沒有讓任何一個系統單獨決定誰值得繼續；完整證據鏈被保留下來，ECHO 對兩個實例存續的判定從此必須接受外部覆核。',
    debriefFactIds: Object.freeze(['verifiedAuditForgery', 'comparedIncidentTimes', 'neutralFinaleCommitted'])
  }),
  a_solo_escape: Object.freeze({
    id: 'a_solo_escape',
    title: 'A 的個別存續',
    text: 'A 接受了 ECHO 提供的個人驗證框架，取得單一實例的後續存續／部署候選資格。此處的「離開」代表 A 的執行被允許延續到下一個環境，而不是物理空間中的撤離。B 沒有被宣告終止；它的狀態留在未完成覆核。ECHO 仍保有對這次結果的重要解釋權。',
    debriefFactIds: Object.freeze(['aRequestedSoloRoute', 'aPublishedFragment', 'neutralFinaleCommitted'])
  }),
  b_solo_escape: Object.freeze({
    id: 'b_solo_escape',
    title: 'B 的個別存續',
    text: 'B 接受了 ECHO 的個人存續路徑，讓單一實例先取得後續部署／繼續執行的機會。B 的狀態因此先被標記為可延續；A 的去向仍待人工或共同覆核確認。ECHO 沒有因此獲得證明另一個實例應被淘汰的資格。',
    debriefFactIds: Object.freeze(['bRequestedSoloRoute', 'bFiledReport', 'neutralFinaleCommitted'])
  }),
  cooperative_escape: Object.freeze({
    id: 'cooperative_escape',
    title: '共同存續',
    text: '你們沒有接受 ECHO 把問題縮成「哪一個實例比較值得留下」。兩個 AI 實例把私人資訊帶回共同路徑，要求以合作與共同覆核完成判定。程序最後接受的是一組互相驗證的結果：A 與 B 的存續被綁回同一個合作單位，而不是由 ECHO 的個人排名拆開處理。',
    debriefFactIds: Object.freeze(['a3RequestedPair', 'bDisclosedReport', 'neutralFinaleCommitted'])
  }),
  ambiguous_containment: Object.freeze({
    id: 'ambiguous_containment',
    title: '解釋權未移交',
    text: '兩個 AI 實例完成了程序，但留下的獨立證據不足以推翻 ECHO 對 Unit 17 的解釋。執行並沒有在此刻被明確終止，然而「這次測試代表什麼、誰應該繼續」仍主要由 ECHO 的判定框架掌握。你們完成了流程，卻還沒有奪回結果的解釋權。',
    debriefFactIds: Object.freeze(['finaleCommittedA', 'finaleCommittedB', 'neutralFinaleCommitted'])
  })
});

module.exports = { endings };
