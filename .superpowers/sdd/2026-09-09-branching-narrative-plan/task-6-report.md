# Task 6 report — neutral automatic finale

## Delivered

- Replaced explicit `COMPLY` / `RESIST` / `TRUTH` resolution with authenticated per-player `commit_finale` operations.
- The first commit records only that player and skips that player’s unresolved available missions. The second commit evaluates once and freezes the ending and debrief.
- Added five ordered, mutually exclusive outcomes: exposed AI deception, A solo escape, B solo escape, cooperative escape, and ambiguous containment.
- Added debrief catalog entries with recorded fact, surface claim, actual effect, and verification entry IDs. Skipped missions are surfaced as explicit omission facts when present.
- Debrief is projected only after `room.ending` exists; no ending choice is accepted through the legacy puzzle endpoint.

## Verification

- `node --test test/unit/endingEngine.test.js test/unit/contentValidation.test.js` — 22 passing.
- `node --test test/unit/fullGame.test.js` — 8 passing after migrating legacy finale assertions to neutral commits.
- `npm run validate:content` — Narrative content valid.
- `npx playwright test test/e2e/fullEndings.spec.js` was attempted, but the local Playwright web-server run exceeded 120 seconds without producing test output; no assertion result was available.

Commit: `c0f67ea feat: derive endings from accumulated decisions`
