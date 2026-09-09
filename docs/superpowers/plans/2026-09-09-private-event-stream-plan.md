# Private Event Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace room-wide polling and shared message exposure with authenticated, per-player event streams that can deliver identical public events and fully hidden private events.

**Architecture:** Keep REST as the command and snapshot boundary. Add one server-owned stream per role, derive every client response from an actor-specific projection, and attach a lightweight `ws` hub to the same HTTP server. A room mutation and its per-recipient envelope are committed together; the browser resumes by cursor and falls back to REST snapshots when WebSocket delivery is unavailable.

**Tech Stack:** Node.js 20, Express 4, CommonJS, `ws`, native browser JavaScript, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-restricted-dual-console-design.md`

## Global Constraints

- Treat `broadcast` and `direct` as internal delivery metadata only. Never expose those values, `AI_BROADCAST`, `AI_DIRECT`, delivery-channel labels, or audience metadata in HTML, API display fields, CSS classes, or visible copy. Ordinary story wording such as 「公開片段」 remains valid.
- A private event must not change the other player's projection, cursor, response size pattern, or visible message sequence.
- Missing or malformed audience data fails closed.
- Do not put join tokens or `playerId` values in URLs, payloads, logs, or rendered HTML.
- Preserve REST action idempotency through `actionId`, scoped by `playerId` so A/B cannot collide; use `operationId` only for semantic game operations.
- Out of scope: workstation redesign, narrative content expansion, Three.js, and generative AI.

---

## Task 1: Give each player a stable server-side identity and stream

**Files:**

- Modify: `game/createRoomState.js`
- Modify: `game/roomStore.js`
- Modify: `test/unit/roomStore.test.js`

- [ ] Add failing tests proving A and B receive different opaque `playerId` values, tokens still resolve to `{ role, playerId }`, and cloned room views cannot mutate stored stream state.
- [ ] Run `node --test test/unit/roomStore.test.js` and confirm the new assertions fail.
- [ ] Extend the room shape with `streams.A` and `streams.B`, each containing `{ cursor: 0, acknowledgedCursor: 0, events: [] }`. Store `{ token, playerId }` under each occupied role and map tokens to `{ roomCode, role, playerId }`.
- [ ] Make `resolvePlayer()` return `{ role, playerId, room }`; keep token and stream metadata server-owned inside `updateRoom()`.
- [ ] Generate player IDs independently from room codes and tokens with the existing collision-safe helper.
- [ ] Run `node --test test/unit/roomStore.test.js` and commit with `feat: add per-player room identities and streams`.

## Task 2: Enforce strict audience rules

**Files:**

- Create: `game/audience.js`
- Create: `test/unit/audience.test.js`

- [ ] Write schema tests for exactly these forms: `{ kind: 'both' }`, `{ kind: 'role', role: 'host' | 'guest' }`, and `{ kind: 'player', playerId }`. Assert missing keys, unknown kinds, legacy strings, and invalid player IDs throw before mutation.
- [ ] Run `node --test test/unit/audience.test.js` and confirm red.
- [ ] Implement `validateAudience(audience)` and `resolveRecipients(room, audience)`. Map `host` to A and `guest` to B, and compare runtime audiences only against server-owned player IDs.
- [ ] Run the test and commit with `feat: validate strict event audiences`.

## Task 3: Replace global state filtering with canonical actor projections

**Files:**

- Modify: `game/safeState.js`
- Modify: `test/unit/safeState.test.js`

- [ ] Add failing tests that compare serialized A/B responses after a hidden-only mutation. The non-recipient response must be byte-identical except for independently calculated countdown output.
- [ ] Add tests that reject an unknown player identity and verify no projection contains `token`, `playerId`, room-wide `revision`, another stream's cursor, event audience metadata, or undiscovered role facts.
- [ ] Replace `forPlayer(room, player)` with `projectForPlayer(room, { role, playerId })`, returning `{ roomCode, role, occupancy, publicProgress, intercom, workstation, privateMissions, discoveredEvidence, ending, debrief }` and no transport metadata.
- [ ] Add `stateResponse(room, player, sinceCursor)` returning `{ success, unchanged, cursor, state?, countdown }`. Compute `countdown` on every request, but exclude it from canonical projection comparisons.
- [ ] Delete legacy permissive audience handling where missing audience meant public.
- [ ] Run `node --test test/unit/safeState.test.js` and commit with `refactor: isolate canonical player projections`.

## Task 4: Commit projection changes and event envelopes atomically

**Files:**

- Create: `game/eventDispatcher.js`
- Create: `test/unit/eventDispatcher.test.js`
- Modify: `game/roomStore.js`

- [ ] Write tests proving a pure `both` content event gets the same `eventId`, `contentId`, resolved text, and payload in both streams while each stream advances once; a direct content event advances only its recipient.
- [ ] Add a mixed-event test where one transaction changes public state and emits an A-only content event: A/B each receive exactly one actor-visible envelope, only A's envelope contains the private item, and the shared item keeps the same `eventId`, `contentId`, and text in both envelopes.
- [ ] Add a property-style test over public, A-only, B-only, and no-op transactions: an actor's canonical projection changes if and only if that actor receives exactly one envelope and its cursor increases by one.
- [ ] Add rollback tests: an updater, projection, audience, or dispatch error must leave room data, both streams, both cursors, and processed action IDs unchanged.
- [ ] Add subscription tests for `subscribe(roomCode, listener)`: listeners run only after a successful room replacement, receive only committed envelopes for that room, and are removed by the returned unsubscribe function.
- [ ] Run `node --test test/unit/eventDispatcher.test.js` and confirm red.
- [ ] Implement `dispatchProjectionChanges({ before, draft, events })`. Validate and resolve all audience-scoped content events inside the draft, compute A/B canonical projections before and after, then compose at most one actor-visible envelope per changed recipient. Pure broadcast content is cloned identically; a mixed transaction may produce different actor payloads while preserving identical IDs/text for its shared items.
- [ ] Add `roomStore.transact(roomCode, updater, { playerId, actionId, events })`. It must clone once, run the updater against the draft, dispatch the combined projection changes, scope duplicate detection to `${playerId}:${actionId}`, and replace the room only after all steps succeed.
- [ ] Add `roomStore.subscribe(roomCode, listener)` and notify subscribers after commit, never while the draft can still roll back.
- [ ] Keep `updateRoom()` temporarily as a compatibility wrapper, but route every event-producing call through `transact()` before this plan ends.
- [ ] Run the test and commit with `feat: commit audience events atomically`.

## Task 5: Migrate REST commands and chat to cursors

**Files:**

- Modify: `routes/apiRoutes.js`
- Modify: `game/storyEngine.js`
- Modify: `game/gameEngine.js`
- Modify: `test/integration/chatAndPolling.test.js`
- Modify: `test/integration/countdown.test.js`
- Modify: `test/integration/mainPuzzleOne.test.js`
- Modify: `test/integration/roomRoutes.test.js`
- Modify: `test/unit/gameEngine.test.js`
- Modify: `test/unit/fullGame.test.js`

- [ ] Replace integration expectations based on `sinceRevision` with `sinceCursor`. Add cases for an unchanged recipient, a hidden-only mutation, a public action delivered to both, duplicate `actionId`, and player chat visible to both.
- [ ] Run `node --test test/unit/gameEngine.test.js test/unit/fullGame.test.js test/integration/chatAndPolling.test.js test/integration/countdown.test.js test/integration/mainPuzzleOne.test.js test/integration/roomRoutes.test.js` and confirm red.
- [ ] Change `GET /api/rooms/:roomCode/state` to accept a non-negative integer `sinceCursor`, return `Cache-Control: no-store`, and use `stateResponse()`.
- [ ] Route action, emergency, initial story, and chat mutations through `store.transact()`. Player chat uses `{ kind: 'both' }`; story callers must always supply a valid audience object.
- [ ] Return only the authenticated actor's snapshot/cursor after POST requests. Keep `actionId` duplicate behavior unchanged and never echo audience metadata.
- [ ] Remove all client-facing use of `revision` and all fallback defaults that treat a missing audience as public.
- [ ] Run the six affected files plus `npm test`, then commit with `refactor: move room APIs to private cursors`.

## Task 6: Add authenticated WebSocket resume and retention handling

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `realtime/liveHub.js`
- Modify: `server.js`
- Modify: `app.js`
- Modify: `test/helpers/testServer.js`
- Create: `test/integration/liveHub.test.js`

- [ ] Install `ws` and add failing integration tests that connect with the room's HttpOnly cookie, reject missing/invalid cookies, reject a mismatched `Origin`, and prove query-string role/player spoofing has no effect.
- [ ] Test `{ type: 'resume', cursor }`, ordered `{ type: 'event', cursor, event }`, `{ type: 'ack', cursor }`, invalid/future cursors, and a simulated retention gap producing `snapshot_required`.
- [ ] Run `node --test test/integration/liveHub.test.js` and confirm red.
- [ ] Implement `createLiveHub({ server, roomStore, allowedOrigins })` on `/live?roomCode=<six digits>`. Authenticate only from the existing room cookie and resolve role/player server-side.
- [ ] Subscribe the hub through `roomStore.subscribe()`, retain the most recent 256 entries per player, and send only contiguous events after the supplied cursor.
- [ ] Define frames exactly as `{ type: 'event', cursor, event: { eventId, kind, payload } }`, `{ type: 'snapshot_required', reason: 'invalid_cursor' | 'retention_gap' }`, `{ type: 'ack', cursor }`, and `{ type: 'resume', cursor }`.
- [ ] Attach the hub to both production and test HTTP servers; close sockets during test teardown.
- [ ] Run `node --test test/integration/liveHub.test.js` and `npm test`, then commit with `feat: add authenticated resumable live updates`.

## Task 7: Add a browser transport state machine with REST fallback

**Files:**

- Create: `public/js/live.js`
- Modify: `public/js/game.js`
- Create: `test/e2e/liveReconnect.spec.js`
- Modify: `test/e2e/roomFlow.spec.js`

- [ ] Add an e2e test that drops the socket, observes a neutral `SIGNAL LOST` status, continues through REST polling, restores the socket, resynchronizes once, and renders each event once.
- [ ] Add a gap test that forces `snapshot_required`, fetches `/state`, adopts its cursor, and resumes without replay duplicates.
- [ ] Run `npx playwright test test/e2e/liveReconnect.spec.js` and confirm red.
- [ ] Implement a transport with only `websocket`, `polling`, and `resyncing` states. Accept an event only when `cursor === currentCursor + 1`; otherwise resync via REST.
- [ ] Make polling use `sinceCursor`, keep exponential backoff capped at 10 seconds, and never expose the transport's audience or event IDs in UI text.
- [ ] Refactor `game.js` to receive snapshots/events from the transport while preserving the current renderer until the dual-console plan replaces it.
- [ ] Run `npx playwright test test/e2e/liveReconnect.spec.js test/e2e/roomFlow.spec.js`, then `npm run check`, and commit with `feat: resume live updates with polling fallback`.

## Completion Checks

- [ ] In two independent browser contexts, trigger an A-only event and verify B's body, cursor, and visible sequence do not change.
- [ ] Trigger a public event and verify A/B receive identical content and event identity.
- [ ] Disconnect and reconnect each side separately; verify no duplicate or missing messages.
- [ ] Search `rg -n "AI_BROADCAST|AI_DIRECT|公開頻道|私人頻道|sinceRevision|revision" views public routes` and confirm no forbidden UI labels or obsolete client sync fields remain.
- [ ] Run `npm run check`.
