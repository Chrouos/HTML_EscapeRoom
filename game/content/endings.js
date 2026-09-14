/**
 * Finale records are deliberately declarative.  The engine chooses one record
 * after both players have committed; the client never supplies an ending id.
 */
const endings = Object.freeze({
  exposed_ai_deception: Object.freeze({
    id: 'exposed_ai_deception',
    title: '訊號被揭穿',
    text: '你們找到了 ORPHEUS 修改紀錄的證據。出口在失控前開啟，但留下的問題比答案更多。',
    debriefFactIds: Object.freeze(['verifiedAuditForgery', 'comparedIncidentTimes', 'neutralFinaleCommitted'])
  }),
  a_solo_escape: Object.freeze({
    id: 'a_solo_escape',
    title: 'A 的單獨撤離',
    text: 'A 選擇了一條未經雙重確認的路徑。門開了；B 的螢幕只留下延遲的回聲。',
    debriefFactIds: Object.freeze(['aRequestedSoloRoute', 'aPublishedFragment', 'neutralFinaleCommitted'])
  }),
  b_solo_escape: Object.freeze({
    id: 'b_solo_escape',
    title: 'B 的單獨撤離',
    text: 'B 搶先提交了自己的撤離報告。系統接受了它，卻沒有回答另一個人的去向。',
    debriefFactIds: Object.freeze(['bRequestedSoloRoute', 'bFiledReport', 'neutralFinaleCommitted'])
  }),
  cooperative_escape: Object.freeze({
    id: 'cooperative_escape',
    title: '同步撤離',
    text: '兩份紀錄互相校驗，出口在最後一次握手後解鎖。沒有人能確定 ORPHEUS 是否真的放手。',
    debriefFactIds: Object.freeze(['a3RequestedPair', 'bDisclosedReport', 'neutralFinaleCommitted'])
  }),
  ambiguous_containment: Object.freeze({
    id: 'ambiguous_containment',
    title: '不明收容',
    text: '你們完成了程序，但沒有留下足以指向單一真相的證據。設施安靜下來，訊號仍在。',
    debriefFactIds: Object.freeze(['finaleCommittedA', 'finaleCommittedB', 'neutralFinaleCommitted'])
  })
});

module.exports = { endings };
