# Private Event Stream Final Fix Report

## Status

Implemented the private-review fixes without changing UI or cursor-gap semantics.

## Fixes

- Chat content IDs now use the server-resolved role (`chat-${role}-${actionId}`), never a client role claim or server-owned `playerId`.
- Authoritative actor streams trim immediately after append to the newest 256 envelopes. Cursor and acknowledged cursor remain monotonic and unchanged by retention.
- The malformed-frame e2e test waits for each intentionally separate snapshot response to finish before sending the next frame; the burst still asserts one single-flight snapshot.

## RED evidence

Command:

`node --test test/unit/eventDispatcher.test.js test/integration/chatAndPolling.test.js test/integration/liveHub.test.js`

Result: exit 1, 21 passed, 2 failed.

- Chat privacy assertion failed because a serialized WebSocket frame contained a server-owned player ID (`true !== false`).
- Stream retention assertion failed because 257 envelopes were stored instead of 256 (`257 !== 256`).

## GREEN evidence

Focused command:

`node --test test/unit/audience.test.js test/unit/eventDispatcher.test.js test/integration/chatAndPolling.test.js test/integration/liveHub.test.js`

Result: exit 0, 29 passed, 0 failed.

Focused e2e command:

`npx playwright test test/e2e/liveReconnect.spec.js`

Result: exit 0, 7 passed.

Fresh full command:

`npm run check`

Result: exit 0.

- Unit: 62 passed.
- Integration: 30 passed.
- E2E: 15 passed.

The first full run exposed parallel e2e timing: the new response-complete wait used Playwright's default 5-second polling timeout, while two existing reconnect cases also timed out under load. The malformed-frame test was changed to condition-based 15-second response waits and a 90-second test budget. A fresh full run then passed all 107 checks.

## Privacy and retention coverage

- A and B REST response bodies, both WebSocket frames, and stored stream envelopes are serialized and checked against both server-owned player IDs after chat.
- The client-provided chat role remains ignored; the server-resolved role is used.
- After 257 public transactions, A and B each retain cursors 2 through 257 contiguously, with `events.length === 256`, total cursor 257, and acknowledged cursor preserved at 1.
- Live resume from cursor 0 returns `retention_gap`; resume from cursor 1 replays the retained contiguous range 2 through 257.

## Concerns

None blocking. Full Playwright execution is resource-sensitive under four workers, but the final fresh full run passed. Existing untracked `.superpowers/brainstorm/` content was not modified or staged.
