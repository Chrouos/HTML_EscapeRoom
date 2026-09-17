# Task 5 Report: REST commands and chat use actor-local cursors

## Result

- `GET /api/rooms/:roomCode/state` now validates `sinceCursor` as a non-negative safe integer, sends `Cache-Control: no-store`, and returns `stateResponse()`.
- Action, initial story, emergency, and chat changes now commit through `roomStore.transact()` with the authenticated `playerId` and one transaction-local event collection.
- Action IDs are scoped to the authenticated player. Duplicate actions retain the existing successful no-change response while returning only that actor's projected state and cursor.
- Public story and chat events use the strict `{ kind: 'both' }` audience. Missing or legacy story audiences no longer default to public.
- REST responses no longer expose room revision, audience metadata, stream metadata, or another player's state.

## TDD evidence

The required six-file command was run after updating the tests and failed with 11 expected cursor/audience contract failures (13 passed, 11 failed). After the minimal implementation, the same command passed all 24 tests.

Final verification:

- Required six-file command: 24 passed, 0 failed.
- `npm test`: 81 passed, 0 failed (60 unit, 21 integration).
- `git diff --check`: passed; only Git's existing LF/CRLF checkout warnings were printed.

## Coverage added or migrated

- Invalid negative and decimal cursor handling, with safe-integer validation in the parser.
- No-cache state polling and no client-facing revision.
- Hidden-only mutation leaving the other actor cursor unchanged.
- Public action advancing both actor cursors.
- Duplicate action behavior and player-scoped identical action IDs.
- Player chat delivered to both actors without trusting a submitted role.
- Strict story event audiences and idempotent event collection.

## Concerns

- This task intentionally does not migrate the browser UI polling/rendering contract; REST now returns canonical `intercom`/`workstation` fields from `stateResponse()` as required by the brief.

## Fix round 1

Addressed both Important review findings with regression-first changes:

- Ending choice event identity now includes the server-authenticated role (`choice-A-...` / `choice-B-...`), so actors may legally reuse the same client action ID without story event deduplication dropping the second ending event.
- Action transactions now accept a post-updater `shouldRecordAction` decision. REST actions record the player-scoped action key only when `submitAction().stateChanged` is true, so a completed-step semantic no-op does not consume an ID that is later used for a valid step.

RED command:

`node --test test/unit/gameEngine.test.js test/unit/fullGame.test.js test/integration/mainPuzzleOne.test.js`

Result: 16 passed, 2 failed. The failures were exactly the missing second same-ID ending event (`1 !== 2`) and the no-op ID being marked processed (`true !== false`).

Focused GREEN command:

`node --test test/unit/gameEngine.test.js test/unit/fullGame.test.js test/unit/roomStore.test.js test/integration/mainPuzzleOne.test.js test/integration/chatAndPolling.test.js`

Result: 41 passed, 0 failed.

Full verification command:

`npm test`

Result: 83 passed, 0 failed (61 unit, 22 integration).
