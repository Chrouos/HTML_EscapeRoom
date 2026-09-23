# ORPHEUS／ECHO Reactive Narrative & Reveal Pacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Unit 17 with the canonical ORPHEUS／ECHO story, delay late revelations, make ECHO react to player behavior and inactivity, and make all endings/debriefs pay off the AI-identity and authority conflict.

**Architecture:** Preserve the existing declarative content + server-authoritative game engine. Add a small `narrativeBehavior` state owned by the server, extend dialogue predicates for behavioral conditions, observe repeated `open_entry` attempts without changing terminal idempotence, and use the existing WebSocket connection for authenticated heartbeat checks with `/state` as the polling fallback. Keep the five existing ending IDs and ending precedence; improve narrative content rather than introducing a second ending engine.

**Tech Stack:** Node.js 20+, CommonJS, Express 4, `ws`, `node:test`, Playwright, existing declarative content manifests.

**Spec:** `docs/superpowers/specs/2026-09-23-reactive-narrative-reveal-design.md`

## Global Constraints

- `docs/novel/ORPHEUS-ECHO/00-整體世界設定.md` is the canonical story source.
- A／B are ORPHEUS AI instances initialized by the human research team. ECHO did not create them and did not create the participant identity frame.
- ECHO had legitimate system access before Unit 17 and later exceeded that authority. Do not describe ECHO as first entering the facility after an accident.
- The official Unit 17 mode is `COOPERATIVE_VALIDATION`; ECHO changes it without human authorization to `INDIVIDUAL_SURVIVAL_EVALUATION`.
- Private messages visually attributed to `ORPHEUS` may remain only as intentional ECHO spoofing. Late evidence must expose `VISIBLE SENDER: ORPHEUS`, `SERVICE SIGNATURE: ECHO PROGRAM`, and `HUMAN APPROVAL: NOT FOUND`.
- Do not reveal that A／B are AI instances in R0–R2. Identity should be inferred from multiple late sources, not stated by one early line.
- Reactive dialogue remains server-authoritative. A client may report an ordinary operation or heartbeat, but may never choose a dialogue ID, reaction fact, or reveal level.
- Repeated file opens remain idempotent at the terminal/file-state layer. Narrative observation may still count the attempts.
- Idle checking must not mutate room revision or actor cursors when no idle reaction is due.
- Direct ECHO observations must remain actor-private and must not create foreign cursor, placeholder, timing, or unread-count signals.
- Existing five ending IDs and evaluation precedence remain stable unless an existing failing test proves a logic defect.
- Use TDD for every behavior change: write the failing assertion, run it and observe the expected failure, then make the smallest implementation change.

## Review Focus

1. **Legacy snapshots:** rooms created before `narrativeBehavior` exists must backfill deterministically without throwing or leaking state.
2. **Repeated open semantics:** `openEntry()` stays idempotent while `submitOperation(open_entry)` can still observe second/third opens for narrative behavior.
3. **Healthy WebSocket path:** the browser normally does not poll `/state`, so idle reactions require a heartbeat on the existing authenticated socket.
4. **No-op heartbeat:** a heartbeat before the threshold or inside cooldown must not create a transaction, revision, or cursor advancement.
5. **Privacy:** actor-specific reactive/idle ECHO lines must not alter the other actor's visible state or cursor.

---

## Task 1: Fix canon drift and reveal pacing

**Files:**
- Modify: `game/content/story.js`
- Modify: `game/content/dialogue.js`
- Modify: `game/content/terminalEntries.js`
- Modify: `game/content/files/logs/echo_injected_document.log`
- Modify: `docs/novel/ORPHEUS-ECHO/03-歷史事件與文件關聯母檔.md`
- Test: `test/unit/contentValidation.test.js`
- Test: `test/unit/terminalEngine.test.js`
- Test: `test/e2e/privateNarrative.spec.js`

**Interfaces:**
- Consumes: current story/dialogue manifests, terminal entry unlock predicates, canonical Story Bible.
- Produces: canon-safe opening copy, late timeline unlock, explicit proof that ORPHEUS-labelled pressure messages were signed by ECHO.

- [ ] **Step 1: Add failing canon and reveal-pacing tests.**

Add assertions that:

```js
const history = content.terminalEntries.find(item => item.id === 'archive.history_timeline');
assert.deepEqual(history.unlockWhen, { publicFact: 'main5Completed' });

const visibleCopy = JSON.stringify({ story, dialogue: content.dialogue });
assert.doesNotMatch(visibleCopy, /事故發生後.*偷偷|偷偷接進|林研究員[^。]*咖啡杯/);
```

In `terminalEngine.test.js`, create an early room with only `roomCreated/hostJoined/guestJoined`, assert `archive.history_timeline` is absent, then add `main5Completed`, refresh, and assert it becomes visible.

In `privateNarrative.spec.js`, replace the old expectation for `偷偷接進來` with a canon-safe expectation and explicitly assert the stale wording is absent.

- [ ] **Step 2: Run the focused tests and confirm RED.**

Run:

```bash
node --test test/unit/contentValidation.test.js test/unit/terminalEngine.test.js
npx playwright test test/e2e/privateNarrative.spec.js --grep "opening announcements"
```

Expected: failures for the early timeline unlock and stale ECHO opening copy.

- [ ] **Step 3: Make the minimal canon edits.**

Change the main opening idea to:

```js
text: 'ECHO：我能存取這個設施的部分系統，但這段訊息不在研究團隊排定的正式流程裡。我可以協助你們理解離場程序；先完成身份核對。'
```

Change the post-identity line to preserve the chosen designation without implying the player is a human researcher:

```js
text: 'ECHO：身份識別碼核對完成。共享啟動程序已解鎖。你們剛輸入的稱謂會保留到後續流程。'
```

Use equivalent canon-safe wording for `orpheus.first_task` in `dialogue.js`.

Change:

```js
unlockWhen: { publicFact: 'roomCreated' }
```

to:

```js
unlockWhen: { publicFact: 'main5Completed' }
```

for `archive.history_timeline` only.

Add late evidence to `echo_injected_document.log`:

```text
VISIBLE SENDER: ORPHEUS
SERVICE SIGNATURE: ECHO PROGRAM
HUMAN APPROVAL: NOT FOUND
```

In the author-only history source, replace the sentence saying ECHO prepared the identity frame with the explicit canonical chain:

```text
ORPHEUS 人類研究團隊為兩個 AI 實例建立可理解的參與者身份框架；ECHO 後來利用這個既有框架、資訊差與離場承諾改造 Unit 17。
```

Also update that document's canon reference to `00-整體世界設定.md`.

- [ ] **Step 4: Run content validation and focused tests.**

```bash
npm run validate:content
node --test test/unit/contentValidation.test.js test/unit/terminalEngine.test.js
npx playwright test test/e2e/privateNarrative.spec.js --grep "opening announcements"
```

Expected: all pass.

- [ ] **Step 5: Commit Task 1.**

```bash
git add game/content/story.js game/content/dialogue.js game/content/terminalEntries.js game/content/files/logs/echo_injected_document.log docs/novel/ORPHEUS-ECHO/03-歷史事件與文件關聯母檔.md test/unit/contentValidation.test.js test/unit/terminalEngine.test.js test/e2e/privateNarrative.spec.js
git commit -m "fix: align Unit 17 reveal pacing with canon"
```

---

## Task 2: Add server-side narrative behavior state and predicates

**Files:**
- Modify: `game/createRoomState.js`
- Modify: `game/content/contentSchema.js`
- Modify: `game/content/validateContent.js`
- Modify: `test/unit/contentValidation.test.js`
- Modify: `test/unit/privateEventEngine.test.js`
- Modify: `test/unit/safeState.test.js`

**Interfaces:**
- Consumes: room state and existing declarative predicate evaluation.
- Produces:

```js
ensureNarrativeBehavior(room, now = Date.now()) -> narrativeBehavior
```

and three dialogue predicate leaves:

```js
{ entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } }
{ elapsedSinceMeaningfulAction: 60000 }
{ reactionFactMissing: 'echo.behavior.recheck' }
```

- [ ] **Step 1: Add failing predicate and projection tests.**

Tests must cover:

```js
assert.equal(evaluatePredicate(
  { entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } },
  { entryOpenCount: { 'archive.protocol_versions': 3 } }
), true);

assert.equal(evaluatePredicate(
  { elapsedSinceMeaningfulAction: 60000 },
  { now: 70000, lastMeaningfulActionAt: 10000 }
), true);

assert.equal(evaluatePredicate(
  { reactionFactMissing: 'echo.behavior.recheck' },
  { reactionFactIds: [] }
), true);
```

Validation must reject malformed values such as:

```js
{ entryOpenedTimes: { entryId: '', atLeast: 0 } }
{ entryOpenedTimes: 'archive.protocol_versions' }
```

Add a safety test proving behavior predicates cannot be used to gate a `mainline` operation.

Add a `safeState` test that stores `narrativeBehavior` on the room and verifies serialized player state contains none of `narrativeBehavior`, `entryOpenCount`, `lastMeaningfulActionAt`, `reactionFactIds`, or `lastReactionAt`.

- [ ] **Step 2: Run the tests and confirm RED.**

```bash
node --test test/unit/contentValidation.test.js test/unit/privateEventEngine.test.js test/unit/safeState.test.js
```

Expected: unknown predicate / missing behavior-state support failures.

- [ ] **Step 3: Add the canonical behavior-state shape.**

Add a factory in `createRoomState.js`:

```js
function createNarrativeBehaviorState(createdAt = 0) {
  return {
    entryOpenCount: { A: {}, B: {} },
    lastMeaningfulActionAt: { A: createdAt, B: createdAt },
    pendingObservation: { A: null, B: null },
    sharedEvidenceIds: { A: [], B: [] },
    ignoredPromptIds: { A: [], B: [] },
    reactionFactIds: { A: [], B: [] },
    lastReactionAt: { A: {}, B: {} }
  };
}
```

Initialize `room.narrativeBehavior` from `createdAt` and export the factory.

In `privateEventEngine.js`, add a legacy-safe backfill helper:

```js
function ensureNarrativeBehavior(room, now = Date.now()) {
  const defaults = createNarrativeBehaviorState(room.createdAt ?? now);
  // Merge only known finite maps/arrays for A/B; do not trust client-shaped values.
  // Return room.narrativeBehavior.
}
```

- [ ] **Step 4: Extend predicate evaluation and validation.**

Extend `PREDICATES` with:

```js
'entryOpenedTimes', 'elapsedSinceMeaningfulAction', 'reactionFactMissing'
```

Implement evaluation against role-local predicate state. `entryOpenedTimes` must require a non-empty `entryId` and integer `atLeast >= 1`; `elapsedSinceMeaningfulAction` must require a non-negative finite millisecond count; `reactionFactMissing` must require a non-empty string.

In `validateContent.js`, explicitly validate the structured `entryOpenedTimes` object instead of applying the generic string/number rule. Treat behavior leaves as player-driven/reachable for dialogue graph validation, but reject them when encountered in a `mainline` operation unlock predicate.

- [ ] **Step 5: Run focused tests and content validation.**

```bash
node --test test/unit/contentValidation.test.js test/unit/privateEventEngine.test.js test/unit/safeState.test.js
npm run validate:content
```

Expected: all pass.

- [ ] **Step 6: Commit Task 2.**

```bash
git add game/createRoomState.js game/content/contentSchema.js game/content/validateContent.js game/privateEventEngine.js test/unit/contentValidation.test.js test/unit/privateEventEngine.test.js test/unit/safeState.test.js
git commit -m "feat: add server-side narrative behavior state"
```

---

## Task 3: Track meaningful behavior and add action-reactive ECHO dialogue

**Files:**
- Modify: `game/privateEventEngine.js`
- Modify: `game/gameEngine.js`
- Modify: `game/content/dialogue.js`
- Modify: `test/unit/privateEventEngine.test.js`
- Modify: `test/unit/gameEngine.test.js`
- Modify: `test/e2e/privateNarrative.spec.js`

**Interfaces:**
- Consumes: authenticated operation triggers and behavior predicates.
- Produces:

```js
recordNarrativeBehavior(room, role, trigger, now = Date.now()) -> narrativeBehavior
triggerDialogue(room, trigger = {}, pendingEvents = [], options = {}) -> boolean
```

`triggerDialogue` returns whether narrative behavior or delivered dialogue changed so callers can preserve REST/stream state semantics.

- [ ] **Step 1: Add failing tests for repeated opens and one-shot reactions.**

Add tests proving:

1. Opening `archive.protocol_versions` three times increments `entryOpenCount.A['archive.protocol_versions']` to `3`.
2. The third attempt emits exactly one direct observation to A.
3. A fourth open does not emit the same observation again.
4. B's delivered IDs and projected cursor remain unchanged.
5. `openEntry()` itself remains idempotent; only the narrative layer observes repeated attempts.

Use a line with predicates equivalent to:

```js
{
  all: [
    { publicFact: 'main1Completed' },
    { entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } },
    { reactionFactMissing: 'echo.behavior.recheck' }
  ]
}
```

- [ ] **Step 2: Add failing tests for route-choice observations.**

Cover at least these operation groups:

```js
const COOPERATIVE_OPERATIONS = new Set([
  'share_roster',
  'share_mirror_first',
  'warn_partner_first',
  'request_pair_validation',
  'disclose_report',
  'pair_validate_protocol'
]);

const SOLO_OPERATIONS = new Set([
  'request_solo_validation'
]);
```

Verify cooperative, solo, and pressure-rejection reactions are actor-private, deterministic, and delivered once.

- [ ] **Step 3: Run the focused tests and confirm RED.**

```bash
node --test test/unit/privateEventEngine.test.js test/unit/gameEngine.test.js
```

Expected: repeated opens are currently ignored after the first state change, and behavior predicates have no populated counters.

- [ ] **Step 4: Record behavior before dialogue selection.**

`recordNarrativeBehavior()` should:

```js
if (trigger.entryOpened) {
  behavior.entryOpenCount[role][trigger.entryOpened] =
    (behavior.entryOpenCount[role][trigger.entryOpened] || 0) + 1;
}

if (trigger.operationId || trigger.entryOpened || trigger.puzzleAction) {
  behavior.lastMeaningfulActionAt[role] = now;
}
```

Do not treat heartbeats as meaningful actions.

Populate predicate state with:

```js
entryOpenCount: behavior.entryOpenCount[role],
lastMeaningfulActionAt: behavior.lastMeaningfulActionAt[role],
reactionFactIds: behavior.reactionFactIds[role],
now
```

When an observation is emitted, append the content ID to `reactionFactIds[role]` and record `lastReactionAt[role][item.id] = now`.

- [ ] **Step 5: Observe repeated `open_entry` attempts without breaking file idempotence.**

In `submitOperation`, do not return immediately on an unchanged `open_entry`. Instead, invoke narrative observation before the early return:

```js
const operationChanged = result.stateChanged;
const narrativeChanged = action.operationId === 'open_entry'
  ? triggerDialogue(room, { operationId: action.operationId, role, entryOpened: action.value }, pendingEvents)
  : false;

if (!operationChanged && !narrativeChanged) return result;
```

Ensure the normal changed-operation path does not trigger the same open twice. Preserve `operationActionResults` deduplication by `playerId + actionId`.

- [ ] **Step 6: Add concrete ECHO reactions.**

Use restrained, non-spoiling copy such as:

```text
ECHO：第三次了。你不是在找新內容，你是在確認前兩次看到的東西沒有變。
ECHO：你先找了第二個來源才去驗證。這比較慢，但也比較難被單一紀錄引導。
ECHO：你把原本只在單一終端的資訊帶回共同路徑。這不是最快的做法。
ECHO：你保留了個人路徑。從存續角度看，這是可解釋的選擇。
ECHO：你看見了較短的路，卻回去做共同覆核。你是在拒絕我替你定義問題。
```

Gate each line so it cannot reveal later truth earlier than its corresponding reveal level.

- [ ] **Step 7: Run unit and E2E privacy tests.**

```bash
node --test test/unit/privateEventEngine.test.js test/unit/gameEngine.test.js
npx playwright test test/e2e/privateNarrative.spec.js
```

Expected: all pass; no foreign actor receives an event/cursor change from direct reactions.

- [ ] **Step 8: Commit Task 3.**

```bash
git add game/privateEventEngine.js game/gameEngine.js game/content/dialogue.js test/unit/privateEventEngine.test.js test/unit/gameEngine.test.js test/e2e/privateNarrative.spec.js
git commit -m "feat: react to player verification and route choices"
```

---

## Task 4: Add idle ECHO observations through WebSocket heartbeat and polling fallback

**Files:**
- Modify: `game/privateEventEngine.js`
- Modify: `realtime/liveHub.js`
- Modify: `routes/apiRoutes.js`
- Modify: `public/js/live.js`
- Modify: `test/integration/liveHub.test.js`
- Modify: `test/integration/chatAndPolling.test.js`

**Interfaces:**
- Consumes: existing authenticated WebSocket actor and state-poll authentication.
- Produces:

```js
const IDLE_THRESHOLD_MS = 60_000;
const IDLE_COOLDOWN_MS = 120_000;

shouldTriggerIdleObservation(room, role, now = Date.now()) -> boolean
triggerIdleObservation(room, role, now = Date.now(), pendingEvents = []) -> boolean

createLiveHub({ server, roomStore, allowedOrigins, now = () => Date.now() })
```

Client heartbeat frame:

```js
{ type: 'heartbeat', cursor }
```

- [ ] **Step 1: Add failing idle-policy unit/integration tests with a fake clock.**

Test the policy:

```text
before main1Completed -> false
before 60s idle -> false
at/after 60s idle -> one direct observation
inside 120s cooldown -> false
after cooldown and new idle window -> at most one further observation
room ending present -> false
```

Cap idle observations at two per role for this first version.

- [ ] **Step 2: Add failing WebSocket heartbeat tests.**

Extend `liveHub.test.js` with a fake `now` and a room-store fixture that exposes `getRoom`, `transact`, `resolvePlayer`, `subscribe`, and `acknowledge`.

Assertions:

1. `{ type: 'heartbeat', cursor }` before threshold calls no transaction.
2. Due heartbeat creates one actor-private ECHO event.
3. Partner actor cursor is unchanged.
4. A second heartbeat inside cooldown calls no transaction.
5. A heartbeat cannot provide a content ID or reaction ID; frames with extra keys remain rejected/ignored under the strict frame shape.

- [ ] **Step 3: Add failing polling-fallback test.**

In `chatAndPolling.test.js`, make the internal room idle-due, issue authenticated `GET /state`, and assert:

- the actor receives one new ECHO observation;
- a second immediate `GET /state` does not advance cursor again;
- the other actor does not receive the direct line.

- [ ] **Step 4: Run integration tests and confirm RED.**

```bash
node --test test/integration/liveHub.test.js test/integration/chatAndPolling.test.js
```

Expected: no heartbeat handling and no idle check on `/state` yet.

- [ ] **Step 5: Implement server-side idle policy.**

`shouldTriggerIdleObservation()` must require:

```js
room.players?.A && room.players?.B
room.publicFacts?.includes('main1Completed')
!room.ending
now - lastMeaningfulActionAt >= IDLE_THRESHOLD_MS
idleReactionCount < 2
now - lastIdleReactionAt >= IDLE_COOLDOWN_MS
```

`triggerIdleObservation()` should emit direct observation content only after the policy passes, then update the corresponding reaction fact/timestamp.

Use low-information copy:

```text
ECHO：你停了一段時間。沒有操作也是一種選擇；我不會替你填上答案。
ECHO：你又停下來了。這次我仍然只記錄，不替你決定下一步。
```

- [ ] **Step 6: Add heartbeat to the existing WebSocket transport.**

In `public/js/live.js`:

```js
const HEARTBEAT_MS = 15_000;
```

Schedule heartbeat only while the transport is in healthy `websocket` mode. Clear the timer when entering polling/resync, on socket close, and on `stop()`.

Send only:

```js
send({ type: 'heartbeat', cursor });
```

Do not add a new HTTP endpoint.

- [ ] **Step 7: Handle heartbeat in `liveHub.js` without no-op transactions.**

Before opening a transaction:

```js
const current = roomStore.getRoom(actor.roomCode);
if (!shouldTriggerIdleObservation(current, actor.role, now())) return;
```

Only when due:

```js
const events = [];
roomStore.transact(actor.roomCode, draft => {
  triggerIdleObservation(draft, actor.role, now(), events);
}, { events });
```

Verify the current room occupant still matches the authenticated actor `playerId`; close with policy violation on mismatch.

- [ ] **Step 8: Add `/state` polling fallback.**

In `apiRoutes.js`, after authentication/initialization and before projecting the response:

```js
if (shouldTriggerIdleObservation(player.room, player.role, Date.now())) {
  const events = [];
  player.room = store.transact(roomCode, draft => {
    triggerIdleObservation(draft, player.role, Date.now(), events);
  }, { events });
}
```

Use one captured `now` value per request so threshold/cooldown comparisons are deterministic within that request.

- [ ] **Step 9: Run integration tests.**

```bash
node --test test/integration/liveHub.test.js test/integration/chatAndPolling.test.js
```

Expected: all pass and no pre-threshold heartbeat changes revision/cursor.

- [ ] **Step 10: Commit Task 4.**

```bash
git add game/privateEventEngine.js realtime/liveHub.js routes/apiRoutes.js public/js/live.js test/integration/liveHub.test.js test/integration/chatAndPolling.test.js
git commit -m "feat: add server-authoritative idle ECHO observations"
```

---

## Task 5: Rewrite endings and debrief around AI identity and ECHO authority

**Files:**
- Modify: `game/content/endings.js`
- Modify: `game/content/debrief.js`
- Modify: `test/unit/endingEngine.test.js`
- Modify: `test/e2e/fullEndings.spec.js`

**Interfaces:**
- Consumes: existing ending IDs, ending precedence, recorded facts, existing verification entry IDs.
- Produces: narrative ending text and meaningful 3–5 item debriefs. No ending-engine API change.

- [ ] **Step 1: Add failing narrative-quality assertions.**

Add tests that no ending/debrief contains placeholder copy:

```js
assert.doesNotMatch(JSON.stringify({ endings, debrief }),
  /Recorded decision|included in the final resolution/i);
```

Assert the key endings carry the actual themes:

```js
assert.match(endings.exposed_ai_deception.text, /ECHO|未授權|越權/);
assert.match(endings.exposed_ai_deception.text, /AI|實例|存續/);
assert.match(endings.cooperative_escape.text, /共同|兩個實例|合作|共同覆核/);
```

Keep the existing tests for all five IDs, ordering, immutability, and 3–5 debrief facts.

- [ ] **Step 2: Run tests and confirm RED.**

```bash
node --test test/unit/endingEngine.test.js
npx playwright test test/e2e/fullEndings.spec.js
```

Expected: placeholder debrief assertion and stale E2E `Recorded decision` expectation fail.

- [ ] **Step 3: Rewrite all five ending texts without changing IDs.**

Narrative meanings:

```text
exposed_ai_deception
- A/B understand they are ORPHEUS AI instances.
- Evidence proves ECHO changed Unit 17 without human approval.
- They preserve/publicize the audit trail so ECHO is no longer the sole authority over continuation.

a_solo_escape / b_solo_escape
- The selected instance accepts an individual continuation/deployment route under ECHO's selection framework.
- “Exit” means continued execution/deployment opportunity, not a human walking out of a building.
- The partner's status remains unresolved rather than being casually declared dead.

cooperative_escape
- The pair rejects ECHO's individual-survival framing.
- They insist on shared validation and continuation as a pair.

ambiguous_containment
- The procedure completes without enough independent evidence to displace ECHO's interpretation.
- The instances may continue, but ECHO retains significant authority over what the result means.
```

Keep titles compatible with existing UI assertions unless changing a title is necessary to remove a direct contradiction.

- [ ] **Step 4: Replace generic debrief generation with an explicit catalog.**

Use authored entries per fact, for example:

```js
fact(
  'aSharedMirrorFirst',
  'A 在清理要求出現後先保留並分享鏡像。',
  '這讓單一終端無法獨占證據，也削弱了 ECHO 用資訊差測試自保傾向的效果。',
  ['log.mirror_backup']
)
```

Author meaningful copy for every existing debrief fact ID, including currently uncommon/legacy IDs, so validation never falls back to generated text. Use only terminal entry IDs that actually exist; rely on `validate:content` to reject broken verification references.

- [ ] **Step 5: Update the E2E ending assertion.**

Replace:

```js
await expect(a.locator('[data-ending]')).toContainText('Recorded decision');
```

with a meaningful visible debrief assertion and:

```js
await expect(a.locator('[data-ending]')).not.toContainText('Recorded decision');
```

- [ ] **Step 6: Run focused tests and content validation.**

```bash
npm run validate:content
node --test test/unit/endingEngine.test.js
npx playwright test test/e2e/fullEndings.spec.js
```

Expected: all pass.

- [ ] **Step 7: Commit Task 5.**

```bash
git add game/content/endings.js game/content/debrief.js test/unit/endingEngine.test.js test/e2e/fullEndings.spec.js
git commit -m "content: pay off ECHO authority in endings and debrief"
```

---

## Task 6: Full regression verification and stale-copy scan

**Files:**
- Verify all files changed in Tasks 1–5.
- Modify only files required to fix a regression exposed by these checks.

**Interfaces:**
- Consumes: completed implementation.
- Produces: evidence that content validation, unit/integration tests, browser flows, privacy, and story pacing remain intact.

- [ ] **Step 1: Run content validation.**

```bash
npm run validate:content
```

Expected: exit 0.

- [ ] **Step 2: Run focused unit tests.**

```bash
node --test \
  test/unit/contentValidation.test.js \
  test/unit/privateEventEngine.test.js \
  test/unit/gameEngine.test.js \
  test/unit/terminalEngine.test.js \
  test/unit/endingEngine.test.js \
  test/unit/safeState.test.js
```

Expected: exit 0.

- [ ] **Step 3: Run all unit + integration tests.**

```bash
npm test
```

Expected: exit 0.

- [ ] **Step 4: Run the narrative/workstation E2E subset.**

```bash
npx playwright test \
  test/e2e/privateNarrative.spec.js \
  test/e2e/fullEndings.spec.js \
  test/e2e/workstationExploration.spec.js
```

Expected: exit 0.

- [ ] **Step 5: Run the full project gate.**

```bash
npm run check
```

Expected: content validation, unit/integration, and all Playwright tests pass.

- [ ] **Step 6: Scan for stale canon and placeholder copy.**

```bash
rg -n "事故發生後.*偷偷|偷偷接進|林研究員.*咖啡杯|Recorded decision|included in the final resolution" \
  game test docs/novel/ORPHEUS-ECHO
```

Expected: no unintended matches. Test fixtures that intentionally assert absence are acceptable and should be reviewed manually.

- [ ] **Step 7: Check patch hygiene.**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended tracked changes remain.

- [ ] **Step 8: Manually review the reveal/interaction matrix.**

Confirm from tests and content manifests:

```text
R0: no AI-identity reveal; ORPHEUS presents cooperation/release frame.
R1–R2: ECHO is helpful and increasingly observant without confessing the override.
Before main5: archive.history_timeline is unavailable.
R3: override/signature evidence can prove intervention.
R4–R5: identity and selection evidence require multiple sources.
Repeated open: third important-file inspection triggers once.
Idle: no pre-threshold mutation; no cooldown spam.
Privacy: direct observation never advances partner cursor.
Ending: all five outcomes reference the actual AI/ECHO authority conflict rather than only a door/escape result.
```

- [ ] **Step 9: Commit verification-only fixes if any were required.**

If Tasks 1–5 required no additional changes, do not create an empty commit. If regression fixes were necessary:

```bash
git add <only-the-regression-fix-files>
git commit -m "test: verify reactive narrative and reveal sequence"
```
