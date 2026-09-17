# Version 1.4

## 版本定位

以 `COOPERATIVE VALIDATION` 為核心的合作驗證版本。遊戲從單純交換線索，迭代成雙終端、不同權限、可交叉驗證文件與分支結局的敘事密室。

## 這個版本寫了什麼

- 正式規章來源為 `COOPERATIVE VALIDATION / VERSION 1.4`。
- 雙方各自保留所看到的檔案、Logs、時間戳、備份與權限紀錄，再互相核對來源。
- 建立 A／B 角色隔離：私人文件、私人任務、對話與事件不會洩漏給另一端。
- 加入 `FILES`、`CASE FILES`、`ARCHIVES`、`NOTES` 與 A／B 私人資料夾的工作站結構。
- 加入 Terminal 指令、檔案探索、答案鎖定與六段主線謎題。
- 加入 ORPHEUS／ECHO 故事線：玩家會透過文件版本差異與獨立證據判斷哪些內容可信。
- 加入私人任務、合作行為紀錄與多種結局，包括合作離場、單方離場、揭露欺騙與模糊收容等結果。
- 將玩家可見文件移到 `game/content/files`，由內容檔案載入，方便後續版本編輯與驗證。
- 用內容驗證器檢查檔案存在、來源關聯、角色權限、謎題可達性與結局條件。

## 主要來源

- 遊戲規章：[`game/content/files/public/release_condition.md`](../../game/content/files/public/release_condition.md)
- 世界觀正典：[`docs/superpowers/specs/2026-09-17-orpheus-echo-story-bible.md`](../superpowers/specs/2026-09-17-orpheus-echo-story-bible.md)
- 文件草稿：[`docs/superpowers/specs/2026-09-17-orpheus-echo-document-drafts.md`](../superpowers/specs/2026-09-17-orpheus-echo-document-drafts.md)
- 主要實作：`game/content/terminalEntries.js`、`game/terminalEngine.js`、`game/content/validateContent.js`

## 可追溯提交

- `d6b71ea`：完成合作密室故事與 Terminal UI。
- `0871956`：加入權限控管的讀者線索。
- `5d6a1c0`：加入可重新載入的故事內容檔案。

> Git 沒有正式的 `v1.4` tag；本文件依目前 `COOPERATIVE VALIDATION / VERSION 1.4` 規章、Story Bible 與相關提交整理。
