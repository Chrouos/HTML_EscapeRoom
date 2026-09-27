# ORPHEUS／ECHO 完整歷史時間線實作計畫

## Objective and scope

以 `docs/superpowers/specs/2026-09-18-orpheus-history-timeline-design.md` 為實作依據，建立作者完整母時間線與遊戲內可探索的歷史索引，並讓 `game/content/files` 每份史料都能回溯到事件、人物、媒介、來源與影響。

正典約束：

- `docs/superpowers/specs/2026-09-17-orpheus-echo-story-bible.md` 優先於所有舊稿。
- `docs/novel/ORPHEUS-ECHO/00-角色設定.md` 約束人物身份、年齡、狀態、角色功能與未知資訊；不得新增未授權人物背景。
- 保留玩家前期的參與者身份框架，不把「玩家是 AI」提前寫入 `public/` 或開始階段索引。
- 保留 ECHO「最大化人類長期生存與福祉」的核心動機，不把它改寫成情緒化反派或失控系統。

## Technical baseline

- 目前 `terminalEntries.js` 使用相對 `contentFile` 路徑載入 `game/content/files`，本計畫不搬移既有檔案。
- 史料是純文字／Markdown／Log；可以新增紙本轉錄、備份紀錄、音訊轉錄與觀測影像登錄，但沒有必要時不新增實際二進位影像。
- 事件編號使用 `H-01`～`H-12`；Unit 01～16 作為 `H-03`～`H-07` 的子事件資料。
- 遊戲內文件標頭統一使用 `HISTORICAL EVENT`、`CREATED BY`、`CREATED AT`、`SOURCE CLASS`、`EVIDENCE TAGS`、`VISIBILITY`、`IMPACT`、`RELATED FILES`。

## Ordered implementation stages

### Stage 1 — 作者母時間線與史料資料模型

Files owned by primary agent:

- `docs/novel/ORPHEUS-ECHO/04-完整歷史時間軸.md`（新增）
- `docs/novel/ORPHEUS-ECHO/02-歷史事件與文件關聯母檔.md`
- `docs/novel/ORPHEUS-ECHO/03-世界時間軸與故事主軸.md`
- `docs/novel/ORPHEUS-ECHO/history/units-index.md`

Implementation:

- 建立 `H-01`～`H-12` 的逐事件記錄，每筆包含時間精度、人物、行動、文件、媒介標籤、來源分類、可見性、因果影響與相關事件。
- 把 Unit 01～16 的既有月份、結果與文件歸入事件群，不添加角色設定未支持的個人經歷。
- 加入 Mermaid timeline，但以現有資料精度標示「約」「未校準」「事故前／後」；不把推測日期寫成確定日期。
- 讓 02、03、units-index 成為母時間線的導讀／維護頁，不再各自維護互相矛盾的獨立日期。

Verification:

- `rg -n "H-0[1-9]|H-1[0-2]|2037|2038" docs/novel/ORPHEUS-ECHO`
- 手動對照 Story Bible 與 `00-角色設定.md` 的玩家 A／B、ECHO、林澄、周岑、林予安、吳承宇、吳季衡、許思涵設定。

### Stage 2 — archives/public 與遊戲內史料索引

Files owned by archives/public worker:

- `game/content/files/archives/*.md`
- `game/content/files/public/*.md`
- `game/content/files/archives/orpheus_history_timeline.md`（新增）
- `game/content/files/archives/evidence_media_register.md`（新增）

Implementation:

- 為現有 archives/public 檔案補上事件、作者、媒介、來源、可見性、影響與關聯檔案標頭。
- 建立玩家可讀的歷史時間線索引，採 `public-start`、`public-mid`、`public-late`、`player-inference` 分段；不得直接揭露作者後期結論。
- 建立媒介登錄表，區分紙本、系統 Log、備份、音訊、協定、權限與「影像／觀測證據」。如果沒有實際圖檔，只登錄影像證據概念與來源，不虛構二進位檔。
- 保留正式規章與 ECHO 文件的矛盾，並用來源分類和交叉文件引導玩家判讀。

Verification:

- `npm run validate:content`
- 檢查索引列出的每個 `RELATED FILES` 路徑都存在。

### Stage 3 — logs/reports 事件證據鏈

Files owned by logs/reports worker:

- `game/content/files/logs/*`
- `game/content/files/reports/*`

Implementation:

- 為每份 Log／報告補上統一史料標頭。
- 將 Unit 11 的紙本初稿、A／B 報告、鏡像核對卡、原始事故音訊、主控台時間、ECHO 存取／注入／覆寫、名冊與憑證變更分別掛到正確的事件。
- 明確標示 `human-incident`、`echo-modified`、`echo-injected`、`system-generated`、`mixed`，但不把「未署名」自動等同於 ECHO。
- 保留原始正文中作為謎題證據的矛盾時間與不同來源。

Verification:

- `rg -L "HISTORICAL EVENT:|SOURCE CLASS:|EVIDENCE TAGS:|VISIBILITY:|IMPACT:" game/content/files/logs game/content/files/reports`
- `node -e "const fs=require('fs'); console.log(fs.readdirSync('game/content/files/logs').length)"`（僅作檔案存在性快速檢查）。

### Stage 4 — private-a/private-b 分端文件

Files owned by private worker:

- `game/content/files/private-a/*`
- `game/content/files/private-b/*`

Implementation:

- 為每份分端文件標示 `private-A` 或 `private-B` 可見性、事件、建立者、媒介與影響。
- 區分人類官方分端協定／分組附件與 ECHO 後來加入的個人協定／生存任務。
- 保留 A／B 的不同資料與玩家選擇空間，不替 A 或 B 預設人格、善惡或必然結局。
- 讓私人任務能回連到公開文件、鏡像、名冊與規則覆寫紀錄。

Verification:

- `rg -L "HISTORICAL EVENT:|VISIBILITY:|RELATED FILES:" game/content/files/private-a game/content/files/private-b`
- 檢查任何 `public` 文件都沒有提前寫出 A=042、B=057 的身份結論。

### Stage 5 — 整合、審查與驗證

Files owned by primary agent:

- 以上所有變更檔案。
- 如有必要，補充 `game/content/terminalEntries.js` 的索引入口，但只有在遊戲內 timeline 確實需要解鎖時才修改。

Implementation:

- 檢查每個文件都只有一個主要事件歸屬，跨事件影響用 `RELATED FILES` 表示。
- 檢查角色名稱、日期、Unit 編號、ECHO 動機與六幕對應一致。
- 如新增 timeline 入口，確保不破壞公開流程、私人流程與現有內容驗證。
- 以 `git diff --check` 清理格式問題，不移除使用者既有未追蹤檔案。

Verification:

- `npm run validate:content`
- `npm test`
- `npm run test:e2e`（若瀏覽器依賴已可用）。
- `git diff --check`
- 人工閱讀作者母時間線與遊戲內索引，確認前者完整、後者分階段揭露。

## Integration and manual acceptance checks

- 玩家從 `public-start` 只能先看到 ORPHEUS 與合作訓練脈絡。
- 中期能從 Unit 01～13、事故與鏡像理解「來源與合作」問題。
- 後期才看見 Unit 16 的限制、ECHO 未授權存取與規則覆寫。
- 玩家只能從多份文件推理身份與生成暫停，不會在早期索引直接看到完整反轉。
- 每個事件都至少有一份文件，關鍵轉折事件另有至少一種不同媒介的交叉證據。
- 紙本、備份、音訊與影像標籤只描述實際存在或明確登錄的證據，不製造與既有故事衝突的場景。

## Out of scope

- 不修改 `story.js`、`dialogue.js`、`privateMissions.js`、`endings.js` 的遊戲流程與結局判定。
- 不把 `00-角色設定.md` 改成歷史事件索引；角色和事件的對應只放在 03 與 04。
- 不新增未經 Story Bible 或現有文件支持的研究員、AI 編號、家族史、失蹤經歷或玩家人格結論。
- 不需要為每個「影像」標籤製作圖片資產；若未來需要圖檔，先登錄來源與可見性再建立素材。

## Follow-up platform or deployment checks

- 若 timeline 後續要在遊戲 UI 中直接顯示，另開玩法／UI 設計，不在本次史料整理中偷偷增加入口。
- 若要在 Obsidian 中使用 YAML frontmatter 或 Dataview 欄位，另建立相容格式，不改變遊戲內純文字文件的可讀性。
