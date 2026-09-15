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

