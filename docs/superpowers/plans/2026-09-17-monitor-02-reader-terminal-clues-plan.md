# Monitor 02 Reader, Terminal Permissions, and Image Clues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Monitor 02 readable in a vertically spacious reader mode, add authored permission-gated Terminal file mutations, isolate A/B failure hints, and add accessible story/clue images across the mainline and four side investigations.

**Architecture:** Keep the existing authenticated operation route and server-owned workstation projection. Add a small authored mutation manifest to `terminalEngine.js`, keep mutable file state role-local, and extend safe entry projections with optional media metadata. Make the Files reader a focused state in the existing workstation renderer so the directory tree collapses without creating a second navigation system.

**Tech Stack:** Node.js CommonJS game engine, Express routes, vanilla browser JavaScript, EJS partials, CSS, Node `node:test`, Playwright E2E, existing content validation, and generated PNG story assets under `public/images/story/`.

**Spec:** `docs/superpowers/specs/2026-09-17-monitor-02-reader-terminal-clues-design.md`

## Global Constraints

- The reader must prioritize vertical space; the document content scrolls inside the reader and the outer Monitor must not overflow.
- Terminal mutations are authored, role-aware, puzzle-gated, server-validated, idempotent, and never accept arbitrary paths or client-provided file content.
- A/B private failures, hints, files, permissions, and mutations must not appear in the other player’s REST response, live snapshot, Intercom, publicProgress, workstation projection, or DOM.
- Mainline answers and ending IDs remain unchanged; Terminal mutations add exploration and permission state without replacing the existing answer contract.
- Images use station-hosted assets, accessible alt text, optional captions, and a text fallback; image content never directly prints a canonical answer.
- Preserve all existing user changes in `game/content/dialogue.js`, `game/content/endings.js`, `game/content/story.js`, `docs/story/`, `.agents/`, and `skills-lock.json`.

---

### Task 1: Isolate ECHO failures and hints by role

**Files:**
- Modify: `game/createRoomState.js`
- Modify: `game/gameEngine.js`
- Modify: `game/safeState.js`
- Modify: `game/content/mainPuzzles.js`
- Modify: `game/content/sidePuzzles.js`
- Modify: `game/content/story.js`
- Test: `test/integration/mainPuzzleOne.test.js`
- Test: `test/unit/contentValidation.test.js`

**Interfaces:**
- Consumes: existing `submitAction` answer flow, `room.attempts`, `room.hints`, `appendStoryEvents`, and `projectForPlayer`.
- Produces: role-local `room.hintsByRole` state, role-scoped error event audiences, and indirect second-level hints for every main and side puzzle.

- [ ] **Step 1: Write the failing integration test for role isolation.**

Add a test that creates a ready room, submits a wrong answer from A, and asserts that A receives the failure event and hint while B’s next state contains neither the failure text nor the hint text. Submit a wrong answer from B and assert the inverse. Also assert that a second-level hint contains no canonical answer string.

```js
test('private answer failures and hints stay on the submitting player', async () => {
  const { a, b, code } = await readyRoom();
  const failed = await action(a, code, {
    actionId: 'private-failure-a', puzzleId: 'main1', stepId: 'identity', value: 'wrong'
  });
  assert.match(JSON.stringify(failed.body.state.intercom), /資料不符/);
  assert.doesNotMatch(JSON.stringify(failed.body.state.intercom), /ORPHEUS-17/);
  assert.doesNotMatch(JSON.stringify((await state(b, code)).body.state), /資料不符/);
  assert.doesNotMatch(JSON.stringify((await state(b, code)).body.state), /ORPHEUS-17/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the expected reason.**

Run: `npm test -- test/integration/mainPuzzleOne.test.js`

Expected: FAIL because the current answer error uses `audience: { kind: 'both' }` and the hint state is shared.

- [ ] **Step 3: Implement role-local hint storage and role-scoped errors.**

Initialize `hintsByRole: { A: {}, B: {} }` in the room state. In `submitAction`, select and update `room.hintsByRole[role][puzzleId][stepId]`, and emit the failed-answer event with `audience: { kind: 'role', role }`. Keep `room.hints` as a compatibility fallback only for imported legacy rooms; never expose it directly from `publicProgress`.

Update `safeState.publicProgress(room, role)` and its caller so `publicProgress.hints` is cloned from the requested role’s hint map. Keep public chapter and main progress unchanged.

- [ ] **Step 4: Replace answer-revealing second hints with directional clues.**

Update the second hint in every main puzzle and side puzzle to point to a folder, timestamp, field difference, ordering rule, or cross-check. Do not alter `acceptedAnswers`, puzzle IDs, step IDs, or ending operations. Add a content-schema assertion that authored hint strings do not contain any canonical accepted answer for the same step.

- [ ] **Step 5: Run the focused test and all content unit tests.**

Run: `node --test test/integration/mainPuzzleOne.test.js test/unit/contentValidation.test.js`

Expected: PASS, with A/B state projections containing only the requesting player’s failure and hint data.

- [ ] **Step 6: Commit the isolated hint change.**

```bash
git add game/createRoomState.js game/gameEngine.js game/safeState.js game/content/mainPuzzles.js game/content/sidePuzzles.js game/content/story.js test/integration/mainPuzzleOne.test.js test/unit/contentValidation.test.js
git commit -m "fix: isolate private puzzle failures and hints"
```

### Task 2: Add permission-gated Terminal mutations

**Files:**
- Modify: `game/createRoomState.js`
- Modify: `game/terminalEngine.js`
- Modify: `game/safeState.js`
- Modify: `game/content/terminalEntries.js`
- Modify: `game/content/operations.js`
- Modify: `public/js/workstation.js`
- Test: `test/unit/terminalEngine.test.js`
- Test: `test/integration/mainPuzzleOne.test.js`
- Test: `test/e2e/workstationExploration.spec.js`

**Interfaces:**
- Consumes: `executeTerminalCommand(room, player, value)`, `refreshWorkstation(room)`, `projectWorkstation(room, role)`, and content predicates from `evaluatePredicate`.
- Produces: parser support for `UNLOCK`, `DELETE`, `ADD`, and `RESTORE`; an authored mutation manifest; and role-local `deletedEntryIds`, `addedEntryIds`, and `permissions` projections.

- [ ] **Step 1: Write unit tests for parser and authorization failures.**

Add tests for valid parsing of each new command, path traversal rejection, unknown target rejection, wrong-role rejection, missing permission rejection, and no state mutation after a rejected command.

```js
test('rejects an authored mutation until its permission is earned', () => {
  const room = fixtureRoom();
  const before = structuredClone(room.workstation.A);
  assert.throws(
    () => executeTerminalCommand(room, { role: 'A' }, 'UNLOCK hidden.audit.md'),
    error => error.code === 'PERMISSION_REQUIRED' && error.status === 423
  );
  assert.deepEqual(room.workstation.A, before);
});
```

- [ ] **Step 2: Run the focused unit test and verify it fails.**

Run: `npm test -- test/unit/terminalEngine.test.js`

Expected: FAIL because the parser currently accepts only `HELP`, `HINT`, `SEARCH`, `SCAN`, `UNZIP`, and `SEND`.

- [ ] **Step 3: Define the authored mutation manifest.**

Add a frozen `TERMINAL_MUTATIONS` table in `game/terminalEngine.js`. Each entry must contain `command`, `targetEntryId`, `roles`, `requires`, `effect`, and non-answer `success`/`denied` text. Start with one safe example per operation across the story: a hidden audit note that can be unlocked after the relevant evidence is opened, a deletable mirror error file, an authored supplemental record that can be added after a permission token is earned, and a restorable checksum entry.

Add `deletedEntryIds`, `addedEntryIds`, and `permissions` arrays to each workstation state. The manifest is the only source of valid target IDs; `safeArgument` continues to reject paths, separators, control characters, and traversal patterns.

- [ ] **Step 4: Implement command execution with idempotent effects.**

Extend `parseTerminalCommand` and `HELP`. Before applying a mutation, resolve the exact authored manifest entry, validate the role, evaluate `requires`, and reject with `PERMISSION_REQUIRED`, `ENTRY_LOCKED`, or `INVALID_COMMAND` without changing state. Apply effects only to the current role unless the manifest explicitly marks the effect as shared. Return `stateChanged`, command, output, events, and newly visible IDs using the existing terminal result shape.

Ensure duplicate action IDs remain handled by the existing route and duplicate mutation commands return a stable “already applied” result without duplicating files or events.

- [ ] **Step 5: Include mutated entries in the server-owned workstation projection.**

Update `visibleEntries`, `refreshWorkstation`, and `projectWorkstation` so a deleted entry is omitted from the requesting role’s file list, an added/restored entry appears only when its manifest permits it, and the other role retains its own view. Keep root folders and required mainline files undeletable even if a client guesses their IDs.

- [ ] **Step 6: Add integration coverage for a full permission path.**

Test: command denied before the prerequisite; a valid puzzle operation grants the permission; the command unlocks or mutates the exact file; A’s private mutation does not appear in B’s workstation or Intercom; repeating the command is idempotent; and `UNZIP` plus existing commands still work.

- [ ] **Step 7: Add E2E coverage for Terminal-to-Files progression.**

In `test/e2e/workstationExploration.spec.js`, enter the command through the visible Terminal form, assert the authored output, switch to Files, and assert the newly unlocked or restored entry is visible. Assert the unavailable command does not reveal the hidden filename in HELP or error output.

- [ ] **Step 8: Run focused tests and commit.**

Run: `npm test -- test/unit/terminalEngine.test.js test/integration/mainPuzzleOne.test.js`

Run: `npm run test:e2e -- --workers=1 test/e2e/workstationExploration.spec.js`

Expected: PASS for the focused suites.

```bash
git add game/createRoomState.js game/terminalEngine.js game/safeState.js game/content/terminalEntries.js game/content/operations.js public/js/workstation.js test/unit/terminalEngine.test.js test/integration/mainPuzzleOne.test.js test/e2e/workstationExploration.spec.js
git commit -m "feat: add permission-gated terminal file mutations"
```

### Task 3: Add authored image clues and accessible document media

**Files:**
- Create: `public/images/story/incident-monitor-record.png`
- Create: `public/images/story/fragment-order-sheet.png`
- Create: `public/images/story/night-shift-object.png`
- Modify: `game/content/terminalEntries.js`
- Modify: `game/terminalEngine.js`
- Modify: `public/js/workstation.js`
- Modify: `public/css/workstation.css`
- Test: `test/unit/contentValidation.test.js`
- Test: `test/e2e/workstationExploration.spec.js`

**Interfaces:**
- Consumes: authored terminal entry records and the server-side `projectWorkstation` entry projection.
- Produces: optional `imageUrl`, `imageAlt`, `imageCaption`, and `imageRole` fields, plus safe image rendering with a text fallback.

- [ ] **Step 1: Write content and browser tests for media metadata.**

Add content validation tests for an allowed station-local PNG path, required alt text, valid `imageRole`, and rejection of external URLs or missing alt text. Add an E2E fixture entry with media metadata and assert the document contains an image with the expected alt text and caption.

- [ ] **Step 2: Run the tests and verify they fail.**

Run: `node --test test/unit/contentValidation.test.js`

Expected: FAIL because terminal entries do not currently validate or project image fields.

- [ ] **Step 3: Create three story assets.**

Use the image-generation capability to create three low-light CRT investigative images with no readable canonical answer text: a timestamp-bearing monitor/equipment record, a torn paper sequence fragment, and a mundane night-shift facility object. Save the final PNGs under `public/images/story/` and inspect each image for readability, no accidental answer text, and consistent palette.

- [ ] **Step 4: Add media metadata to selected mainline and side entries.**

Attach the monitor image to an incident/timeline document, the fragment image to a sequence/recovery document, and the facility object image to a background side-investigation document. Give each image a factual alt description and a short in-world caption. Keep at least one image atmospheric rather than answer-bearing.

- [ ] **Step 5: Validate and render media safely.**

Add a server-side validator for `imageUrl` beginning with `/images/story/`, non-empty `imageAlt`, optional `imageCaption`, and `imageRole` in `clue|atmosphere`. In `workstation.js`, render an `img` with `alt`, followed by caption text when present; if the image cannot load, expose the caption/text fallback without inserting HTML from content.

- [ ] **Step 6: Add CSS for readable media.**

Keep images inside the document column with `max-width: 100%`, intrinsic height, a restrained border, and no layout expansion beyond the scroll container. Ensure the image and caption remain visible in keyboard navigation and high-contrast/reduced-motion modes.

- [ ] **Step 7: Run focused tests and commit.**

Run: `node --test test/unit/contentValidation.test.js`

Run: `npm run test:e2e -- --workers=1 test/e2e/workstationExploration.spec.js`

Expected: PASS, including image alt text and fallback coverage.

```bash
git add public/images/story game/content/terminalEntries.js game/terminalEngine.js public/js/workstation.js public/css/workstation.css test/unit/contentValidation.test.js test/e2e/workstationExploration.spec.js
git commit -m "feat: add accessible story image clues"
```

### Task 4: Implement vertically focused Files reader mode

**Files:**
- Modify: `public/js/workstation.js`
- Modify: `public/css/workstation.css`
- Modify: `views/partials/operationsMonitor.ejs`
- Modify: `test/e2e/accessibilityAndLayout.spec.js`
- Modify: `test/e2e/workstationExploration.spec.js`

**Interfaces:**
- Consumes: existing `currentView.__openedEntry`, `folderPath`, `captureViewState`, `restoreFocus`, and workstation content projections.
- Produces: `.is-reader-focused` reader state, same-row back/title header, vertical fill layout, inner content scrolling, and stable responsive behavior.

- [ ] **Step 1: Write the failing layout and navigation tests.**

Add Playwright assertions that opening a file sets a reader-focused marker, the directory tree is hidden, the back control is adjacent to the filename heading, the document region can scroll vertically, and the outer operations workspace has no horizontal overflow. Add a narrow viewport assertion that the file title and back control remain usable.

```js
test('opens Files documents in a vertically focused reader', async ({ page }) => {
  await openWorkstationFixture(page);
  await page.getByRole('button', { name: /incident_report/i }).click();
  const reader = page.locator('[data-workstation-document]');
  await expect(reader).toHaveAttribute('data-reader-focused', 'true');
  await expect(page.locator('[data-workstation-tree]')).toBeHidden();
  await expect(reader.locator('[data-workstation-back]')).toBeVisible();
  await expect.poll(() => reader.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  await expect(page.locator('[data-operations-workspace]')).toHaveJSProperty('scrollWidth', await page.locator('[data-operations-workspace]').evaluate(node => node.clientWidth));
});
```

- [ ] **Step 2: Run the focused E2E test and verify it fails.**

Run: `npm run test:e2e -- --workers=1 test/e2e/accessibilityAndLayout.spec.js test/e2e/workstationExploration.spec.js`

Expected: FAIL because the current reader keeps the tree visible, renders the back button below the heading, and uses a fixed two-column layout.

- [ ] **Step 3: Implement the reader-focused DOM state.**

When `currentView.__openedEntry` is present, add `is-reader-focused` to the Files layout, render the back button inside the heading row before the document title, and mark the document with `data-reader-focused="true"`. Keep `folderPath`, `lastFocusId`, Backspace navigation, and live snapshot preservation unchanged.

- [ ] **Step 4: Implement the vertical layout contract.**

Use the available Monitor height for the workstation content and make the document body the scroll container. In focused mode hide the tree visually and from layout while preserving an accessible return control. Remove redundant fixed-height whitespace around the document header and prevent the outer workspace from gaining a second vertical scrollbar. Preserve the existing compact two-column view when no document is open.

- [ ] **Step 5: Verify keyboard and responsive behavior.**

Ensure the inline back button has the existing aria label/title, receives focus after opening, returns to the previous folder, and restores the last tree focus. At the narrow breakpoint, keep the reader single-column and let the heading wrap without clipping the filename.

- [ ] **Step 6: Run focused E2E tests and commit.**

Run: `npm run test:e2e -- --workers=1 test/e2e/accessibilityAndLayout.spec.js test/e2e/workstationExploration.spec.js`

Expected: PASS for the reader, keyboard, accessibility, and workstation layout cases.

```bash
git add public/js/workstation.js public/css/workstation.css views/partials/operationsMonitor.ejs test/e2e/accessibilityAndLayout.spec.js test/e2e/workstationExploration.spec.js
git commit -m "fix: focus monitor reader on vertical document space"
```

### Task 5: Integrate all mainline and side-story content

**Files:**
- Modify: `game/content/mainPuzzles.js`
- Modify: `game/content/sidePuzzles.js`
- Modify: `game/content/story.js`
- Modify: `game/content/terminalEntries.js`
- Modify: `game/content/operations.js`
- Test: `test/integration/mainPuzzleOne.test.js`
- Test: `test/integration/roomRoutes.test.js`
- Test: `test/unit/contentValidation.test.js`

**Interfaces:**
- Consumes: the role-local hint map, mutation manifest, safe media entry shape, and reader projection from Tasks 1–4.
- Produces: coherent authored examples across all six main puzzles and four side investigations, with no direct-answer ECHO responses.

- [ ] **Step 1: Write content coverage assertions.**

Assert that every main puzzle step and every side puzzle step has a directional hint path, that at least one authored mutation is available to each of A and B only after a declared prerequisite, and that the selected image entries are reachable from both a mainline and a side-story path without exposing private content.

- [ ] **Step 2: Run the content coverage tests and verify any missing coverage.**

Run: `node --test test/unit/contentValidation.test.js test/integration/mainPuzzleOne.test.js test/integration/roomRoutes.test.js`

Expected: FAIL only for content entries not yet wired to the new declarations.

- [ ] **Step 3: Wire mutations, permissions, and media into all authored paths.**

Use existing public facts, role facts, opened-entry predicates, and step IDs. Do not alter canonical answers or operation IDs. Keep side-investigation mutations private unless the content manifest explicitly makes them shared.

- [ ] **Step 4: Run the content and integration suites.**

Run: `node --test test/unit/contentValidation.test.js test/integration/mainPuzzleOne.test.js test/integration/roomRoutes.test.js`

Expected: PASS with all six mainline puzzles, four side investigations, media metadata, and permission declarations validated.

- [ ] **Step 5: Commit the authored integration.**

```bash
git add game/content/mainPuzzles.js game/content/sidePuzzles.js game/content/story.js game/content/terminalEntries.js game/content/operations.js test/integration/mainPuzzleOne.test.js test/integration/roomRoutes.test.js test/unit/contentValidation.test.js
git commit -m "feat: connect terminal permissions to story investigations"
```

### Task 6: Full verification and regression review

**Files:**
- Test: `test/unit/*.test.js`
- Test: `test/integration/*.test.js`
- Test: `test/e2e/accessibilityAndLayout.spec.js`
- Test: `test/e2e/workstationExploration.spec.js`
- Test: `test/e2e/privateNarrative.spec.js`
- Test: `test/e2e/fullEndings.spec.js`

**Interfaces:**
- Consumes: all completed reader, Terminal, role-isolation, media, and story content changes.
- Produces: fresh evidence for the final requirements checklist and a separated report for any pre-existing environment/connection failures.

- [ ] **Step 1: Run syntax and diff hygiene checks.**

Run: `node --check game/gameEngine.js && node --check game/safeState.js && node --check game/terminalEngine.js && node --check public/js/workstation.js && git diff --check`

Expected: exit 0 with no whitespace errors.

- [ ] **Step 2: Run the complete unit and integration suites.**

Run: `npm test`

Expected: exit 0 with zero unit or integration failures.

- [ ] **Step 3: Run the relevant workstation and narrative E2E suites.**

Run: `npm run test:e2e -- --workers=1 test/e2e/accessibilityAndLayout.spec.js test/e2e/workstationExploration.spec.js test/e2e/privateNarrative.spec.js test/e2e/fullEndings.spec.js`

Expected: reader, Terminal, privacy, mainline, side investigation, and ending tests pass. If a connection/423 failure remains in an existing narrative path, record the exact test and confirm whether it reproduces against the pre-change baseline before attributing it to this work.

- [ ] **Step 4: Inspect the final diff and status.**

Run: `git status --short && git diff HEAD~5 --stat`

Confirm only intended implementation commits are included; preserve unrelated user files and report any uncommitted user changes without modifying them.

- [ ] **Step 5: Perform a manual requirement checklist.**

Verify: vertical reader mode; inline return; no outer overflow; all main and side hints directional; A/B failure isolation; permission-gated Terminal operations; exact authored target enforcement; idempotency; accessible image clue plus fallback; unchanged canonical answers and endings.
