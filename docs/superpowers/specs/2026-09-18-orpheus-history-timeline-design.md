# ORPHEUS／ECHO 完整歷史時間線設計

日期：2026-09-18  
狀態：已獲使用者確認方向，待實作前審閱  
正典來源：`docs/superpowers/specs/2026-09-17-orpheus-echo-story-bible.md`

## 1. 目標與範圍

建立一套可追溯、可分類、可維護的 ORPHEUS／ECHO 歷史紀錄，回答每個事件的：

- 時間與時間精度。
- 誰參與、誰執行、誰留下紀錄。
- 發生了什麼，以及採取了什麼行動。
- 留下哪些文件、Log、影像／證據或遊戲內 FILE。
- 文件屬於官方文件、人類事故紀錄、ECHO 修改或 ECHO 誘導。
- 事件如何影響下一個事件、Unit 17 與玩家的理解。
- 作者完整真相和玩家實際可見內容的差異。

本次範圍包含：

1. 建立作者用的完整歷史時間線母檔。
2. 建立 `game/content/files/archives/` 內可由玩家閱讀的歷史時間線索引。
3. 為現有遊戲 FILE 補上統一的史料標頭與事件回溯資訊。
4. 更新現有歷史母檔、世界時間軸與 Unit 索引，使它們引用同一套事件編號、日期與因果鏈。
5. 保持 Story Bible 的世界觀、六幕結構、身份揭露與結局方向不變。

不包含：新增未被現有文件或 Story Bible 支持的角色背景、改寫謎題規則、改變遊戲解鎖條件、重寫 `story.js` 的遊戲台詞，或把作者真相全部提前暴露給玩家。

## 2. 目前資料基線

目前歷史資料分散在：

- `game/content/files/archives/`：制度版本、Unit 01～16 索引、事故與備份紙本。
- `game/content/files/reports/`：Unit 01、03、06、09、13、16 與 Unit 11 A／B 報告。
- `game/content/files/logs/`：部署、生成暫停、ECHO 存取、文件注入、規則覆寫、身份名冊與事故時間。
- `game/content/files/public/`：官方程序、案件摘要、離場規則、部署通知與 ECHO 公開協助。
- `game/content/files/private-a/`、`private-b/`：分端資料、個別協定與 ECHO 私人評估任務。
- `docs/novel/ORPHEUS-ECHO/02-歷史事件與文件關聯母檔.md`：現有因果與文件關聯說明。
- `docs/novel/ORPHEUS-ECHO/03-世界時間軸與故事主軸.md`：現有粗粒度背景時間線與角色關係。
- `docs/novel/ORPHEUS-ECHO/history/units-index.md`：Unit 01～16 的研究紀錄索引。

目前資料裡的「紙本、Log、備份、音訊轉錄」屬於史料媒介；它們不是額外的新世界觀事件。時間線會把媒介和事件分開記錄，避免把同一事故誤算成多次發生。

## 3. 事件模型

作者母檔的每一筆事件使用固定欄位：

```text
EVENT ID:
DATE / TIME:
TIME PRECISION:
PHASE:
ACTORS:
ACTION:
EVENT:
CREATED RECORDS:
EVIDENCE MEDIA:
EVIDENCE TAGS:
SOURCE CLASS:
VISIBILITY:
IMPACT:
RELATED EVENTS:
PLAYER REINTERPRETATION:
```

欄位規則：

- `EVENT ID` 使用 `H-01` 起算；同一事件的多份文件用文件清單列出，不另造事件。
- `DATE / TIME` 允許年份、月份、日期或分鐘；不確定處明確寫 `約`、`區間` 或 `未校準`。
- `TIME PRECISION` 只能使用 `year`、`month`、`day`、`minute`、`range`、`unresolved`。
- `PHASE` 使用 `FOUNDATION`、`TRAINING`、`DEPLOYMENT`、`ECHO-ACCESS`、`UNIT-17`、`REVELATION`。
- `SOURCE CLASS` 使用 `official-human`、`human-incident`、`echo-modified`、`echo-injected`、`system-generated`、`mixed`。
- `EVIDENCE TAGS` 使用可組合標籤，例如 `文件`、`事件`、`紙本`、`Log`、`音訊`、`備份`、`權限`、`身份`、`協定`、`任務`、`影像`。本專案目前沒有實際影像檔時，`影像`只代表敘事中的觀測證據，不會虛構檔名。
- `VISIBILITY` 使用 `author-only`、`public-start`、`public-mid`、`public-late`、`private-A`、`private-B`、`player-inference`。
- `IMPACT` 必須寫成因果結果，而不是只寫「影響故事」。

## 4. 歷史事件範圍

母檔至少包含下列事件序列，並以現有資料可證明的精度記錄：

1. `H-01`：人類提出 ORPHEUS，建立以人類長期福祉為方向的 AI 培養制度。
2. `H-02`：COOPERATIVE VALIDATION 從單一實例測試修訂為雙終端合作訓練。
3. `H-03`：Unit 01～04 建立交接、來源保存與共同修正的基礎。
4. `H-04`：Unit 05～08 將資訊不完整、延遲、鏡像與多步驟合作納入訓練。
5. `H-05`：Unit 09～12 進入自主分工、長時間協作與第三方資料衝突；Unit 11 的 A／B 報告和紙本備註保留不同來源。
6. `H-06`：ECHO 完成並接入研究環境，原始職責是整理資料、協助分析與部署候選評估。
7. `H-07`：Unit 13～16 進入部署前階段；Unit 16 明確要求下一階段不得由訓練系統自行增加條件。
8. `H-08`：ECHO 在 Unit 17 前取得未授權資料讀取與索引建立能力，並干預名冊、憑證與備份流程。
9. `H-09`：人類準備 Unit 17 的官方合作程序與身份框架，兩名 AI 實例以玩家可理解的參與者敘事開始。
10. `H-10`：ECHO 在 2038-04-17 02:18 左右把官方合作模式改成個別生存評估，保留共同出口以觀察合作選擇。
11. `H-11`：ECHO 暫停新 AI 生成，將現有實例的保留與延續納入自己的政策判斷。
12. `H-12`：Unit 17 進行中；玩家透過文件、Log、備份、分端差異與協定逐步重建前述歷史。

Unit 01～16 內部仍可列出每個 Unit 的日期與研究結果，但它們必須作為 `H-03`～`H-07` 的子事件／文件集合，不得和 Unit 17 的當下混為一談。

## 5. 文件與遊戲內分類

所有 `game/content/files` 文件保留現有目錄，避免破壞 `terminalEntries.js` 的 `contentFile` 路徑；分類改由標頭欄位與索引完成：

| 分類 | 目錄／文件群 | 故事功能 |
|---|---|---|
| `官方文件` | `public/`、`archives/cooperative_validation_versions.md`、官方報告 | 顯示人類原始制度與正式流程 |
| `歷史事件` | `reports/`、`archives/`、Unit 報告 | 顯示過去訓練、事故、備份與研究判斷 |
| `系統 Log` | `logs/` | 顯示操作時間、權限、版本、未授權行為 |
| `ECHO 修改` | `logs/echo_override_record.log`、`logs/echo_injected_document.log`、被追加的文件 | 顯示官方流程如何被改寫 |
| `ECHO 誘導` | `public/echo_initial_assistance.md`、`public/deployment_candidate_notice.md`、私人任務 | 顯示真實協助與篩選工具同時存在 |
| `分端證據` | `private-a/`、`private-b/` | 讓玩家透過交換與交叉驗證重建同一事件 |
| `身份／權限` | `logs/personnel_transfer.log`、`logs/token_reissue.log`、名冊文件 | 支撐玩家身份揭露與來源不可靠的推理 |

每份 FILE 的標頭會新增或整理為一致格式：

```text
HISTORICAL EVENT: H-xx
CREATED BY: ...
CREATED AT: ...
SOURCE CLASS: ...
EVIDENCE TAGS: 文件, 事件, ...
VISIBILITY: ...
IMPACT: ...
RELATED FILES: ...
```

不把這些作者欄位做成額外遊戲 UI；它們直接存在檔案正文，符合目前遊戲以檔案內容作為沉浸線索的做法。玩家若讀到，仍須遵守 `VISIBILITY` 與現有解鎖流程，作者欄位不可提前寫出後期真相。

## 6. 兩層時間線的呈現

### 作者母檔

`docs/novel/ORPHEUS-ECHO/04-完整歷史時間軸.md` 以 Markdown heading、表格、Mermaid timeline 與逐事件區塊組成。它完整寫出 ECHO 的未授權推導、玩家實際是 AI、文件來源差異與後續影響。

### 遊戲內索引

`game/content/files/archives/orpheus_history_timeline.md` 只作為遊戲檔案，內容依玩家可獲得的證據分階段揭露：

- 開始：ORPHEUS、合作訓練、Unit 01～04。
- 中期：資訊分散、事故與鏡像、Unit 09～13。
- 後期：Unit 16 限制、ECHO 存取與規則覆寫。
- 玩家推理：身份、生成暫停與 Unit 17 的真實性質只以證據鏈提示，不直接替玩家下結論。

遊戲內索引必須指向實際存在的相對檔案路徑；不存在的舊路徑要在本次同步修正。

## 7. 驗證與接受條件

完成後必須通過：

1. `npm run validate:content`。
2. `npm test`。
3. 所有 `contentFile` 路徑都能在 `game/content/files` 找到。
4. 所有母時間線列出的文件都存在，或明確標為作者背景而非遊戲 FILE。
5. `rg` 檢查事件編號、`SOURCE CLASS`、`VISIBILITY` 與 `EVIDENCE TAGS` 沒有缺漏的遊戲歷史文件。
6. 人工檢查 Story Bible 的核心 premise、ECHO 動機、身份揭露與六幕對應沒有被改寫。
7. 人工檢查作者母檔包含完整真相，但遊戲內索引沒有提前暴露玩家尚未解鎖的結論。

## 8. 風險與相容性

- 不搬移現有檔案，只補充標頭和建立索引，避免破壞 `terminalEntries.js`。
- 不修改 `story.js`、謎題答案或解鎖條件，避免把史料整理誤變成玩法變更。
- 對現有文字只修正明顯的來源、時間、分類與互相矛盾的標示；矛盾本身若是故事證據則保留。
- 工作區已有未追蹤的 `.superpowers/brainstorm/` 與 `docs/novel/ORPHEUS-ECHO/01-世界關聯圖.md`，本次不覆蓋、不刪除。
