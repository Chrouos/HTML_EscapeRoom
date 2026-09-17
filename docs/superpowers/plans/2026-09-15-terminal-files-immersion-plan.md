# Terminal 與 Files 沉浸式改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 Operations 螢幕改成故事驅動的 Terminal 指令與 Files 鎖定文件探索，並讓 HINT／SEND 由 ORPHEUS 公告給雙方。

**Architecture:** 沿用既有 authenticated action route、actor-scoped workstation projection 與 story event dispatcher。新增受驗證的 terminal command semantic operations；Files projection 只提供角色可見的鎖定／解鎖 metadata，答案表單由已開啟的答案文件狀態驅動。

**Tech Stack:** Node.js 20、Express、既有 game engine、EJS、原生 JavaScript/CSS、Node test runner、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-15-terminal-files-immersion-design.md`

## Global Constraints

- 可見 AI 一律顯示為 `ORPHEUS`，不得顯示 `AI_BROADCAST`、`AI_DIRECT`、audience、recipient 或 channel metadata。
- `HINT` 與 `SEND <text>` 產生 `both` audience 的公開事件；私人 Files 與私人事件必須維持 actor projection 隔離。
- `HELP`、`HINT`、`SEARCH <node>`、`SCAN <filename>`、`UNZIP <filename>`、`SEND <text>` 均由伺服器驗證，未知或未解鎖指令不得改變主線。
- 答案表單只能在正確玩家開啟目前章節答案文件後出現；私人任務不得阻塞共同主線。
- 必須支援 `prefers-reduced-motion` 與 390px 雙 monitor 操作。

---

### Task 1: Validated Terminal command operations

**Files:**
- Modify: `game/terminalEngine.js`, `game/gameEngine.js`, `routes/apiRoutes.js`
- Test: `test/unit/terminalEngine.test.js`, `test/unit/gameEngine.test.js`, `test/integration/mainPuzzleOne.test.js`

**Interfaces:**
- Consumes: authenticated `{ roomCode, playerId, role, operationId, value, actionId }` action payload.
- Produces: `{ status, output, publicEvents, unlockedEntryIds }` without exposing audience metadata.

- [ ] **Step 1: Write failing tests** for `HELP`, `HINT`, `SEARCH`, `SCAN`, `UNZIP`, and `SEND`; assert malformed commands, locked targets, unsafe filenames, overlong text, duplicate action IDs, and cross-room identity are rejected without mutation.
- [ ] **Step 2: Run focused unit/integration tests** and confirm the new command assertions fail because no command dispatcher exists.
- [ ] **Step 3: Implement the minimal command parser and semantic operation handlers** in `terminalEngine.js`; route them through existing identity and action-id validation, dispatch `ORPHEUS` `both` events for `HINT`/`SEND`, expand only server-defined archive manifests for `UNZIP`, and return safe terminal output.
- [ ] **Step 4: Run focused tests** until all command and idempotency assertions pass; confirm no private state enters the other actor projection.
- [ ] **Step 5: Commit** with `feat: add validated terminal command operations`.

### Task 2: Files folders, lock state, and answer-document gating

**Files:**
- Modify: `game/content/terminalEntries.js`, `game/content/contentSchema.js`, `game/safeState.js`, `game/terminalEngine.js`, `public/js/workstation.js`
- Test: `test/unit/terminalEngine.test.js`, `test/unit/safeState.test.js`, `test/e2e/workstationExploration.spec.js`

**Interfaces:**
- Consumes: `SEARCH`/`SCAN` results and actor-scoped entry state from Task 1.
- Produces: Files tree nodes with `{ id, parentId, name, kind, locked, opened, answerGate, archive }`; only an opened `answerGate` node enables the answer form, and only a successful `UNZIP` expands an `archive` node.

- [ ] **Step 1: Write failing projection and browser tests** for nested folders, visible locked filenames, safe archive expansion, repeat-unzip idempotency, hidden locked contents, wrong-role absence, and answer form absence before opening the gate.
- [ ] **Step 2: Run the focused tests** and confirm they fail against the current flat workstation projection and always-visible puzzle form.
- [ ] **Step 3: Add explicit folder/file/archive metadata and actor-scoped opened state**; ensure safeState strips answer text and private content until the gate is opened, and never accepts client-supplied archive contents.
- [ ] **Step 4: Update workstation rendering** so Files can open folders/files, show lock status, and reveal the answer form only after the correct file is opened; keep Terminal and Logs keyboard accessible.
- [ ] **Step 5: Run unit and workstation E2E tests** and commit `feat: gate answers behind explored files`.

### Task 3: Diegetic Terminal UI and ORPHEUS public announcements

**Files:**
- Modify: `views/partials/operationsMonitor.ejs`, `public/js/workstation.js`, `public/js/game.js`, `public/css/workstation.css`
- Test: `test/e2e/workstationExploration.spec.js`, `test/e2e/intercom.spec.js`, `test/e2e/accessibilityAndLayout.spec.js`

**Interfaces:**
- Consumes: Task 1 terminal result shape and Task 2 Files projection.
- Produces: Terminal prompt/input/output UI, command history, reduced-motion-safe cursor, and ORPHEUS lines rendered through the existing intercom module.

- [ ] **Step 1: Write failing browser tests** for real Terminal input, command echo/output, `HINT` public announcement visible to both players, and removal of the prominent `你的線索` panel.
- [ ] **Step 2: Run the focused E2E tests** and confirm the current workstation has no real command input and still exposes the always-visible answer panel.
- [ ] **Step 3: Implement Terminal prompt, input history, command submission, and safe output rendering**; map `HINT`/`SEND` responses into existing ORPHEUS intercom events without adding audience labels.
- [ ] **Step 4: Apply CRT cursor/scanline styling** while respecting `prefers-reduced-motion`, max-height scrolling, and 390px pane switching.
- [ ] **Step 5: Run focused workstation/intercom/accessibility tests** and commit `feat: add diegetic terminal command console`.

### Task 4: Production integration and privacy regression coverage

**Files:**
- Modify: `test/e2e/privateNarrative.spec.js`, `test/e2e/roomFlow.spec.js`, `docs/superpowers/sdd/2026-09-15-terminal-files-immersion-plan/progress.md`
- Test: all existing unit, integration, and E2E suites

**Interfaces:**
- Consumes: Tasks 1–3 production routes, actor projections, Files gate, and ORPHEUS event stream.
- Produces: End-to-end proof that exploration, public hints, answer gating, privacy, finale causality, and mobile operation coexist.

- [ ] **Step 1: Add failing production-path E2E cases** for A/B opening a file tree, issuing `HINT`/`SEND`, opening the answer gate, and completing the mainline.
- [ ] **Step 2: Run the new cases** and confirm they fail against the pre-feature UI/route behavior.
- [ ] **Step 3: Wire any remaining coordinator selectors or route adapters** without exposing transport-only fields in visible markup.
- [ ] **Step 4: Run `npm run validate:content`, `npm test`, targeted E2E with `--workers=1 --trace=off`, and `git diff --check`.
- [ ] **Step 5: Commit `test: cover terminal and files immersion flow` and complete the ledger with review results.
