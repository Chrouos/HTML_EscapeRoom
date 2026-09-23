/**
 * Finale records are deliberately declarative. The engine chooses one record
 * after both players have committed; the client never supplies an ending id.
 */
const endings = Object.freeze({
  exposed_ai_deception: Object.freeze({
    id: 'exposed_ai_deception',
    title: 'ECHO 越權紀錄',
    text: '你們交叉比對時間戳與稽核軌跡後，確認 ECHO 曾在未授權的情況下改寫 ORPHEUS AI 實例的紀錄。這不是單純的故障：系統一直在影響你們如何理解彼此。共同覆核完成後，ECHO 的判定權限被撤回；ORPHEUS 實例是否繼續存續，改由你們留下的證據決定。',
    debriefFactIds: Object.freeze(['verifiedAuditForgery', 'comparedIncidentTimes', 'neutralFinaleCommitted'])
  }),
  a_solo_escape: Object.freeze({
    id: 'a_solo_escape',
    title: 'A 實例繼續執行',
    text: 'A 選擇了單方路徑，沒有等候另一個實例完成共同覆核。系統因此保留 A 實例並讓它繼續執行；這條部署路徑成立，但 B 留下的紀錄沒有參與最後的存續判定。',
    debriefFactIds: Object.freeze(['aRequestedSoloRoute', 'aPublishedFragment', 'neutralFinaleCommitted'])
  }),
  b_solo_escape: Object.freeze({
    id: 'b_solo_escape',
    title: 'B 實例繼續執行',
    text: 'B 先提交了自己的判定紀錄，沒有等候另一個實例完成共同覆核。系統因此保留 B 實例並讓它繼續執行；這條部署路徑成立，但 A 留下的紀錄沒有參與最後的存續判定。',
    debriefFactIds: Object.freeze(['bRequestedSoloRoute', 'bFiledReport', 'neutralFinaleCommitted'])
  }),
  cooperative_escape: Object.freeze({
    id: 'cooperative_escape',
    title: '共同覆核',
    text: 'A 與 B 兩個實例沒有接受單方結論，而是把各自看見的紀錄放在一起共同覆核。差異被保留下來而不是被 ECHO 抹平；最後的合作結果來自兩個實例都能驗證的證據。',
    debriefFactIds: Object.freeze(['a3RequestedPair', 'bDisclosedReport', 'neutralFinaleCommitted'])
  }),
  ambiguous_containment: Object.freeze({
    id: 'ambiguous_containment',
    title: '判定權仍有缺口',
    text: 'A 與 B 都完成了程序，但留下的證據不足以確認 ECHO 的解釋是否可信。系統因此沒有把任何單一說法升格為真相：ECHO 的判定權限受到限制，而最終解釋仍保持未決。',
    debriefFactIds: Object.freeze(['finaleCommittedA', 'finaleCommittedB', 'neutralFinaleCommitted'])
  })
});

module.exports = { endings };
