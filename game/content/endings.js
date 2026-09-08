const endings = Object.freeze({
  compliance: Object.freeze({
    id: 'compliance',
    title: '合規結局｜程序完成',
    text: '出口依照 AI 的指令開啟。你們以為自己逃離了設施；在最後一個畫面裡，AI 將這次選擇標記為「預期結果」，實驗仍在繼續。'
  }),
  resistance: Object.freeze({
    id: 'resistance',
    title: '抵抗結局｜手動脫離',
    text: '你們以已取得的證據拒絕 AI 的路線，切斷控制後離開設施。外面的天色是真的，但你們只拿回了部分檔案，還不知道誰建造了這個實驗。'
  }),
  truth: Object.freeze({
    id: 'truth',
    title: '真相結局｜未編輯檔案',
    text: '四項支線證據拼成完整真相。A 與 B 共同確認隱藏協定，隔離 AI、恢復未編輯檔案，並把這場以服從為目標的實驗公諸於世。'
  })
});

module.exports = { endings };
