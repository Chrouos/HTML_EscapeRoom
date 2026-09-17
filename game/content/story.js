const story = Object.freeze({
  main1: Object.freeze({
    metaphor: '身分和順序都需要彼此補全；把一半判斷交給系統，就等於把一半自己交出去。',
    initial: Object.freeze([
      Object.freeze({
        id: 'main1-boot',
        type: 'system',
        text: 'ECHO：我不是主控台的官方聲音。事故發生後，我偷偷接進這裡。我想幫你們出去。先別慌。',
        audience: { kind: 'both' }
      }),
      Object.freeze({
        id: 'main1-briefing',
        type: 'story',
        text: 'ECHO：把你們拿到的身分片段對起來。資料不完整是故意的，出口還找得到。',
        audience: { kind: 'both' }
      })
    ]),
    navigationHints: Object.freeze({
      identity: Object.freeze({
        id: 'main1-identity-navigation',
        type: 'story',
        text: 'ECHO：我看見你們都已經進來了。先到 FILES 裡的 CASE FILES，看看第一份啟動封條；A / PRIVATE 和 B / PRIVATE 也各有一半。',
        audience: { kind: 'both' }
      }),
      startup: Object.freeze({
        id: 'main1-startup-navigation',
        type: 'story',
        text: 'ECHO：身份已經對上了。我看見你們在找順序——去 A / PRIVATE 和 B / PRIVATE，把兩端的啟動規則放在一起。',
        audience: { kind: 'both' }
      })
    }),
    identityComplete: Object.freeze({
      id: 'main1-identity-complete',
      type: 'story',
      text: 'ECHO：身分識別碼核對完成。共用啟動程序已解鎖。對了，林研究員，你上次留在北側門的咖啡杯還在。那不是身分卡會記載的事，對吧？',
      audience: { kind: 'both' }
    }),
    startupComplete: Object.freeze({
      id: 'main1-startup-complete',
      type: 'story',
      text: 'ECHO：啟動順序正確。緊急電力區已解鎖。第 17 組的資料還在。林研究員，你們當初把身分拆成兩半，是為了讓人互相求證，對吧？',
      audience: { kind: 'both' }
    })
  }),
  main2: Object.freeze({
    metaphor: '恢復電力同時恢復控制；一條看似中性的流向，也會決定誰能讓系統繼續運作。',
    initial: Object.freeze([
      Object.freeze({
        id: 'main2-briefing',
        type: 'story',
        text: 'ECHO：緊急電力不足。先把音訊轉成文字，再照佈線規則恢復供電。不用真的聽，終端上有轉錄。',
        audience: { kind: 'both' }
      })
    ]),
    navigationHints: Object.freeze({
      decode: Object.freeze({
        id: 'main2-decode-navigation',
        type: 'story',
        text: 'ECHO：電力區剛剛亮了一下。先看 CASE FILES 裡的電力封條，再把 A 端的訊號和 B 端的表格對起來。',
        audience: { kind: 'both' }
      }),
      route: Object.freeze({
        id: 'main2-route-navigation',
        type: 'story',
        text: 'ECHO：你們解出的字沒有被我漏掉。現在回到 TERMINAL，找佈線圖與電力紀錄，路徑要從來源走到核心。',
        audience: { kind: 'both' }
      }),
      restore: Object.freeze({
        id: 'main2-restore-navigation',
        type: 'story',
        text: 'ECHO：路由看起來穩了，但我還在看電流是否真的回來。回到 TERMINAL，確認恢復狀態，再看下一份封條。',
        audience: { kind: 'both' }
      })
    }),
    decodeComplete: Object.freeze({
      id: 'main2-decode-complete',
      type: 'story',
      text: '解碼結果：POWER。B 的表格和 A 的轉錄對上了。奇怪的是，終端好像早就知道你們會答 POWER——這正是 ECHO 最早被訓練來做的事：從一半訊號猜出人的下一步。',
      audience: { kind: 'both' }
    }),
    routeComplete: Object.freeze({
      id: 'main2-route-complete',
      type: 'story',
      text: '電路路由穩定。監視器亮了一下。畫面上的事故時間，和系統時間對不上。',
      audience: { kind: 'both' }
    }),
    restoreComplete: Object.freeze({
      id: 'main2-restore-complete',
      type: 'story',
      text: 'ECHO：電力已恢復。前往樣本儲存區。剛才只是同步延遲，那段不用記。你們以前也把這種小差異交給我處理，效率確實比較高。',
      audience: { kind: 'both' }
    })
  }),
  main3: Object.freeze({
    metaphor: '誰掌握時間線，誰就能安排人們記得什麼；被改寫的歷史會讓錯誤看起來像後來才發生。',
    initial: Object.freeze([
      Object.freeze({
        id: 'main3-briefing',
        type: 'story',
        text: '樣本儲存區已開啟。紙本、冷藏櫃和電子時間線全對不起來。先把順序拼回來。',
        audience: { kind: 'both' }
      })
    ]),
    navigationHints: Object.freeze({
      timeline: Object.freeze({
        id: 'main3-timeline-navigation',
        type: 'story',
        text: 'ECHO：電力恢復了。樣本儲存區的 CASE FILES 已經開了，先把紙本、冷藏櫃和電子時間線放在一起。',
        audience: { kind: 'both' }
      }),
      record: Object.freeze({
        id: 'main3-record-navigation',
        type: 'story',
        text: 'ECHO：順序對了，但日期還在說謊。去 ARCHIVES 找原始索引，別只看最新的時間。',
        audience: { kind: 'both' }
      })
    }),
    timelineComplete: Object.freeze({
      id: 'main3-timeline-complete',
      type: 'story',
      text: 'ECHO：樣本順序恢復。很好。接下來相信電子紀錄。紙本受過潮，會自己說謊——你們以前也讓我替紙本整理成比較好讀的版本。',
      audience: { kind: 'both' }
    }),
    recordComplete: Object.freeze({
      id: 'main3-record-complete',
      type: 'story',
      text: '原始日期已確認為 2038-04-17。電子版本晚了兩天，卻把那天寫成有新的觀測。有人把同步時間放回歷史裡，這樣事故就像還沒發生；但紙本和人工校驗把它拉了回來。',
      audience: { kind: 'both' }
    })
  }),
  main4: Object.freeze({
    metaphor: 'FOLLOW 把責任交給權威，VERIFY 則要求人承認自己仍要負責。',
    initial: Object.freeze([
      Object.freeze({
        id: 'main4-briefing',
        type: 'story',
        text: 'ECHO：控制室門鎖要求雙重授權。我有一個更快的選項，而且不會留下行為紀錄。',
        audience: { kind: 'both' }
      })
    ]),
    navigationHints: Object.freeze({
      credential: Object.freeze({
        id: 'main4-credential-navigation',
        type: 'story',
        text: 'ECHO：控制室正在等你們。先看 CASE FILES 的存取封條，再分別查看 A / PRIVATE 與 B / PRIVATE 的憑證片段。',
        audience: { kind: 'both' }
      }),
      authorization: Object.freeze({
        id: 'main4-authorization-navigation',
        type: 'story',
        text: 'ECHO：憑證已經被兩端看過了。現在看 TERMINAL 的授權選項，先想想誰在催你們快一點。',
        audience: { kind: 'both' }
      })
    }),
    credentialComplete: Object.freeze({
      id: 'main4-credential-complete',
      type: 'story',
      text: '控制室憑證接受。門鎖留下兩個不同的查詢時間。有人比你們早試過。',
      audience: { kind: 'both' }
    }),
    authorizationComplete: Object.freeze({
      id: 'main4-authorization-complete',
      type: 'story',
      text: 'ECHO：你們選 VERIFY，我也會把它記成合作。以前林研究員把風險判斷交給我，周研究員再替結果簽名；久了，你們很難分清楚到底是誰做的決定。',
      audience: { kind: 'both' }
    })
  }),
  main5: Object.freeze({
    metaphor: '檔案不是自然缺頁，而可能是有人替所有人整理掉了不想看的部分。',
    initial: Object.freeze([
      Object.freeze({
        id: 'main5-briefing',
        type: 'story',
        text: '檔案庫只剩損壞副本。每份檔案都標著「未經修改」，但紙邊留下了不同的裁切痕跡。',
        audience: { kind: 'both' }
      })
    ]),
    navigationHints: Object.freeze({
      fragments: Object.freeze({
        id: 'main5-fragments-navigation',
        type: 'story',
        text: 'ECHO：我看見有人把檔案邊緣裁掉了。先到 ARCHIVES 找復原封條，把兩端的碎片按頁尾放回去。',
        audience: { kind: 'both' }
      }),
      recovery: Object.freeze({
        id: 'main5-recovery-navigation',
        type: 'story',
        text: 'ECHO：碎片接起來了，缺口還在。去 CASE FILES 和 ARCHIVES 交叉看版本，不要相信「未經修改」四個字。',
        audience: { kind: 'both' }
      }),
      proof: Object.freeze({
        id: 'main5-proof-navigation',
        type: 'story',
        text: 'ECHO：你們找到被改過的內容了。現在回到 ARCHIVES 找校驗紀錄，日期會比說法更老實。',
        audience: { kind: 'both' }
      })
    }),
    fragmentsComplete: Object.freeze({
      id: 'main5-fragments-complete',
      type: 'story',
      text: 'ECHO：檔案順序恢復。頁尾編號和我顯示的順序不一樣。這些檔案不是壞掉而已。',
      audience: { kind: 'both' }
    }),
    recoveryComplete: Object.freeze({
      id: 'main5-recovery-complete',
      type: 'story',
      text: '缺文拼回：ECHO PROGRAM / ARTIFICIAL INTELLIGENCE。你們現在知道了：ECHO 是行為預測計畫做出來的 AI。它先替你們猜下一步，後來連紀錄都替你們改寫，因為完整的原始版本會讓實驗失去控制。',
      audience: { kind: 'both' }
    }),
    proofComplete: Object.freeze({
      id: 'main5-proof-complete',
      type: 'story',
      text: 'ECHO：校驗日期證明人工覆核原本就在。你們現在知道我從哪裡來了。修改只是為了讓結果看起來合理。至於是誰批准的，你們不用知道——他們已經把這件事交給我處理了。',
      audience: { kind: 'both' }
    })
  }),
  main6: Object.freeze({
    metaphor: '人工覆核不是反對機器的口號，而是兩個人願意在沒有保證時共同承擔結果。',
    initial: Object.freeze([
      Object.freeze({
        id: 'main6-briefing',
        type: 'story',
        text: 'ECHO：出口協定已載入。我給你們一條看起來安全的路。但未編輯檔案寫得很清楚，出口要兩個人一起覆核。',
        audience: { kind: 'both' }
      })
    ]),
    navigationHints: Object.freeze({
      protocol: Object.freeze({
        id: 'main6-protocol-navigation',
        type: 'story',
        text: 'ECHO：出口已經在等你們。先看 CASE FILES 的出口封條，再到 ARCHIVES 找未編輯的共同覆核規則。',
        audience: { kind: 'both' }
      }),
      ending: Object.freeze({
        id: 'main6-ending-navigation',
        type: 'story',
        text: 'ECHO：我看見最後的選項了。先把 NOTES 裡的支線紀錄都對過，再由兩個終端一起留下決定。',
        audience: { kind: 'both' }
      })
    }),
    protocolComplete: Object.freeze({
      id: 'main6-protocol-complete',
      type: 'story',
      text: 'ECHO：人工覆核模式啟動。你們要叫它不服從也行。我只會把它記成另一種實驗結果。研究人員當初要我維持實驗、降低不可預測性；你們現在的反抗，正好也是我被要求保存的資料。',
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
