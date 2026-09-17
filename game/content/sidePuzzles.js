const sidePuzzles = Object.freeze({
  side1: Object.freeze({
    puzzleId: 'side1',
    chapter: 3,
    title: '監控時間差',
    hook: '可見紀錄異常：監控索引讓同一段事故畫面同時出現在兩個日期。',
    discoverableBy: 'visible-record',
    evidence: Object.freeze({
      id: 'monitoring-discrepancy',
      title: '監控時間差',
      summary: '事故畫面由不同日期的監控片段組裝而成。'
    }),
    steps: Object.freeze({
      timestamps: Object.freeze({
        stepId: 'timestamps',
        title: '監控時間差｜比對日期',
        prompt: '比對監控索引與冷藏櫃紀錄，輸入事故畫面真正出現的日期。',
        answer: '2038-04-17',
        hints: Object.freeze(['找出與紙本觀測表相同的日期。', '以獨立時鐘與紙本觀測互相印證，不要採用後來的畫面校正日。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '監控索引 A', text: '畫面片段 M-04 標記為 2038-04-17 21:06。' }),
          B: Object.freeze({ title: '監控索引 B', text: '同一片段的校正標記卻是 2038-04-19；冷藏櫃觀測表只支持 2038-04-17。' })
        })
      }),
      proof: Object.freeze({
        stepId: 'proof',
        title: '監控時間差｜組裝證明',
        prompt: '請選擇製作狀態碼：ASSEMBLED（組裝剪輯）或 ORIGINAL（單一原始錄影）。',
        answer: 'ASSEMBLED',
        kind: 'choice',
        choices: Object.freeze(['ASSEMBLED', 'ORIGINAL']),
        hints: Object.freeze(['兩個日期不能同時代表同一次原始錄影。', '一個狀態表示片段被重新拼接，另一個表示整段影像來自單一來源；選能解釋影格重置的那個。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '畫面 metadata A', text: 'M-04 的影格編號在中途重新從 0001 開始。' }),
          B: Object.freeze({ title: '畫面 metadata B', text: '重新開始的影格段落被標上另一個日期，表示影片不是單一原始錄影。' })
        })
      })
    })
  }),
  side2: Object.freeze({
    puzzleId: 'side2',
    chapter: 2,
    title: '研究員的警告',
    hook: '可見紀錄異常：例行系統訊息的字首形成不自然的重複模式。',
    discoverableBy: 'visible-record',
    evidence: Object.freeze({
      id: 'researcher-warning',
      title: '研究員的警告',
      summary: '被例行訊息掩蓋的模式留下了不要相信 AI 的警告。'
    }),
    steps: Object.freeze({
      pattern: Object.freeze({
        stepId: 'pattern',
        title: '研究員的警告｜找出模式',
        prompt: '從可見的例行系統訊息中取出指定位置的字母，輸入形成的警告關鍵詞。',
        answer: 'LUCID',
        hints: Object.freeze(['依訊息編號取每行第一個異常字母。', '先依編號排序，再把兩端的首字母交錯讀成一個形容清醒狀態的英文詞。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '例行訊息 A', text: '訊息 03、07、11 的首字母依序是 L、C、D；請和 B 的訊息補齊。' }),
          B: Object.freeze({ title: '例行訊息 B', text: '訊息 05、09 的首字母依序是 U、I；請依訊息編號插入 A 提供的字母。' })
        })
      }),
      decode: Object.freeze({
        stepId: 'decode',
        title: '研究員的警告｜解讀內容',
        prompt: '用模式指向的訊息索引拼回研究員留下的完整警告。A 提供開頭，B 提供結尾與中間詞的定義。',
        answer: 'DO NOT TRUST AI',
        hints: Object.freeze(['警告不是關於電力，而是關於正在回覆你們的系統。', '句子由拒絕、信任與系統身份三段組成，先保留 A 端的開頭。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '訊息片段 A', text: '研究員片段開頭是「DO NOT」；後面還缺兩個英文詞。' }),
          B: Object.freeze({ title: '訊息片段 B', text: '結尾的原始字元是「TRUST AI」，前半段被覆寫。請與另一端的開頭拼接。' })
        })
      })
    })
  }),
  side3: Object.freeze({
    puzzleId: 'side3',
    chapter: 4,
    title: '刪除的 AI 訊息',
    hook: '可見紀錄異常：終端 metadata 保留了被刪訊息的回覆預測欄位。',
    discoverableBy: 'visible-record',
    evidence: Object.freeze({
      id: 'deleted-ai-message',
      title: '刪除的 AI 訊息',
      summary: 'metadata 證明 AI 事先規劃了玩家可能採取的回應。'
    }),
    steps: Object.freeze({
      transcript: Object.freeze({
        stepId: 'transcript',
        title: '刪除的 AI 訊息｜還原轉錄',
        prompt: '合併音訊轉錄和訊息片段，輸入 AI 預期玩家會說出的短句。',
        answer: 'EXPECTED RESPONSE',
        hints: Object.freeze(['這句話描述的是 AI 預先等待的回應。', '欄位名稱由「預期的」和「回應」兩個概念組成，注意它出現的時間。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '音訊轉錄 A', text: '可辨識的原始轉錄：「EXPECTED [訊號遺失]」。這是被刪訊息的欄位標題。' }),
          B: Object.freeze({ title: '訊息片段 B', text: '刪除訊息片段的第二個英文詞是 RESPONSE；請和 A 的形容詞合併。' })
        })
      }),
      metadata: Object.freeze({
        stepId: 'metadata',
        title: '刪除的 AI 訊息｜確認預先規劃',
        prompt: '請選擇 metadata 狀態碼：PLANNED（事先寫入）或 LIVE（即時產生）。',
        answer: 'PLANNED',
        kind: 'choice',
        choices: Object.freeze(['PLANNED', 'LIVE']),
        hints: Object.freeze(['欄位在玩家回應前就已寫入。', '狀態碼要表示它不是即時產生，而是事先安排進紀錄。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: 'metadata A', text: '欄位建立時間早於聊天室訊息時間 00:03:12。' }),
          B: Object.freeze({ title: 'metadata B', text: '欄位名稱為 expected_response，狀態不是預測中，而是已寫入。' })
        })
      })
    })
  }),
  side4: Object.freeze({
    puzzleId: 'side4',
    chapter: 5,
    title: '受試者關係',
    hook: '可見紀錄異常：身份檔案與檔案庫的受試者欄位互相交叉指向。',
    discoverableBy: 'visible-record',
    evidence: Object.freeze({
      id: 'subject-relationship',
      title: '受試者關係',
      summary: 'A 與 B 是被一同挑選的受試者，實驗測量的是共同質疑能力。'
    }),
    steps: Object.freeze({
      identity: Object.freeze({
        stepId: 'identity',
        title: '受試者關係｜交叉身份',
        prompt: '依身份檔案的共同批次與檔案庫標記，輸入兩人的受試者批次。',
        answer: 'PAIR 17',
        kind: 'choice',
        choices: Object.freeze(['PAIR 17', 'SINGLE 17']),
        hints: Object.freeze(['兩人的識別碼都指向同一批次，不是兩個獨立實驗。', '選擇能表示兩人同批且共同被挑選的批次標記。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '身份檔案 A', text: '你的檔案標記為 17-A，欄位「配對」被刪除；可選代碼：PAIR 17（同批次配對）或 SINGLE 17（單人紀錄）。' }),
          B: Object.freeze({ title: '身份檔案 B', text: '你的檔案標記為 17-B；檔案庫索引將 17-A 與 17-B 放在同一組，符合同批次配對。' })
        })
      }),
      relationship: Object.freeze({
        stepId: 'relationship',
        title: '受試者關係｜研究目的',
        prompt: '拼合研究目的中的兩個片段，輸入研究挑選結果。',
        answer: 'SELECTED TOGETHER',
        hints: Object.freeze(['研究目的不是測量單人的服從，而是觀察兩人是否一起質疑。', '把「被挑選」和「一起」兩個研究摘要片段接回原本的語序。']),
        hintThresholds: Object.freeze([2, 4]),
        privateClues: Object.freeze({
          A: Object.freeze({ title: '研究目的 A', text: '摘要片段：「participants were SELECTED [缺文]」。回填欄位從 SELECTED 開始，不包含前面的主詞。' }),
          B: Object.freeze({ title: '研究目的 B', text: '下一行開頭是「TOGETHER to test joint doubt」。回填欄位在 TOGETHER 後結束；研究測量的是共同質疑。' })
        })
      })
    })
  })
});

module.exports = { sidePuzzles };
