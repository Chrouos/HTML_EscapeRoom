# Dual Console UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current clue-and-form page into an immersive two-monitor workstation: persistent intercom on the left and explorable Files, Terminal, and Logs on the right.

**Architecture:** Server projections remain authoritative. EJS renders the accessible shell, small browser modules render intercom and workstation views, and `game.js` coordinates actions and live state. The same ORPHEUS presentation is used for every AI line so players cannot infer whether the other player received it.

**Tech Stack:** EJS, native JavaScript, CSS Grid, existing REST/live transport, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-restricted-dual-console-design.md`

## Global Constraints

- Do not display `AI_BROADCAST`, `AI_DIRECT`, `broadcast`, `direct`, or any delivery-channel badge/metadata. Ordinary story wording such as 「公開片段」 is allowed when it does not describe message audience. Every AI line is simply from `ORPHEUS`.
- Desktop keeps intercom visible while operating files; mobile uses `INTERCOM` and `OPERATIONS` tabs with preserved scroll/focus state.
- The UI must remain usable at 390 px width and with `prefers-reduced-motion: reduce`.
- No Three.js in this release. Motion is CSS-only and cannot delay input or hide required content.
- Out of scope: new narrative branches, mission scheduling, and ending logic.

---

## Task 1: Build the accessible two-monitor shell

**Files:**

- Create: `views/partials/intercomMonitor.ejs`
- Create: `views/partials/operationsMonitor.ejs`
- Modify: `views/game.ejs`
- Modify: `views/partials/head.ejs`
- Create: `public/css/workstation.css`
- Modify: `test/e2e/accessibilityAndLayout.spec.js`

- [ ] Replace layout assertions with exact landmarks: `MONITOR 01 / INTERCOM`, `MONITOR 02 / OPERATIONS`, one message log, one operations workspace, and mobile tab controls.
- [ ] Add tests at desktop and 390 px widths for no horizontal overflow, visible intercom on desktop, one active pane on mobile, keyboard tab order, and unique heading/label relationships.
- [ ] Run `npx playwright test test/e2e/accessibilityAndLayout.spec.js` and confirm red.
- [ ] Render a two-column `workstation-shell` with intercom and operations partials. Keep ending content in a separate full-shell layer.
- [ ] Remove the current `02 / PRIVATE CHANNEL` heading from `views/partials/puzzlePanel.ejs`; retire that partial from the game page instead of renaming the visible channel.
- [ ] Add CSS tokens for phosphor color, casing, bezel, glow, grid, and status lights; use CSS Grid for desktop and tabbed stacking under 760 px.
- [ ] Load `workstation.css` after the existing stylesheet so migration can remain incremental.
- [ ] Run the accessibility/layout test and commit with `feat: add immersive dual-monitor shell`.

## Task 2: Render one believable intercom stream

**Files:**

- Create: `public/js/intercom.js`
- Modify: `views/partials/intercomMonitor.ejs`
- Modify: `public/js/game.js`
- Create: `test/e2e/intercom.spec.js`

- [ ] Add tests proving player messages identify A/B, every AI message identifies only `ORPHEUS`, and no DOM text/attribute/class reveals audience or delivery channel.
- [ ] Feed the renderer two explicit actor-projection fixtures and prove an A-only fixture entry is absent from B's rendered fixture; the B DOM receives no placeholder, gap marker, unread count, or timing notice. Real two-browser delivery remains in the narrative plan.
- [ ] Run `npx playwright test test/e2e/intercom.spec.js` and confirm red.
- [ ] Export `createIntercom(root)` with `render(messages)` and `append(message)`. Track rendered IDs internally, preserve user scroll position unless already near the bottom, and announce new text through a throttled `aria-live` status.
- [ ] Give ORPHEUS public and private lines identical markup, typography, animation, timestamp policy, and sender label.
- [ ] Have `game.js` pass only actor-projected `intercom` entries into this module.
- [ ] Run the intercom e2e test and commit with `feat: render unified ORPHEUS intercom`.

## Task 3: Add Files, Terminal, and Logs exploration

**Files:**

- Create: `public/js/workstation.js`
- Modify: `views/partials/operationsMonitor.ejs`
- Modify: `public/js/game.js`
- Create: `test/e2e/workstationExploration.spec.js`

- [ ] Route the page's state/action requests to explicit workstation fixtures, then test opening each application, navigating folders, opening an entry, returning to its parent, submitting a permitted terminal operation, and keeping locked entries absent without revealing hidden names.
- [ ] Test browser Backspace/keyboard navigation only inside the workstation, not as destructive page navigation.
- [ ] Run `npx playwright test test/e2e/workstationExploration.spec.js` and confirm red.
- [ ] Export `createWorkstation(root, { onOperation })` with `render(view)`, `openApp(appId)`, `openEntry(entryId)`, and `restoreFocus()`.
- [ ] Render only entries present in the actor projection. Use buttons for folders/files and a controlled form for server-declared terminal operations; do not emulate arbitrary shell commands.
- [ ] Persist active app, folder path, scroll position, and last focused item across live renders without storing secret content in local storage.
- [ ] Connect operations to POST `/actions` with a distinct semantic `operationId` and a fresh idempotency `actionId`.
- [ ] Run the workstation e2e test and commit with `feat: add explorable workstation applications`.

## Task 4: Integrate responsive pane switching and signal states

**Files:**

- Modify: `public/js/game.js`
- Modify: `public/js/live.js`
- Modify: `public/css/workstation.css`
- Modify: `test/e2e/roomFlow.spec.js`
- Modify: `test/e2e/liveReconnect.spec.js`
- Modify: `test/e2e/fullEndings.spec.js`

- [ ] Add tests that mobile pane switching preserves draft chat text, active folder, scroll, and focus; desktop resizing restores both monitors without resetting either module.
- [ ] Assert `SIGNAL LOST`, reconnecting, and ready indicators do not mention WebSocket, polling, cursor, or private delivery.
- [ ] Run the affected e2e files and confirm red.
- [ ] Make `game.js` the only coordinator: it receives actor snapshots/events, sends chat/operations, and delegates rendering. Remove legacy direct DOM construction from the old monolith.
- [ ] Implement mobile pane state with accessible selected/hidden attributes and no duplicated content tree.
- [ ] Map transport state to diegetic labels and casing lights without blocking either form during polling fallback.
- [ ] Migrate `fullEndings.spec.js` to the new workstation selectors while preserving the legacy COMPLY/RESIST/TRUTH behavior until the narrative plan replaces it.
- [ ] Run `npx playwright test test/e2e/roomFlow.spec.js test/e2e/liveReconnect.spec.js test/e2e/fullEndings.spec.js` and commit with `refactor: coordinate responsive console modules`.

## Task 5: Add restrained CRT motion and reduced-motion parity

**Files:**

- Modify: `public/css/workstation.css`
- Modify: `public/js/intercom.js`
- Modify: `test/e2e/accessibilityAndLayout.spec.js`

- [ ] Add tests/emulated-media checks that reduced motion disables flicker, scan sweeps, typing delay, shake, and transition-based content delay while keeping all controls and text available.
- [ ] Run `npx playwright test test/e2e/accessibilityAndLayout.spec.js` and confirm red.
- [ ] Add subtle scanlines, phosphor bloom, signal noise, boot pulse, and one-shot message reveal. Keep opacity above readable contrast and avoid flashes above three per second.
- [ ] Under reduced motion, set animation/transition duration to zero, render messages immediately, and replace movement with static status changes.
- [ ] Run the test and commit with `feat: add accessible CRT atmosphere`.

## Completion Checks

- [ ] Manually inspect host and guest side-by-side at 1440×900 and 390×844.
- [ ] Confirm opening Files never hides the intercom on desktop.
- [ ] Confirm private ORPHEUS lines look indistinguishable from shared ORPHEUS lines.
- [ ] Search `rg -n "AI_BROADCAST|AI_DIRECT|broadcast|direct|公開頻道|私人頻道" views public` and review every match; no match may describe delivery to the player or encode audience in DOM metadata.
- [ ] Run `npm run check`.
