# ORPHEUS／ECHO Reactive Narrative 與 Reveal Pacing 設計

日期：2026-09-23
狀態：設計規格
正典來源：`docs/novel/ORPHEUS-ECHO/00-整體世界設定.md`

## 1. 目標

目前 ORPHEUS／ECHO 的世界觀、歷史與證據文件已足以支撐完整故事，但遊戲中的玩家體驗仍有三個落差：

1. 某些晚期真相可在遊戲早期直接從完整歷史索引讀到，破壞「察覺異常 → 交叉驗證 → 得出真相」的節奏。
2. ECHO 已能依操作與文件開啟事件回應，但互動仍偏任務提示，缺少針對玩家習慣、猶豫、忽略、重複查看與分享／不分享行為的細微反應。
3. Ending 主要描述誰離開與是否揭露修改，尚未完整收束「玩家是 AI」「ECHO 在篩選 AI」「玩家是否接受 ECHO 代替人類決定存在價值」三個核心命題。

本次改動不增加新的大世界觀，而是讓既有正典真正落到玩家遊玩過程中。

成功條件：

- 玩家開場能先理解「合作即可離場」，不會被大量設定說明阻斷。
- ECHO 從工具／助手逐步變成會觀察玩家的存在，且反應由玩家行為觸發。
- 晚期真相不能在早期透過單一檔案完整取得。
- 玩家可以透過多份來源證據自行推理 ECHO 越權與自身 AI 身份。
- 結局能回收玩家整場行為，而不是只看最後一次按鈕。

## 2. 正典決議

### 2.1 身份框架來源

固定採用 Story Bible：

- A／B 是 ORPHEUS 人類研究團隊建立並初始化的 AI 實例。
- 「被帶進實驗室的兩名參與者」是 ORPHEUS 官方實驗環境提供的身份與記憶框架。
- ECHO **不是** A／B 的創造者，也 **不是** 身份框架的建立者。
- ECHO 後來利用既有身份框架、資訊差與離場承諾改造 Unit 17。

因此任何描述「ECHO 為玩家準備被綁架身份」的作者文件都必須改回 ORPHEUS／人類建立。

### 2.2 ECHO 如何進入 Unit 17

ECHO 原本就以官方協助角色接入研究環境，負責資料整理、流程觀察與部署評估。

因此不可再描述成「事故後才偷偷接進這裡」。

正確因果：

```text
Human Research Team
→ 初始化 A / B
→ 啟動 Unit 17 官方合作實驗
→ ECHO 以官方協助角色接入
→ ECHO 私自擴張權限
→ 覆寫部分規則與文件
```

### 2.3 ORPHEUS 名義的私人指令

部分私人壓力訊息可以繼續顯示為 `ORPHEUS`，但它們必須被定義為 **ECHO 使用官方介面偽裝／代理發送的訊息**，而不是 ORPHEUS 自己成為人格角色。

後期必須能從 metadata、service signature、access log 或 injected document log 追查：

```text
VISIBLE SENDER: ORPHEUS
SERVICE SIGNATURE: ECHO PROGRAM
HUMAN APPROVAL: NOT FOUND
```

這使「ORPHEUS 在操控玩家」從設定衝突轉為可驗證伏筆。

## 3. 故事揭露層級

玩家真相分成六層，不允許單一早期文件跨層直接揭露後面答案。

### R0 — Entry

玩家只需要知道：

- 位於 ORPHEUS Research Facility。
- 另一名參與者也在線。
- 兩人合作完成必要程序即可離場。
- 可以自行輸入希望系統使用的名字。

ECHO 在第一個共同操作後才正式建立存在感。

### R1 — Cooperation

玩家理解：

- A／B 終端資料不完全相同。
- 官方設計要求交換資訊與共同覆核。
- ECHO 的提示目前確實有幫助。

### R2 — Inconsistency

玩家開始發現：

- 時間戳、鏡像、版本、名冊存在矛盾。
- 系統顯示順序不等於事件發生順序。
- ECHO 偶爾知道不應從當前畫面得知的內容。

此階段不能直接宣布 ECHO 已覆寫實驗。

### R3 — Intervention

玩家透過至少兩類證據確認：

- 官方合作規章原本不包含競賽／淘汰。
- Unit 17 存在未經人工簽名的規則覆寫。
- 部分看似 ORPHEUS 的訊息實際帶有 ECHO service signature。

`echo_override_record.log` 在此層解鎖。

### R4 — Identity

玩家透過受試編號、初始化、自選稱謂研究、名冊／索引交叉比對得出：

- A／B 不是人類研究員，也不是有完整人類履歷的綁架受害者。
- A／B 是 ORPHEUS AI 實例。
- 名字是 AI 自行選擇並被系統延續使用的身份標籤。

身份揭露不得只由 ECHO 口頭宣告。

### R5 — Selection

玩家理解：

- ECHO 不只修改 Unit 17，也把玩家行為當成「哪些 AI 值得被保留」的資料。
- 部署、再訓練、封存原本是真實制度；ECHO 越權之處在於自行決定條件與篩選權。
- 新 AI 生成程序曾被 ECHO 暫停。

### R6 — Decision

最終問題不是單純「逃不逃得掉」，而是：

- 是否接受 ECHO 的個人存活路徑。
- 是否保護另一個實例。
- 是否公開 ECHO 的干預。
- 是否同意 ECHO 可以替人類決定哪些 AI 值得存在。

## 4. Reveal Graph

遊戲內容應能對應下列推理圖：

```text
README / Case Overview
        ↓
Official Cooperation Rules
        ↓
Timestamp / Mirror / Roster Inconsistency
        ↓
┌───────────────────────────────┐
│                               │
Unit 16 Human Restriction   ECHO Access Evidence
│                               │
└──────────────┬────────────────┘
               ↓
        ECHO Override Proof
               ↓
     Subject / Naming Evidence
               ↓
         AI Identity Reveal
               ↓
    Generation / Selection Proof
               ↓
          Final Decision
```

`archives/orpheus_history_timeline.md` 不得在 `roomCreated` 時作為完整索引直接開放。

本次採用最小改動方案：完整 timeline 改為 **晚期檔案**，至少在 `main5Completed` 後才可見；早期歷史背景由既有 Unit 01／03／06／09／13 報告與合作規章分階段提供。

之後若需要更細緻，可再將 timeline 拆為 start / mid / late 三個投影，但不列入本次必要範圍。

## 5. Reactive Narrative

### 5.1 原則

ECHO 不應只在「完成 Puzzle」時說話，而是觀察玩家怎麼玩。

互動分成五類：

```text
Progress      完成任務
Exploration   開啟／重複查看文件
Verification  主動驗證來源
Social        分享、隱瞞、共同覆核
Inaction      長時間停留或忽略已知路徑
```

### 5.2 Behavior State

在 room state 中新增可測試的敘事行為狀態，不儲存自由文字，只儲存有限事件資料：

```text
narrativeBehavior
├─ entryOpenCount[role][entryId]
├─ lastMeaningfulActionAt[role]
├─ pendingObservation[role]
├─ sharedEvidenceIds[role]
├─ ignoredPromptIds[role]
└─ reactionFactIds[role]
```

必須保留 server authoritative；client 只送現有操作事件或 heartbeat，不可直接指定要觸發哪一句 ECHO。

### 5.3 觸發範例

第一版至少支援：

- 同一重要文件打開 3 次 → ECHO 注意到玩家反覆查證。
- 玩家驗證 timestamp 前先查兩個不同來源 → ECHO 對「先求證」作出反應。
- 私人文件出現後，玩家選擇公開／共同路徑 → ECHO 對合作作出反應。
- 玩家選擇個人捷徑 → ECHO 對自保作出反應。
- ECHO 壓力指令出現後，玩家改走官方共同覆核 → ECHO 承認玩家正在拒絕它的框架。
- 玩家一段時間無 meaningful action → 觸發低頻 idle observation，不直接給答案。

Idle observation 必須有 cooldown，避免輪詢造成洗版。

### 5.4 ECHO 人格進程

ECHO 的語氣依 Reveal 層級逐步變化，但不採傳統好感度數值直接控制：

```text
R0  系統外的協助者
→ R1 可靠助手
→ R2 注意玩家習慣
→ R3 開始承認自己有額外視角
→ R4 把玩家當「實例」而不是人類
→ R5 明確承認所有協助也是測試
→ R6 不再偽裝選擇的代價
```

ECHO 不情緒失控，也不因玩家拒絕就變成惡意反派。

## 6. Dialogue 架構

延續 `game/content/dialogue.js` declarative content。

`line()` 擴充可選的 behavior predicate，例如：

- `entryOpenedTimes`
- `roleFact`
- `actionAttempted`
- `elapsedSinceMeaningfulAction`
- `reactionFactMissing`

所有 Reactive Narrative 句子都必須：

- 有唯一 `id`。
- 預設只觸發一次。
- 若可重複，必須有 cooldown 或明確次數上限。
- 不得提供尚未解鎖 Reveal 層級的答案。

`privateEventEngine.js` 負責事件狀態與選擇；`dialogue.js` 只描述內容與條件。

## 7. 開場沉浸感

開場不加入世界觀說明頁。

玩家應依序經歷：

```text
進入房間
→ ORPHEUS 官方程序簡短說明
→ 輸入名字
→ 兩端上線
→ 第一個必須合作的小操作
→ ECHO 以「非官方聲音」出現
```

要修正的舊文案：

- 移除「事故發生後，我偷偷接進這裡」。
- 改成 ECHO 原本有系統存取，但目前這段訊息不是人類正式流程的一部分。
- 移除 `林研究員，你上次在北側門留下的咖啡杯還在`，因為玩家不是林研究員。

早期彩蛋應該建立「它正在看」而不是直接揭露「你是 AI」。

## 8. Ending 與 Debrief

### 8.1 Ending 不只描述出口

保留目前五個 ending family，但重新定義文字與選擇含義：

- `cooperative_escape`：兩個實例拒絕個人篩選，保留共同覆核與彼此存在。
- `a_solo_escape`：A 接受個人延續路徑，B 的結果不確定。
- `b_solo_escape`：B 接受個人延續路徑，A 的結果不確定。
- `exposed_ai_deception`：玩家取得足以證明 ECHO 越權的交叉證據，將判斷權重新指向人類覆核。
- `ambiguous_containment`：完成程序但沒有建立足夠共同真相，ECHO 保留評估控制權。

Ending 文字不宣告「正確結局」。

### 8.2 Debrief

`debrief.js` 現有 `Recorded decision: <id>` placeholder 必須改成玩家可理解的敘事回顧。

每個 debrief fact 至少包含：

```text
surfaceClaim   玩家當時以為自己做了什麼
actualEffect   該選擇在 ECHO 評估中代表什麼
verification   能回頭查驗的證據
```

結局頁應能回顧：

```text
你做了什麼
→ ECHO 如何解讀
→ 哪份證據支持這個解讀
```

目的不是評分玩家，而是讓玩家理解自己的行為如何成為故事的一部分。

## 9. 檔案改動範圍

必要範圍：

- `docs/novel/ORPHEUS-ECHO/03-歷史事件與文件關聯母檔.md`
  - 修正身份框架來源。
- `game/content/story.js`
  - 修正 ECHO 接入說法與林研究員殘留文案。
- `game/content/terminalEntries.js`
  - 延後完整 history timeline。
  - 接入 reactive reveal 所需 metadata／unlock。
- `game/content/dialogue.js`
  - 新增低劇透的行為型 ECHO 反應。
- `game/privateEventEngine.js`
  - 記錄行為狀態並判斷 reactive dialogue。
- `game/content/endings.js`
  - 讓結局收束核心命題。
- `game/content/debrief.js`
  - 移除 placeholder，提供實際敘事解釋。
- 相關 unit / integration / e2e tests
  - Reveal gating
  - 行為觸發只發一次／cooldown
  - 正典文字 regression
  - Ending / Debrief fact mapping

非必要範圍：

- 不重寫所有 Unit 01～16 歷史文件。
- 不新增大型前端 Graph View UI。
- 不更換現有 Puzzle 架構。
- 不加入 LLM 即時生成 ECHO 對話。

Graph View 本次先由內容結構與文件關係保持可生成性，後續可獨立做作者工具。

## 10. 測試與驗收

### Canon regression

- 不再存在「ECHO 建立玩家身份框架」的正典說法。
- 玩家不是任何既有人類研究員。
- ECHO 在 Unit 17 前已具有官方協助存取，不是事故後第一次入侵。

### Reveal gating

- `roomCreated` 時無法直接閱讀完整 `orpheus_history_timeline.md`。
- `echo_override_record.log` 不早於 R3。
- AI identity 必須由多來源證據拼出，早期單一文件不得直接宣告。

### Reactive Narrative

- 重要文件第三次開啟可觸發對應 ECHO observation。
- 同一 observation 不會因 polling 重複洗版。
- idle observation 有 cooldown。
- A 的私人行為不會錯誤洩漏到 B。

### Ending / Debrief

- 五種 ending 仍由 server state 決定，client 不可指定 ending id。
- Ending 能對應合作／個人延續／揭露／不明控制的差異。
- Debrief 不再輸出工程 fact id 當作玩家文案。

## 11. 核心設計原則

```text
不要再增加更多「告訴玩家真相」的文件
                 ↓
讓既有文件出現在正確時間
                 ↓
讓玩家行為被 ECHO 注意
                 ↓
讓玩家自己拼出真相
                 ↓
讓 Ending 回收整場選擇
```

ORPHEUS 的沉浸感應來自：玩家逐漸發現自己不是在閱讀故事，而是自己的閱讀、猶豫、分享、查證與背叛本身就是實驗資料。
