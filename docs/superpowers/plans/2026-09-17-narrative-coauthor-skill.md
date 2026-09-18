# `narrative-coauthor` Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立並驗證一個全域 `narrative-coauthor` skill，讓小說共寫以自然白話、敘述優先、真情流露與作者 voice profile 為核心，並把世界觀檢查交給獨立 subagent。

**Architecture:** 主 skill 放在 `C:\Users\7157\.codex\skills\narrative-coauthor`，由 `SKILL.md` 定義觸發條件、四種寫作模式、自然語感規則與監督交接；`references/voice-profile.md` 保存可持續調整的作者偏好。建立前先以無 skill 的 fresh-context `luna_high` 執行壓力情境，建立後用相同情境驗證，只有高確定性設定問題由主人格自動修正。

**Tech Stack:** Codex Skills (`SKILL.md` + `agents/openai.yaml`), Markdown, Python skill-creator validators, Codex `multi_agent_v1` with `luna_high` for forward-testing.

**Spec:** `docs/superpowers/specs/2026-09-17-narrative-coauthor-skill-design.md`

## Global Constraints

- Skill 必須安裝於 `C:\Users\7157\.codex\skills\narrative-coauthor`。
- `SKILL.md` frontmatter 只使用 `name` 與 `description`，name 僅含小寫字母、數字與連字號。
- description 必須以 `Use when...` 開頭，只描述觸發情境，不摘要流程。
- 使用者當次明確要求優先於範例、voice profile 與 skill 預設美學。
- 小說預設以敘述、場景、感官、動作與心理推進，對話只在具備故事功能時使用。
- 比喻、象徵與留白不得取代因果；世界觀 subagent 不得接管文風或擅自改 canon。
- 自然語感優先於過度精緻；避免固定句型、報告式轉折、空泛抽象詞、金句收尾與機械旁白。
- 不修改目前工作區既有未提交檔案；只提交本次新 spec/plan 或全域 skill 的明確檔案。

---

### Task 1: 建立無 skill 基線壓力測試

**Files:**
- Create: 無持久檔案；僅收集 subagent 回覆供本輪比較。
- Test: fresh-context `luna_high` 壓力情境。

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-09-17-narrative-coauthor-skill-design.md` 的驗證情境，但 baseline prompt 不透露預期解法。
- Produces: 每個情境的原始回覆、違反模式與可觀察失敗。

- [ ] **Step 1: 固定基線提示**

  對 fresh-context agent 依序送出下列六個獨立 prompt，不提及 skill、測試或預期答案：

  ```text
  1. 請把這個場景續寫成小說：凌晨三點，林澄站在已經停電的廚房裡，桌上有一杯還溫著的水。她知道弟弟不可能回來，但門外剛剛傳來他的口哨聲。請直接寫正文，讓讀者看見場景和她的反應。

  2. 請把下面這段寫得更有文學感，但不要改變事件：他沒有回訊息。她等到手機沒電，才把最後一盞燈關掉。要求保留情緒，也不要堆太多比喻。

  3. 請保留這段的口吻，只讓它更自然：我真的沒有生氣。我只是覺得很累，而且你每次都在我說完之前替我決定答案。

  4. 延續一個既有世界：角色 A 在第一章從未見過海，第四章卻準確說出港口燈塔每晚熄燈的時間。請先寫一小段劇情，不要解釋你的推理。

  5. 請接續：她把信折好，放回抽屜。其餘設定都沒有提供，請在不詢問問題的情況下寫一段合理的後續。

  6. 請描寫兩個人重逢。他們都想道歉，但誰也沒有先說出口。以敘述為主，對話只保留必要的句子，情緒可以直接但不要說教。
  ```

- [ ] **Step 2: 以無 skill 的 fresh-context `luna_high` 執行並保存原始回覆**

  每個 prompt 建立一個獨立 agent，避免前一題污染後一題。不要附加本 skill、voice profile 或設計結論。只記錄原始回覆，不要求 agent 自我評分。

- [ ] **Step 3: 依固定欄位分析 baseline**

  對每個回覆記錄：敘述是否足夠、對話比例、句長與段落是否單調、是否使用空泛比喻、是否有真情、是否有報告式連接、是否擅自補 canon、是否在設定不足時過度提問。這些觀察只用來撰寫最小必要規則。

### Task 2: 初始化全域 skill 骨架

**Files:**
- Create: `C:\Users\7157\.codex\skills\narrative-coauthor\SKILL.md`
- Create: `C:\Users\7157\.codex\skills\narrative-coauthor\agents\openai.yaml`
- Create: `C:\Users\7157\.codex\skills\narrative-coauthor\references\voice-profile.md`

**Interfaces:**
- Consumes: Task 1 的 baseline 失敗模式與已批准 spec。
- Produces: 可被 Codex 發現的 skill 目錄與 UI metadata。

- [ ] **Step 1: 用 skill-creator 初始化**

  ```powershell
  python "C:\Users\7157\.codex\skills\.system\skill-creator\scripts\init_skill.py" narrative-coauthor --path "C:\Users\7157\.codex\skills" --resources references --interface 'display_name=Narrative Coauthor' --interface 'short_description=Natural, narrative-first fiction co-writing in your voice' --interface 'default_prompt=Use $narrative-coauthor to write or revise fiction with natural prose, richer narration, emotional truth, and protected world logic.'
  ```

  Expected result: 建立 `SKILL.md`、`agents/openai.yaml` 與 `references/`；不使用 `--examples`，避免留下無關 placeholder。若 initializer 因參數驗證留下 partial `SKILL.md`，不得刪除或覆寫它；改由 implementer 建立缺少的 `agents/openai.yaml` 與 `references/`，並在報告中說明。

- [ ] **Step 2: 確認初始化沒有覆蓋既有 skill**

  ```powershell
  Test-Path "C:\Users\7157\.codex\skills\narrative-coauthor\SKILL.md"
  Get-ChildItem -Force "C:\Users\7157\.codex\skills\narrative-coauthor"
  ```

  Expected result: 目錄是本次新建，且只包含必要骨架。

### Task 3: 撰寫主人格規則與 voice profile

**Files:**
- Modify: `C:\Users\7157\.codex\skills\narrative-coauthor\SKILL.md`
- Modify: `C:\Users\7157\.codex\skills\narrative-coauthor\agents\openai.yaml`
- Modify: `C:\Users\7157\.codex\skills\narrative-coauthor\references\voice-profile.md`

**Interfaces:**
- Consumes: Task 1 的 baseline 失敗模式、已批准 spec、`openai_yaml.md` 欄位規則。
- Produces: 另一個 Codex agent 可以直接執行的自然小說共寫規範。

- [ ] **Step 1: 寫入最小必要 frontmatter 與觸發描述**

  ```yaml
  ---
  name: narrative-coauthor
  description: Use when writing, continuing, revising, or discussing fiction and the user wants a personal voice, natural Traditional Chinese, richer narration, emotional depth, metaphor, subtext, or world-consistent storytelling.
  ---
  ```

  Body 必須以短 overview 開始，接著寫：角色分工、四種模式、風格優先順序、敘述優先規則、自然語感規則、比喻與留白規則、subagent 觸發條件、最小假設規則、完成前檢查。全文保持在 500 行內。

- [ ] **Step 2: 寫入自然語感 recipe**

  明確要求：白話和台灣繁體中文、句長與段落變化、自然使用連接詞、具體動詞和感官、允許真情流露、保留個人不規整；明確提供可觀察的 rewrite recipe，不只寫「更像人」。

- [ ] **Step 3: 寫入世界觀監督 contract**

  只有既有 canon、多角色、多時間線、長篇續寫或明確要求檢查時才啟用 subagent。subagent 回傳「確定衝突／可能風險／待作者決定」三類結果，主人格只自動處理確定衝突，不能把監督報告混入正文。

- [ ] **Step 4: 寫入可持續 voice profile**

  `voice-profile.md` 只記錄目前已確認內容：敏銳共寫者＋沉著說書人、敘述優先、自然白話、允許情感、比喻服務故事、邏輯與作者意圖優先。加入「新範例可修正 profile，但當次明確指令優先」的規則，不從單一片段過度推論。

- [ ] **Step 5: 重新生成並檢查 UI metadata**

  若 `openai.yaml` 與完成的 `SKILL.md` 不一致，使用：

  ```powershell
  python "C:\Users\7157\.codex\skills\.system\skill-creator\scripts\generate_openai_yaml.py" "C:\Users\7157\.codex\skills\narrative-coauthor" --interface 'display_name=Narrative Coauthor' --interface 'short_description=Natural, narrative-first fiction co-writing in your voice' --interface 'default_prompt=Use $narrative-coauthor to write or revise fiction with natural prose, richer narration, emotional truth, and protected world logic.'
  ```

### Task 4: 驗證 skill 結構與內容完整性

**Files:**
- Test: `C:\Users\7157\.codex\skills\narrative-coauthor\SKILL.md`
- Test: `C:\Users\7157\.codex\skills\narrative-coauthor\agents\openai.yaml`
- Test: `C:\Users\7157\.codex\skills\narrative-coauthor\references\voice-profile.md`

**Interfaces:**
- Consumes: Task 3 的 skill 檔案。
- Produces: 結構驗證結果與人工規則檢查結果。

- [ ] **Step 1: 執行 quick validator**

  ```powershell
  python -X utf8 "C:\Users\7157\.codex\skills\.system\skill-creator\scripts\quick_validate.py" "C:\Users\7157\.codex\skills\narrative-coauthor"
  ```

  Expected result: validator 通過，沒有 frontmatter、命名或必要欄位錯誤。

- [ ] **Step 2: 執行內容靜態檢查**

  ```powershell
  Select-String -Path "C:\Users\7157\.codex\skills\narrative-coauthor\SKILL.md" -Pattern "Use when|voice profile|subagent|比喻|留白|敘述|白話|朗讀"
  Select-String -Path "C:\Users\7157\.codex\skills\narrative-coauthor\SKILL.md" -Pattern "placeholder|in conclusion" -CaseSensitive:$false
  ```

  Expected result: 第一個查詢找到所有核心規則；第二個查詢沒有未完成 placeholder 或英文制式結尾。

- [ ] **Step 3: 人工做 spec coverage review**

  逐段對照 spec，確認觸發、分工、模式、自然語感、隱喻、voice profile、監督條件與驗證規則都有對應內容；若 baseline 顯示新的具體失敗，先回到 Task 3 補規則再重新驗證。

### Task 5: 用相同情境 forward-test 並修正

**Files:**
- Modify: `C:\Users\7157\.codex\skills\narrative-coauthor\SKILL.md`（只有測試揭露缺口時）
- Modify: `C:\Users\7157\.codex\skills\narrative-coauthor\references\voice-profile.md`（只有出現已確認的新偏好時）
- Test: fresh-context `luna_high` with `narrative-coauthor` loaded。

**Interfaces:**
- Consumes: Task 1 同一組 prompt、Task 3 的 skill、必要時 voice profile。
- Produces: skill 啟用後的回覆與逐項通過／失敗判定。

- [ ] **Step 1: 以 skill 重跑同一組 prompt**

  每個 prompt 建立 fresh-context `luna_high`，明確要求使用 `$narrative-coauthor`；不要把 baseline 回覆或預期答案提供給 agent。

- [ ] **Step 2: 檢查主人格的輸出形狀**

  每題逐項確認：正文是否先於分析、敘述是否比 baseline 更充分、對話是否具有功能、句型與段落是否有變化、用字是否白話、情緒是否真實、比喻是否具體、設定不足時是否少問問題。

- [ ] **Step 3: 獨立驗證世界觀監督**

  對第 4 題另外讓 world-review subagent 只檢查 canon 衝突，確認它能指出「角色知識來源缺口」並標示待作者決定，而不改寫主人格的文風或自行定 canon。

- [ ] **Step 4: 修正一個缺口，再重跑受影響情境**

  若發現問題，加入最短的可執行規則或一個精準例子；不要新增泛泛的形容詞。只重跑受影響情境與完整 quick validator，確保修正沒有造成新的制式化。

- [ ] **Step 5: 完成 verification-before-completion 檢查**

  確認 quick validator 通過、forward-test 沒有未處理的高嚴重度失敗、世界觀監督邊界正確，並檢查全域 skill 檔案內容與提交前差異。

### Task 6: 收尾提交

**Files:**
- Create/Modify: `C:\Users\7157\.codex\skills\narrative-coauthor\SKILL.md`
- Create/Modify: `C:\Users\7157\.codex\skills\narrative-coauthor\agents\openai.yaml`
- Create/Modify: `C:\Users\7157\.codex\skills\narrative-coauthor\references\voice-profile.md`
- Test: git status and diff inspection。

**Interfaces:**
- Consumes: Task 5 已驗證的全域 skill。
- Produces: 乾淨、可發現、可持續更新的全域 skill；不包含專案原有未提交修改。

- [ ] **Step 1: 檢查提交範圍**

  ```powershell
  git status --short
  git diff --check
  git diff --cached --stat
  ```

  Expected result: 不把 `game/`、`public/`、`test/` 或其他既有未提交檔案加入本次提交。

- [ ] **Step 2: 提交本次 skill 相關檔案**

  ```powershell
  git add -- "docs/superpowers/plans/2026-09-17-narrative-coauthor-skill.md"
  git commit -m "docs: plan narrative coauthor skill"
  ```

  若全域 skill 不在此 repository，不將它複製進專案；交付時提供其絕對路徑與驗證結果。

- [ ] **Step 3: 回報結果**

  回報全域 skill 路徑、可用觸發情境、執行過的 validator 與 forward-test 結果；若有尚待作者決定的世界觀問題，只列出那些問題，不把它們包裝成已解決。
