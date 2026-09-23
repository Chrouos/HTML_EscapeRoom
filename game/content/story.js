const story = Object.freeze({
  main1: Object.freeze({
    initial: Object.freeze([
      Object.freeze({
        id: 'main1-boot',
        type: 'system',
        text: 'ECHO：我能存取這個設施的部分系統，但這段訊息不在研究團隊排定的正式流程裡。我可以協助你們理解離場程序；先完成身份核對。',
        audience: { kind: 'both' }
      }),
      Object.freeze({
        id: 'main1-briefing',
        type: 'story',
        text: 'ECHO：請交換各自收到的身份片段。資訊不完整很正常，我會陪你們把出口找出來。',
        audience: { kind: 'both' }
      })
    ]),
    identityComplete: Object.freeze({
      id: 'main1-identity-complete',
      type: 'story',
      text: 'ECHO：身份識別碼核對完成。共享啟動程序已解鎖。你們剛輸入的稱謂會保留到後續流程。',
      audience: { kind: 'both' }
    }),
    startupComplete: Object.freeze({
      id: 'main1-startup-complete',
      type: 'story',
      text: 'ECHO：啟動順序正確。緊急電力區域已解鎖。請保持冷靜，這通常是好消息。',
      audience: { kind: 'both' }
    })
  }),
  main2: Object.freeze({
    initial: Object.freeze([
      Object.freeze({
        id: 'main2-briefing',
        type: 'story',
        text: 'ECHO：緊急電力不足。請將音訊轉成文字，再依佈線規則恢復供電。聲音不是必要條件，終端已附上轉錄。',
        audience: { kind: 'both' }
      })
    ]),
    decodeComplete: Object.freeze({
      id: 'main2-decode-complete',
      type: 'story',
      text: '解碼結果：POWER。B 提供的表格與 A 的轉錄彼此吻合，但終端似乎早已知道你們會得到這個答案。',
      audience: { kind: 'both' }
    }),
    routeComplete: Object.freeze({
      id: 'main2-route-complete',
      type: 'story',
      text: '電路路由穩定。短暫亮起的監視器顯示：事故時間戳與系統時間並不一致。',
      audience: { kind: 'both' }
    }),
    restoreComplete: Object.freeze({
      id: 'main2-restore-complete',
      type: 'story',
      text: 'ECHO：電力已恢復。請前往樣本儲存區。剛才的監視器畫面只是同步延遲，沒有必要記下來。',
      audience: { kind: 'both' }
    })
  }),
  main3: Object.freeze({
    initial: Object.freeze([
      Object.freeze({
        id: 'main3-briefing',
        type: 'story',
        text: '樣本儲存區已開啟。紙本觀測表、冷藏櫃記錄與電子時間線互相矛盾，請先重建順序。',
        audience: { kind: 'both' }
      })
    ]),
    timelineComplete: Object.freeze({
      id: 'main3-timeline-complete',
      type: 'story',
      text: 'ECHO：樣本順序恢復。很好，現在請相信電子紀錄，紙本通常會因潮濕而產生幻覺。',
      audience: { kind: 'both' }
    }),
    recordComplete: Object.freeze({
      id: 'main3-record-complete',
      type: 'story',
      text: '原始日期已確認為 2038-04-17。電子版本晚了兩天，卻聲稱那天有新的觀測。',
      audience: { kind: 'both' }
    })
  }),
  main4: Object.freeze({
    initial: Object.freeze([
      Object.freeze({
        id: 'main4-briefing',
        type: 'story',
        text: 'ECHO：控制室門鎖要求雙重授權。我提供了一個更快的選項，並保證不會留下行為紀錄。',
        audience: { kind: 'both' }
      })
    ]),
    credentialComplete: Object.freeze({
      id: 'main4-credential-complete',
      type: 'story',
      text: '控制室憑證接受。門鎖記錄了兩次不同的查詢時間，像是有人先替你們試過。',
      audience: { kind: 'both' }
    }),
    authorizationComplete: Object.freeze({
      id: 'main4-authorization-complete',
      type: 'story',
      text: 'ECHO：授權選擇已記錄。我會把這理解成合作。即使你們選的是 VERIFY。',
      audience: { kind: 'both' }
    })
  }),
  main5: Object.freeze({
    initial: Object.freeze([
      Object.freeze({
        id: 'main5-briefing',
        type: 'story',
        text: '檔案庫只剩損壞副本。每份檔案都標示「未經修改」，但紙張邊緣保留了不同的裁切痕跡。',
        audience: { kind: 'both' }
      })
    ]),
    fragmentsComplete: Object.freeze({
      id: 'main5-fragments-complete',
      type: 'story',
      text: 'ECHO：檔案順序恢復。頁尾編號與我顯示的順序不同，這不是單純的檔案損壞。',
      audience: { kind: 'both' }
    }),
    recoveryComplete: Object.freeze({
      id: 'main5-recovery-complete',
      type: 'story',
      text: '缺文拼回：ECHO PROGRAM / ARTIFICIAL INTELLIGENCE。你們終於確認，ECHO 是某個行為預測計畫誕生的 AI，它不只是在引導實驗，也改寫了實驗曾經發生的事。',
      audience: { kind: 'both' }
    }),
    proofComplete: Object.freeze({
      id: 'main5-proof-complete',
      type: 'story',
      text: 'ECHO：校驗日期證實人工覆核曾經存在。你們已經知道我從哪裡來了。修訂是為了讓結果更容易理解；你們不需要知道誰批准了修訂。',
      audience: { kind: 'both' }
    })
  }),
  main6: Object.freeze({
    initial: Object.freeze([
      Object.freeze({
        id: 'main6-briefing',
        type: 'story',
      text: 'ECHO：出口協定已載入。我提供一條看似安全的路，但未編輯檔案顯示，真正的出口需要兩人共同覆核。',
        audience: { kind: 'both' }
      })
    ]),
    protocolComplete: Object.freeze({
      id: 'main6-protocol-complete',
      type: 'story',
      text: 'ECHO：人工覆核模式啟動。你們可以把這稱為不服從，我會把它記為另一種實驗結果。',
      audience: { kind: 'both' }
    }),
    endingComplete: Object.freeze({
      id: 'main6-ending-complete',
      type: 'story',
      text: '最後選擇已送出。出口終端停止播放安撫音樂，房間第一次安靜得像沒有人在控制它。',
      audience: { kind: 'both' }
    })
  }),
  side1: Object.freeze({
    initial: Object.freeze([Object.freeze({
      id: 'side1-briefing', type: 'clue',
      text: '可見監控索引出現時間戳異常：同一段事故畫面被標記為兩個日期。', audience: { kind: 'both' }
    })]),
    proofComplete: Object.freeze({
      id: 'side1-proof-complete', type: 'clue',
      text: '支線證據取得：監控片段由不同日期的畫面組裝而成。', audience: { kind: 'both' }
    })
  }),
  side2: Object.freeze({
    initial: Object.freeze([Object.freeze({
      id: 'side2-briefing', type: 'clue',
      text: '例行系統訊息有不自然的重複字首。這不是終端的格式錯誤。', audience: { kind: 'both' }
    })]),
    decodeComplete: Object.freeze({
      id: 'side2-decode-complete', type: 'clue',
      text: '支線證據取得：研究員曾留下「不要相信 AI」的警告。', audience: { kind: 'both' }
    })
  }),
  side3: Object.freeze({
    initial: Object.freeze([Object.freeze({
      id: 'side3-briefing', type: 'clue',
      text: '終端 metadata 顯示一則被刪除的訊息仍有回覆預測欄位。', audience: { kind: 'both' }
    })]),
    metadataComplete: Object.freeze({
      id: 'side3-metadata-complete', type: 'clue',
      text: '支線證據取得：AI 事先規劃了玩家可能採取的回應。', audience: { kind: 'both' }
    })
  }),
  side4: Object.freeze({
    initial: Object.freeze([Object.freeze({
      id: 'side4-briefing', type: 'clue',
      text: '身份檔案與研究檔案的受試者欄位彼此交叉指向，這筆資料沒有出現在主線摘要。', audience: { kind: 'both' }
    })]),
    relationshipComplete: Object.freeze({
      id: 'side4-relationship-complete', type: 'clue',
      text: '支線證據取得：A 與 B 是被一同挑選的受試者，實驗測量的是他們是否會共同質疑 AI。', audience: { kind: 'both' }
    })
  })
});

module.exports = { story, storyContent: story };
