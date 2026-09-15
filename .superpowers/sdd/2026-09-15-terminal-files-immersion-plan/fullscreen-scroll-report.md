# Fullscreen monitor and scroll preservation report

## Implemented

- Added a `game-room-shell` layout wrapper for active rooms so desktop monitors use the available viewport width with a 24px gutter on each side.
- Let the active game shell and monitor selector flex into the remaining viewport height while retaining the existing internal monitor scroll regions.
- Preserved mobile behavior: the existing one-pane monitor tabs and mobile gutters remain unchanged.
- Replaced the single pending scroll offset with keyed scroll positions for each workstation app/folder/open-file view, restoring the offset after live projection renders.
- Kept the active workstation focus key and restoration behavior intact while rerendering.

## Verification

- `node --check public/js/workstation.js` passed.
- `node --check public/js/game.js` passed.
- `git diff --check` passed (line-ending warnings only).
- Added a focused Playwright assertion covering desktop width and scroll retention; the full workstation run was stopped at supervisor request to avoid a long fixture cycle.

## Reviewer fix

- Changed `.monitor-screen` to a clipping viewport so it cannot become a competing scroll container.
- Extended the focused E2E coverage to assert zero outer monitor overflow while the inner workstation list remains scrollable.

`npx playwright test test/e2e/workstationExploration.spec.js -g "fills the desktop" --workers=1 --trace=off --reporter=line` was started but stopped after the fixture exceeded the supervisor's short-run window. Node syntax checks and `git diff --check` pass.

## Scroll-chain fix

- Constrained the desktop monitor selector and operations workspace through a finite flex chain (`height: 0` + flex growth, `min-height: 0`, and hidden outer overflow).
- Made the workstation panel a shrinkable flex column with a definite workstation UI height, allowing `[data-workstation-scroll]` to retain a real scroll range.
- Kept mobile overrides in the one-pane tab layout; the focused desktop test passed after the fix.
