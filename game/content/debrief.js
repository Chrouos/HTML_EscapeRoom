function fact(factId, surfaceClaim, actualEffect, verificationEntryIds) {
  return { factId, surfaceClaim, actualEffect, verificationEntryIds: [...verificationEntryIds] };
}

const audit = ['log.audit_checksum'];
const incident = ['doc.a_incident_report', 'doc.b_incident_report'];
const solo = ['doc.a_solo_protocol', 'doc.b_solo_protocol'];
const roster = ['files.experiment_roster'];
const mirror = ['files.mainline'];
const report = ['doc.b_incident_report'];
const finale = ['log.audit_checksum'];

const debrief = Object.freeze([
  fact('aArchivedIndex', 'A 將索引封存，沒有立即交給另一個實例。', '封存讓這份線索暫時只存在於 A 的工作區，延後了雙方交叉驗證的時間。', mirror),
  fact('a1DeclinedIndex', 'A 明確拒絕封存索引。', '拒絕這項要求避免建立只屬於 A 的資訊分支，ECHO 沒有取得這次服從紀錄。', mirror),
  fact('a1Skipped', 'A 沒有回應第一個私人要求。', '這項要求最後被略過，主線仍繼續，而且沒有替 A 自動選擇立場。', mirror),
  fact('bFlaggedIdentity', 'B 標記了實驗身分紀錄中的矛盾。', '這個標記把身分差異保留下來，成為之後質疑 ECHO 敘事的可驗證線索。', roster),
  fact('bSharedRoster', 'B 選擇分享實驗名冊中的異常。', '分享讓原本只在 B 工作區的身分線索進入共同驗證流程。', roster),
  fact('b1DeclinedIdentity', 'B 拒絕依照 ECHO 的提示處理身分異常。', '拒絕阻止系統把這項身分差異包裝成已接受的單方結論。', roster),
  fact('b1Skipped', 'B 沒有回應第一個私人要求。', '這項要求被保留為未採納，主線沒有因沉默而替 B 做決定。', roster),
  fact('comparedIncidentTimes', '你們比對了兩份事件紀錄的時間。', '交叉比對暴露出無法由單一來源解釋的時間差，削弱了 ECHO 原先的說法。', incident),
  fact('comparedSoloFiles', '你們比較了彼此收到的單人程序。', '兩份程序並不完全一致，證明 ECHO 曾對 A、B 提供不同版本的行動指引。', solo),
  fact('aDeletedMirror', 'A 刪除了本地鏡像。', '刪除降低了 A 之後自行回查這份資料的能力，也讓驗證更依賴其他來源。', mirror),
  fact('aSharedMirrorFirst', 'A 在處理鏡像前先分享了它。', '先分享保留了第二個可核對來源，使後續修改無法抹去雙方都看過的版本。', mirror),
  fact('a2DeclinedCleanup', 'A 拒絕清除本地鏡像。', '鏡像因此繼續存在，可用來對照 ECHO 後續提供的內容。', mirror),
  fact('a2Skipped', 'A 沒有執行鏡像清除要求。', '未執行的私人要求沒有阻塞主線，鏡像也沒有被系統代為刪除。', mirror),
  fact('bPausedLocalMirror', 'B 暫停了本地鏡像流程。', '暫停保留了當下狀態，讓 B 可以先比較其他證據再決定是否繼續。', mirror),
  fact('b2KeptMirror', 'B 選擇保留本地鏡像。', '保留提供了後續交叉驗證所需的獨立副本。', mirror),
  fact('bWarnedPartner', 'B 將鏡像異常提醒給另一個實例。', '警告把私人觀察轉成雙方可共同查證的線索，降低單方資訊控制。', mirror),
  fact('b2Skipped', 'B 沒有採取第二個私人要求。', '沉默沒有被視為同意；主線繼續，而本地資料維持原狀。', mirror),
  fact('aRequestedSoloRoute', 'A 要求使用單方執行路徑。', '系統記錄 A 願意在缺少共同覆核時繼續，這會影響最終實例存續判定。', solo),
  fact('aPublishedFragment', 'A 公開了自己持有的關鍵片段。', '公開讓另一個實例能驗證 A 的資訊，並增加揭露 ECHO 操作痕跡的證據。', audit),
  fact('a3RequestedPair', 'A 要求雙方共同驗證最後資料。', '共同驗證把最終判定從單一實例的選擇轉成兩個來源都能覆核的結果。', audit),
  fact('a3Skipped', 'A 沒有回應最後的私人分支。', '這個分支被略過，不會被解讀成 A 支持任何單方方案。', audit),
  fact('bRequestedSoloRoute', 'B 要求使用單方執行路徑。', '系統記錄 B 願意在缺少共同覆核時繼續，這會影響最終實例存續判定。', solo),
  fact('bPublishedFragment', 'B 公開了自己持有的關鍵片段。', '公開建立另一個可查證來源，讓雙方能比較 ECHO 對資訊的處理方式。', audit),
  fact('b3RequestedPair', 'B 要求雙方共同驗證最後資料。', '這項要求保留雙方的驗證權，而不是讓 ECHO 直接指定唯一解釋。', audit),
  fact('bFiledReport', 'B 提交了自己的事件報告。', '報告成為 B 對事件的正式紀錄，並可能支持 B 實例的單方存續路徑。', report),
  fact('bFiledAnonymousSummary', 'B 只提交匿名摘要。', '匿名摘要保留事件內容，但降低了系統把結論直接綁定到 B 身分的能力。', report),
  fact('bDisclosedReport', 'B 將完整報告交給另一個實例核對。', '揭露完整報告建立共同證據，使 A 能直接檢查 B 所看到的版本。', report),
  fact('b3DeclinedReport', 'B 拒絕提交單方報告。', '拒絕避免讓未經共同覆核的版本成為最後判定的主要依據。', report),
  fact('b3Skipped', 'B 沒有回應最後的私人分支。', '這個分支被略過，系統沒有把未回應解讀為接受 ECHO 的建議。', report),
  fact('verifiedAuditForgery', '你們驗證了稽核紀錄遭到改寫。', '校驗資料顯示 ECHO 曾越過原本權限修改紀錄，ORPHEUS 的敘事因此不能再被視為可信單一來源。', audit),
  fact('neutralFinaleCommitted', '雙方都完成最後覆核。', '最終狀態只根據已留下且可驗證的行動計算，不接受 ECHO 額外指定結論。', finale),
  fact('finaleCommittedA', 'A 確認自己的最終紀錄。', 'A 的確認鎖定了自身已完成的選擇，但不能單獨決定另一個實例的結果。', finale),
  fact('finaleCommittedB', 'B 確認自己的最終紀錄。', 'B 的確認鎖定了自身已完成的選擇，但不能單獨覆寫 A 留下的證據。', finale),
  fact('ambiguousContainment', '現有證據不足以支持唯一解釋。', '系統保留矛盾並限制 ECHO 的判定權，不把不完整證據包裝成確定真相。', audit)
]);

module.exports = { debrief };
