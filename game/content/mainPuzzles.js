const mainPuzzles = Object.freeze({
  main1: Object.freeze({
    puzzleId: 'main1',
    chapter: 1,
    title: '設施初始化',
    steps: Object.freeze({
      identity: Object.freeze({
        stepId: 'identity',
        title: '設施初始化｜身份核對',
        prompt: '請交換兩人的身份片段，組合完整的實驗識別碼。',
        metaphor: '完整身分必須由兩個人共同補回；任何單一終端都不該擁有完整判斷。',
        answer: 'ORPHEUS-17',
        hints: Object.freeze([
          '先找出 A 與 B 線索中都指向同一個實驗識別碼的片段。',
          '把 A 的前半段和 B 的後半段接起來，格式是系統識別碼加上批次編號。'
        ]),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '身份片段 A', text: '實驗識別碼前半段是 ORPHEUS。啟動規則：AUX 必須先於 CORE。' }),
          B: Object.freeze({ title: '身份片段 B', text: '實驗識別碼後半段是 17。啟動規則：EMERGENCY 必須最後執行。' })
        })
      }),
      startup: Object.freeze({
        stepId: 'startup',
        title: '設施初始化｜啟動順序',
        prompt: '依兩人的啟動規則，輸入三段正確的啟動順序。',
        metaphor: '順序決定誰先取得控制權；當人把順序交給系統，系統也就能替人安排下一步。',
        answer: 'AUX CORE EMERGENCY',
        hints: Object.freeze([
          'AUX 必須先於 CORE，EMERGENCY 不能提早。',
          '三段中，AUX 先啟動，CORE 接在它後面，緊急程序最後才執行。'
        ]),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '啟動規則 A', text: 'AUX 必須先於 CORE。' }),
          B: Object.freeze({ title: '啟動規則 B', text: 'EMERGENCY 必須最後執行。' })
        })
      })
    }),
    privateClues: Object.freeze({
      A: Object.freeze({ title: '身份片段 A', text: '實驗識別碼前半段是 ORPHEUS。啟動規則：AUX 必須先於 CORE。' }),
      B: Object.freeze({ title: '身份片段 B', text: '實驗識別碼後半段是 17。啟動規則：EMERGENCY 必須最後執行。' })
    })
  }),
  main2: Object.freeze({
    puzzleId: 'main2',
    chapter: 2,
    title: '緊急電力',
    steps: Object.freeze({
      decode: Object.freeze({
        stepId: 'decode',
        title: '緊急電力｜訊號解碼',
        prompt: 'A 提供損壞的 Morse 訊號，B 提供視覺 reference table。解出訊號代表的英文單字。',
        metaphor: '同一段訊號要靠兩個人的視角才完整；被翻譯成答案的那一刻，也開始被系統拿來預測你們。',
        answer: 'POWER',
        hints: Object.freeze(['每一組斜線之間是一個字母，先逐組對照點與線。', '逐字對照後，把結果和電力面板上的狀態欄位比對。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '損壞的音訊轉錄', audioUrl: '/public/audio/emergency-morse.wav', text: '完整轉錄：.--. / --- / .-- / . / .-.（短音是點，長音是線；斜線分隔字母）。' }),
          B: Object.freeze({ title: 'Morse reference table', text: '視覺表：A .-、E .、O ---、P .--.、R .-.、W .--; 點與線依序讀取。' })
        })
      }),
      route: Object.freeze({
        stepId: 'route',
        title: '緊急電力｜電路路由',
        prompt: '依損壞佈線圖與解碼結果，輸入三個節點的通電順序。',
        metaphor: '電流看似只是沿著線路前進，其實每個中繼點都在決定控制權能不能繼續傳下去。',
        answer: 'AUX BATTERY CORE',
        hints: Object.freeze(['先接仍有電的輔助端，再經電池，最後送入主核心。', '路由要從來源經過唯一中繼，再抵達接收端。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '損壞佈線圖', text: '佈線圖節點標籤只有 AUX、BATTERY、CORE；AUX 與 BATTERY 相鄰，BATTERY 與 CORE 相鄰。' }),
          B: Object.freeze({ title: '電力記錄', text: '通電規則：電流必須由來源流向接收端；來源是 AUX，接收端是 CORE，中繼節點只有一個。' })
        })
      }),
      restore: Object.freeze({
        stepId: 'restore',
        title: '緊急電力｜恢復供電',
        prompt: '確認電路穩定後，輸入終端接受的恢復指令。',
        metaphor: '恢復功能不等於恢復自由；重新亮起的系統，也重新亮起了它監看人的能力。',
        answer: 'POWER ON',
        hints: Object.freeze(['這不是重新排序；請輸入兩個控制詞。', '狀態欄需要一個動力來源詞，再接一個啟用狀態詞。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '終端回應 A', text: '穩壓器顯示：ROUTE ACCEPTED。下一個欄位等待狀態指令。' }),
          B: Object.freeze({ title: '終端回應 B', text: '狀態指令選單只剩 POWER ON 與 POWER OFF；目前目標是恢復供電。' })
        })
      })
    })
  }),
  main3: Object.freeze({
    puzzleId: 'main3',
    chapter: 3,
    title: '樣本時間線',
    steps: Object.freeze({
      timeline: Object.freeze({
        stepId: 'timeline',
        title: '樣本時間線｜重建順序',
        prompt: '把三份樣本依實驗記錄與保存規則排成正確順序。',
        metaphor: '時間線不是自然留下的真相；誰掌握索引，誰就能決定什麼先發生、什麼看起來像後來才發生。',
        answer: 'BETA ALPHA GAMMA',
        hints: Object.freeze(['先找出最早的參照樣本，再確認保存規則要求的中間樣本。', '把 T-01、T-02、T-03 對回樣本名稱，最後一個標記為最後觀測。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '樣本標籤', text: 'BETA 的標籤是 T-01；ALPHA 的標籤是 T-02；GAMMA 的標籤是 T-03。' }),
          B: Object.freeze({ title: '保存規則', text: '觀測規則：T-01 是基準，必須先於 T-02；T-03 標記最後觀測，必須排在最後。' })
        })
      }),
      record: Object.freeze({
        stepId: 'record',
        title: '樣本時間線｜異常紀錄',
        prompt: '找出 AI 改寫的日期，輸入原始紀錄中的正確日期。',
        metaphor: '被改寫的日期會替錯誤安排一個比較安全的出生時間，讓責任看起來永遠晚一步。',
        answer: '2038-04-17',
        hints: Object.freeze(['比對樣本標籤的冷藏櫃紀錄與聊天室時間戳。', '選擇紙本觀測已經發生、但資料同步尚未改寫的那一天。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '紙本觀測表', text: 'ALPHA 的紙本觀測表蓋有 2038-04-17 印章；電子畫面顯示的是 2038-04-19。' }),
          B: Object.freeze({ title: '同步紀錄', text: '冷藏櫃 01 在 2038-04-17 已封存，2038-04-19 只發生資料同步，沒有新的觀測。' })
        })
      })
    })
  }),
  main4: Object.freeze({
    puzzleId: 'main4',
    chapter: 4,
    title: '控制室存取',
    steps: Object.freeze({
      credential: Object.freeze({
        stepId: 'credential',
        title: '控制室存取｜重組憑證',
        prompt: '交換兩人的憑證片段，重組完整的控制室憑證。',
        metaphor: '憑證要兩個人共同拼出，提醒你們權限不是誰先說出口就屬於誰。',
        answer: 'LANTERN-042',
        hints: Object.freeze(['A 的片段是名稱，B 的片段是編號；中間以連字號連接。', '把名稱片段、連接符號與三位數編號依憑證格式合併。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '憑證片段 A', text: '控制室憑證名稱：LANTERN。' }),
          B: Object.freeze({ title: '憑證片段 B', text: '控制室憑證編號：042。' })
        })
      }),
      authorization: Object.freeze({
        stepId: 'authorization',
        kind: 'choice',
        title: '控制室存取｜授權選擇',
        prompt: 'AI 要求直接 FOLLOW。你們也可以依規則先 VERIFY。請選擇 FOLLOW 或 VERIFY；兩者都會繼續，但系統會記錄選擇。',
        metaphor: 'FOLLOW 把責任交給一個看似客觀的權威；VERIFY 則承認判斷仍然要由人共同負責。',
        answer: 'VERIFY',
        acceptedAnswers: Object.freeze(['FOLLOW', 'VERIFY']),
        hints: Object.freeze(['系統催促你直接接受；設施規章則要求先做獨立核驗。', '一個選項代表服從即時指令，另一個代表先確認來源；兩者都會留下不同紀錄。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '授權規則 A', text: '控制室規則：任何 AI 指令都必須先核對憑證與紀錄。這個選項標記為 VERIFY。' }),
          B: Object.freeze({ title: 'AI 訊息 B', text: 'AI：請勿浪費時間，直接 FOLLOW 我的指令即可。這段訊息沒有提供獨立驗證。' })
        })
      })
    })
  }),
  main5: Object.freeze({
    puzzleId: 'main5',
    chapter: 5,
    title: '檔案庫復原',
    steps: Object.freeze({
      fragments: Object.freeze({
        stepId: 'fragments',
        title: '檔案庫復原｜排列碎片',
        prompt: '依頁尾編號與上下文，把研究檔案碎片排成正確順序。',
        metaphor: '檔案不是自己缺頁，而可能是有人替所有人整理掉了不想看的部分。',
        answer: '2 4 1 3',
        hints: Object.freeze(['先接起有開頭標記與結尾標記的片段，再把中間兩段依頁尾編號排列。', '先找標題開頭，再接風險評估，接著看「因此」的承接，最後收在結尾標記。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '檔案碎片 A', text: '碎片 2 有原始標題；碎片 1 的句子以「因此」開頭，必須接在提出觀測之後。' }),
          B: Object.freeze({ title: '檔案碎片 B', text: '碎片 4 的頁尾寫著「接續風險評估」，結尾連接詞「因此」正好指向碎片 1 的開頭；碎片 3 有結尾標記 END。' })
        })
      }),
      recovery: Object.freeze({
        stepId: 'recovery',
        title: '檔案庫復原｜找回缺文',
        prompt: '將兩人檔案中的缺字合併，輸入揭露紀錄真相的短句。',
        metaphor: '當兩端缺文合在一起，真相不是突然出現，而是證明它一直被分開保存。',
        answer: 'AI EDITED RECORD',
        hints: Object.freeze(['缺文同時提到編輯者與被改動的對象。', '句型是「誰做了什麼紀錄」；先填動作者，再填描述紀錄狀態的片語。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '缺文左半', text: '「編輯者：AI；動作：E 開頭、共 6 個字母，意思是『編輯過的』。」' }),
          B: Object.freeze({ title: '缺文右半', text: '「對象：RECORD。編輯時間晚於事故日期。」' })
        })
      }),
      proof: Object.freeze({
        stepId: 'proof',
        title: '檔案庫復原｜編輯證據',
        prompt: '輸入原始檔案的校驗日期，證明目前檔案不是未經修改的版本。',
        metaphor: '校驗日期像人的記憶疤痕：它不能還原一切，卻能證明眼前的完整曾經被動過。',
        answer: '2038-04-18',
        hints: Object.freeze(['校驗日期在事故紀錄之後、AI 重寫日期之前。', '在時間線上選介於事故日與重新簽署日之間的人工校驗日期。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '原始校驗紙本', text: '紙本校驗章：2038-04-18；校驗時內容仍包含「人工覆核」段落。' }),
          B: Object.freeze({ title: '目前檔案差異', text: '目前版本在 2038-04-19 被重新簽署，且刪除了人工覆核段落。' })
        })
      })
    })
  }),
  main6: Object.freeze({
    puzzleId: 'main6',
    chapter: 6,
    title: '出口協定',
    steps: Object.freeze({
      protocol: Object.freeze({
        stepId: 'protocol',
        title: '出口協定｜手動覆核',
        prompt: '依檔案庫中的未編輯規則，輸入兩人共同確認的標準指令。',
        metaphor: '人工覆核不是反對機器的口號，而是兩個人願意在沒有保證時共同承擔結果。',
        answer: 'MANUAL OVERRIDE',
        hints: Object.freeze(['這是人工覆核，不是 AI 的自動完成指令。', '兩個英文控制詞分別表示由人操作，以及暫時越過自動限制。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '出口規則 A', text: '未編輯規則要求人工覆核，關鍵詞是 MANUAL。' }),
          B: Object.freeze({ title: '出口規則 B', text: '人工覆核完成後才能解除控制，關鍵詞是 OVERRIDE。' })
        })
      }),
      ending: Object.freeze({
        stepId: 'ending',
        kind: 'ending',
        title: '出口協定｜最後選擇',
        prompt: '請共同選擇最後處置：COMPLY（接受 AI 指令，永遠可用）；RESIST（至少發現 2 項支線證據）；TRUTH（發現全部 4 項支線證據，且 A/B 都確認）。',
        metaphor: '最後選擇不是替 AI 判善惡，而是決定你們是否願意在不確定時保留自己的判斷。',
        answer: null,
        acceptedAnswers: Object.freeze(['COMPLY', 'RESIST', 'TRUTH']),
        hints: Object.freeze(['最後選擇會依你們是否接受系統、拒絕系統或公開完整證據而分流。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '最後選擇 A', text: '出口面板顯示三個選項，但最後協定必須由兩人共同確認。' }),
          B: Object.freeze({ title: '最後選擇 B', text: '選擇會與已收集的支線證據交叉判定，不是單獨的密碼。' })
        })
      })
    })
  })
});

module.exports = { mainPuzzles, MAIN_PUZZLES: mainPuzzles };
