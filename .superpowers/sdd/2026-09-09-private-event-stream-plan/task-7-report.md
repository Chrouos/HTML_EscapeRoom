# Task 7 Report: Browser live transport with REST fallback

## Status

Implemented and verified.

## TDD evidence

- RED: `npx playwright test test/e2e/liveReconnect.spec.js` failed 2/2 before implementation. The existing browser client neither opened `/live` nor exposed the neutral `SIGNAL LOST` state, still polled with `sinceRevision`, and could not render the canonical REST state shape.
- GREEN: `npx playwright test test/e2e/liveReconnect.spec.js test/e2e/roomFlow.spec.js` passed 3/3 after implementation.
- Full verification: `npm run check` passed 101/101 tests: 61 unit, 30 integration, and 10 e2e.
- The first full-suite rerun exposed the existing 30-second default timeout on the multi-step two-browser room flow under four-worker load. The same test passed focused in 15.8 seconds; increasing only that test's budget to 60 seconds made the fresh full run pass without changing product behavior.

## Implementation

- Added `public/js/live.js` with exactly three transport modes: `websocket`, `polling`, and `resyncing`.
- Initial and recovery snapshots use the authenticated REST `/state` response and adopt its top-level cursor.
- Live events render only at `currentCursor + 1`; a forward gap or malformed event starts one shared REST resync, then resumes the open socket from the adopted cursor.
- Already-applied cursors are not rendered again. Equal-cursor REST responses update countdown data without repeating the renderer.
- Event acknowledgement is sent only after the event projection has been successfully applied.
- Socket closure immediately displays `SIGNAL LOST`, starts `sinceCursor` polling, and schedules reconnect attempts with exponential backoff capped at 10 seconds.
- Socket recovery cancels scheduled polling/reconnect work and resumes from the current cursor, preventing replay duplicates.
- `game.js` now adapts canonical `intercom` / `workstation` snapshots to the existing renderer and routes POST responses through the transport's cursor adoption path.
- No audience, event identity, or transport implementation terminology was added to visible UI text.

## Browser test strategy and review ruling

- The disconnect test uses Playwright `routeWebSocket` to close the browser-side socket and reject reconnects while the real REST API remains available. It verifies `SIGNAL LOST`, `sinceCursor` polling delivery, recovery, and one visible copy of each message.
- The gap test mocks only the external WebSocket boundary while keeping real REST, transport, renderer, and DOM behavior. It injects one skipped cursor, verifies exactly one full snapshot read, then injects the next legal event from the adopted cursor and verifies both messages render once.
- Review ruling: Task 7 does not inspect client `resume` frames or add a production-only test hook. Task 6 integration tests already lock the wire-frame contract; Task 7 verifies browser-observable resync, adopted-cursor continuation, and render behavior.

## Completion checks

- Independent A/B browser contexts are exercised by room flow and reconnect tests.
- Public content is shown once across both actors in browser tests; actor-only cursor/body isolation and shared event identity remain covered at the server boundary by the existing event dispatcher, safe-state, polling, and liveHub integration tests included in `npm run check`.
- Controlled disconnect/reconnect behavior, missing-message recovery, and duplicate suppression are covered by `liveReconnect.spec.js`; the same transport is instantiated independently in each browser context.
- `rg -n "AI_BROADCAST|AI_DIRECT|sinceRevision|revision" views public routes` returned no matches. A broader search confirmed `audience`, `eventId`, and transport mode names occur only in non-visible implementation code, not rendered UI copy.

## Concerns

- Playwright's pass-through WebSocket route did not reliably surface browser-sent frames in this environment. The final test avoids relying on that instrumentation and follows the review ruling above.
- No browser-accessible action currently emits a player-private event on demand. Browser tests therefore cover independent contexts and public visibility, while the existing integration suite remains the authoritative coverage for A-only body/cursor isolation and shared event identity.
