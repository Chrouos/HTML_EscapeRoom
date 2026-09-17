# Task 1 fix round 3 report

Dialogue verification now follows the same strict contract as terminal verification: target records must exist, the declared source group must match the target's actual source group, the target source must differ from the dialogue source, and the target unlock predicate must be reachable from operation-derived facts.

Verification:

- RED: new dialogue same-source and unreachable regression tests failed before the change.
- GREEN: `node --test test/unit/contentValidation.test.js` — 14 passed.
- `npm run validate:content` — valid.
- `npm run test:unit` — 76 passed.
- `git diff --check` — clean.
