# Task 2 fix-round report

Addressed the review findings around authorization and idempotency:

- Private mission operation IDs now have explicit A/B ownership. Cross-role operations are excluded from `activeOperations` and reject with `OPERATION_LOCKED` without mutating foreign state.
- Mainline operation completion is shared on `room.completedOperations`, so another actor cannot replay an already completed mainline operation. `verify_incident_timestamp` remains intentionally repeatable so every attempt is recorded.
- Direct engine calls require an occupied room identity; object callers without a matching `playerId` fail closed.
- Malformed role audiences no longer fall back to guest/B.

Verification:

- Red before fixes: 4 new negative tests failed.
- Green after fixes: `npm test` — 86 unit and 31 integration tests passed.
- `node --test test/unit/terminalEngine.test.js test/unit/safeState.test.js test/unit/contentValidation.test.js` — 31 passed.
- `npm run validate:content` — valid.
- `git diff --check` — clean.
