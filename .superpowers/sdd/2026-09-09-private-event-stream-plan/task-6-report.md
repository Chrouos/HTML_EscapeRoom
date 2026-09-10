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
