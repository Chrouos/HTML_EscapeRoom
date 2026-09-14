# Task 4 fix round 2 report

## Fixes

- Removed the unused `investigations` map and all legacy side/evidence/audio/ending DOM construction from `public/js/game.js`; the coordinator now delegates those views to `legacyPanels`.
- Restored the legacy adapter's UTF-8 labels and diegetic copy from the pre-migration implementation (`調查答案`, `查看異常紀錄`, `核對紀錄`, `已歸檔`, evidence/audio/ending labels), preserving COMPLY/RESIST/TRUTH behavior.
- Scoped `fullEndings.spec.js` main answers and side records to the Operations monitor, while reading mismatch messages from the Intercom monitor. Side-section lookup now filters within the Operations workspace (`hasText`) instead of using an inverted descendant locator.
- Stabilized the reconnect E2E by waiting for an accepted reconnect attempt and a subsequent cursor-poll cycle after re-enabling sockets. The test does not alter production reconnect backoff and accepts only diegetic connection labels.

## Verification

- `npx playwright test test/e2e/roomFlow.spec.js` — 2 passed.
- `npx playwright test test/e2e/accessibilityAndLayout.spec.js` — 3 passed.
- `npx playwright test test/e2e/liveReconnect.spec.js -g "a lost socket"` — 1 passed.
- `npx playwright test test/e2e/fullEndings.spec.js` — 3 passed (COMPLY, RESIST, TRUTH).
- `node --check` passed for changed JavaScript files; `git diff --check` passed.
- Audience metadata search returned no forbidden UI metadata; the only `direct` match is the existing test title `direct adopt`.
