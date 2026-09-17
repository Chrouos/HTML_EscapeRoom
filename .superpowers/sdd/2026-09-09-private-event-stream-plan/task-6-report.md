# Task 6 Report: Authenticated resumable WebSocket liveHub

## Status

Implemented and verified.

## TDD evidence

- RED: `node --test --test-name-pattern="upgrade authenticates" test/integration/liveHub.test.js`
  failed because the valid `/live` WebSocket upgrade received HTTP 404 before the hub existed.
- GREEN: `node --test test/integration/liveHub.test.js` passed 5/5 tests.
- Regression: `npm test` passed 88/88 tests (61 unit, 27 integration).

## Implementation

- Added `ws` as a production dependency.
- Added `createLiveHub({ server, roomStore, allowedOrigins })` with:
  - exact `/live?roomCode=<six digits>` upgrade URL validation;
  - exact Origin allowlist matching;
  - authentication exclusively from the existing room-scoped HttpOnly cookie;
  - server-side `resolvePlayer` role/player identity;
  - strict `resume` and bounded `ack` cursor handling;
  - ordered, contiguous actor-only replay;
  - 256-entry per-player retention and `invalid_cursor` / `retention_gap` resync frames;
  - after-commit delivery through `roomStore.subscribe()`;
  - explicit socket termination and subscription cleanup.
- Production and normal integration test servers use the same `app.attachLiveHub(...)` attachment path.
- The generic test server keeps supporting isolated Express fixtures that do not expose a live hub, while normal app teardown closes hub sockets before the HTTP server.

## Security review

- Missing/invalid cookies receive 401; mismatched/missing origins receive 403.
- Extra query parameters, including `role` and `playerId`, are rejected with 400.
- Client messages cannot choose a role/player, and acknowledgements cannot exceed either the actor stream cursor or the cursor sent on that socket.
- WebSocket event payloads contain only the authenticated actor's canonical projection and already-filtered content events; tokens, player IDs, and audience metadata are not serialized.

## Concerns

- `npm install` reports 22 vulnerabilities in the pre-existing dependency tree (4 low, 6 moderate, 10 high, 2 critical). No broad dependency upgrades were attempted because they are outside Task 6.
- Browser transport/reconnect behavior remains intentionally deferred to Task 7.

## Review round 1

- Added a dedicated `roomStore.acknowledge()` metadata commit. A valid ack now persists in the authenticated player's server-owned stream without incrementing the game cursor/revision or appending an envelope. A reconnect resumes after the greater of its supplied cursor and persisted acknowledged cursor. Future or not-yet-sent acknowledgements cannot update the stream.
- Rejected upgrade sockets are now tracked, the HTTP rejection is flushed, and the socket is explicitly destroyed. Hub shutdown also destroys any pending upgrade sockets.
- Closing an actor's final socket drops its retained buffer. Closing a room's final actor socket also unsubscribes and removes the room subscription, so a later same-code connection hydrates fresh state and installs a fresh subscription.
- TDD RED: the three new regression tests each timed out against the prior implementation at the missing persistence, missing raw-socket destruction, and missing unsubscribe conditions.
- GREEN: focused liveHub tests pass 8/8. Full `npm test` passes 91/91 (61 unit, 30 integration).
