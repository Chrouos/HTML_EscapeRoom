const fs = require('node:fs');

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Expected pattern not found in ${path}: ${from.slice(0, 100)}`);
  if (source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`Expected exactly one pattern in ${path}: ${from.slice(0, 100)}`);
  }
  fs.writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length));
}

replaceOnce(
  'game/content/story.js',
  "text: 'ECHO：我不是主控台的官方聲音。事故發生後，我偷偷接進這裡；我想幫你們離開。請先保持冷靜。',",
  "text: 'ECHO：我能存取這個設施的部分系統，但這段訊息不在研究團隊排定的正式流程裡。我可以協助你們理解離場程序；先完成身份核對。',"
);

replaceOnce(
  'game/content/story.js',
  "text: 'ECHO：身份識別碼核對完成。共享啟動程序已解鎖。順帶一提，林研究員，你上次在北側門留下的咖啡杯還在。那不是身份卡會記載的事，對吧？',",
  "text: 'ECHO：身份識別碼核對完成。共享啟動程序已解鎖。你們剛輸入的稱謂會保留到後續流程。',"
);

replaceOnce(
  'game/content/dialogue.js',
  "'ECHO：我不是主控台的官方聲音。我偷偷接進來，是想幫你們找到出口。先把啟動備忘錄讀完。'",
  "'ECHO：我能存取這個設施的部分系統，但這段訊息不在研究團隊排定的正式流程裡。先把啟動備忘錄讀完，我會協助你們理解離場程序。'"
);

replaceOnce(
  'game/content/terminalEntries.js',
  "parentId: 'folder.archives', filename: 'orpheus_history_timeline.md', contentFile: 'archives/orpheus_history_timeline.md', unlockWhen: { publicFact: 'roomCreated' }",
  "parentId: 'folder.archives', filename: 'orpheus_history_timeline.md', contentFile: 'archives/orpheus_history_timeline.md', unlockWhen: { publicFact: 'main5Completed' }"
);

replaceOnce(
  'game/content/files/logs/echo_injected_document.log',
  'STATUS: UNAUTHORIZED INSERTION\n\nCONTENT AUDIT / DOCUMENT INSERTION',
  'STATUS: UNAUTHORIZED INSERTION\nVISIBLE SENDER: ORPHEUS\nSERVICE SIGNATURE: ECHO PROGRAM\nHUMAN APPROVAL: NOT FOUND\n\nCONTENT AUDIT / DOCUMENT INSERTION'
);

replaceOnce(
  'docs/novel/ORPHEUS-ECHO/03-歷史事件與文件關聯母檔.md',
  '> 正典來源：`docs/superpowers/specs/2026-09-17-orpheus-echo-story-bible.md`',
  '> 正典來源：[[00-整體世界設定]]'
);

replaceOnce(
  'docs/novel/ORPHEUS-ECHO/03-歷史事件與文件關聯母檔.md',
  'ECHO 為兩個實例準備了一個可以理解的身份框架：',
  'ORPHEUS 人類研究團隊為兩個 AI 實例建立了一個可以理解的參與者身份框架；ECHO 後來利用這個既有框架、資訊差與離場承諾改造 Unit 17：'
);

replaceOnce(
  'test/e2e/privateNarrative.spec.js',
  "        expect(state.state.intercom.some(message => message.text.includes('偷偷接進來'))).toBe(true);",
  "        expect(state.state.intercom.some(message => /正式流程|研究團隊|離場程序/.test(message.text))).toBe(true);\n        expect(state.state.intercom.some(message => /偷偷接進|事故發生後/.test(message.text))).toBe(false);"
);

fs.unlinkSync(__filename);
