# Task 2 Fix Report

## Review Items Resolved

1. Player messages now require an object `payload` with role exactly `A` or `B`. The intercom renderer throws `TypeError: Invalid player message` instead of defaulting malformed input to A. The shared live state validator applies the same rule to REST snapshots, adopted responses, and WebSocket event states.
2. The visible `role="log"` now explicitly uses `aria-live="off"`. A single hidden `role="status"` remains the only polite live region. Initial history hydration is silent; subsequent unseen IDs supplied through `render` and messages supplied through `append` are queued into one throttled announcement.

## RED Evidence

Renderer and announcement tests:

`npx playwright test test/e2e/intercom.spec.js test/e2e/liveReconnect.spec.js -g "rejects player|hydrates history|canonical messages"`

- Malformed player renderer test failed because the message was accepted.
- Initial hydration test failed because historical messages populated the announcer.
- The first version of the live test did not isolate malformed player data from existing invalid-type data, so it passed. The test was corrected to send malformed player state independently.

Independent live production-path RED:

`npx playwright test test/e2e/liveReconnect.spec.js -g "canonical messages"`

- Failed with zero snapshot resyncs where one was required after a player message without `payload`.

## GREEN Evidence

Focused new behavior:

`npx playwright test test/e2e/intercom.spec.js test/e2e/liveReconnect.spec.js -g "rejects player|hydrates history|canonical messages"`

- 3 passed.

Relevant full files:

`npx playwright test test/e2e/intercom.spec.js test/e2e/liveReconnect.spec.js`

- 12 passed and one pre-existing reconnect timing assertion missed a brief `SIGNAL LOST` state.
- Its immediate focused rerun passed 1/1.

Final fresh verification:

`npm run check`

- Unit: 62 passed.
- Integration: 30 passed.
- E2E: 20 passed.

## Notes

- Canonical AI entries may still omit `type`; they render as ORPHEUS.
- No audience or delivery metadata is introduced into the DOM.
