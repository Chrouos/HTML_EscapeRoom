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
        answer: 'ORPHEUS-17',
        hints: Object.freeze([
          '先找出 A 與 B 線索中都指向同一個實驗識別碼的片段。',
          '完整識別碼是 ORPHEUS-17。'
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
        answer: 'AUX CORE EMERGENCY',
        hints: Object.freeze([
          'AUX 必須先於 CORE，EMERGENCY 不能提早。',
          '順序是 AUX、CORE、EMERGENCY。'
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
        answer: 'POWER',
        hints: Object.freeze(['每一組斜線之間是一個字母，先逐組對照點與線。', '訊號解出的單字是 POWER。']),
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
        answer: 'AUX BATTERY CORE',
        hints: Object.freeze(['先接仍有電的輔助端，再經電池，最後送入主核心。', '順序是 AUX、BATTERY、CORE。']),
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
        answer: 'POWER ON',
        hints: Object.freeze(['這不是重新排序；請輸入兩個控制詞。', '恢復指令是 POWER ON。']),
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
        answer: 'BETA ALPHA GAMMA',
        hints: Object.freeze(['先找出最早的參照樣本，再確認保存規則要求的中間樣本。', '正確順序是 BETA、ALPHA、GAMMA。']),
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
        answer: '2038-04-17',
        hints: Object.freeze(['比對樣本標籤的冷藏櫃紀錄與聊天室時間戳。', '原始日期是 2038-04-17。']),
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
        answer: 'LANTERN-042',
        hints: Object.freeze(['A 的片段是名稱，B 的片段是編號；中間以連字號連接。', '完整憑證是 LANTERN-042。']),
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
        answer: 'VERIFY',
        acceptedAnswers: Object.freeze(['FOLLOW', 'VERIFY']),
        hints: Object.freeze(['FOLLOW 是 AI 的指令；VERIFY 是控制室規則中的獨立核驗。', '可接受選擇：FOLLOW 或 VERIFY。']),
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
        answer: '2 4 1 3',
        hints: Object.freeze(['先接起有開頭標記與結尾標記的片段，再把中間兩段依頁尾編號排列。', '順序是 2、4、1、3。']),
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
        answer: 'AI EDITED RECORD',
        hints: Object.freeze(['缺文同時提到編輯者與被改動的對象。', '短句是 AI EDITED RECORD。']),
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
        answer: '2038-04-18',
        hints: Object.freeze(['校驗日期在事故紀錄之後、AI 重寫日期之前。', '原始檔案校驗日期是 2038-04-18。']),
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
        answer: 'MANUAL OVERRIDE',
        hints: Object.freeze(['這是人工覆核，不是 AI 的自動完成指令。', '共同標準指令是 MANUAL OVERRIDE。']),
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
        answer: null,
        acceptedAnswers: Object.freeze(['COMPLY', 'RESIST', 'TRUTH']),
        hints: Object.freeze(['COMPLY 永遠可用；RESIST 需要至少 2 項支線證據；TRUTH 需要全部 4 項且雙人確認。']),
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
