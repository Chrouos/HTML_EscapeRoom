# Task 2 report — explorable evidence notes

## Delivered

- Added a server-owned `NOTES` folder and projected discovered side evidence as actor-safe `evidence.<id>` note entries beneath it.
- Evidence notes carry only the discovered title/summary; hidden evidence and private role records remain absent from the other actor projection.
- `open_entry` accepts discovered evidence notes and records the open state per actor. `SCAN` can read an already discovered note.
- Terminal entries now render as contextual, openable notes with safe content and an `open_entry` callback.
- Workstation live/poll renders preserve the currently open file or note while that entry remains in the incoming projection.
- Removed the old visible evidence report and demoted the legacy side-investigation panel to a hidden compatibility shell.
- Added current side investigations as `Files/NOTES/*.case` entries. Opening a case sends the existing `puzzleId + stepId=inspect` action; once opened, its current step can be answered from the note pane.
- Terminal contextual notes now omit locked/future records and lifecycle/transport shortcut IDs; server-side command locking remains authoritative.
- Moved the safe startup text into a low-key `STARTUP NOTE // README` inside Files.

## Verification

- `node --test test/unit/terminalEngine.test.js test/unit/safeState.test.js` — 31/31 passed.
- `npm test` — 129 unit + 34 integration passed.
- `npm run validate:content` — Narrative content valid.
- `npx playwright test test/e2e/workstationExploration.spec.js --grep "opened note|terminal entries as|discovered evidence" --workers=1 --trace=off` — 3/3 passed.
- `git diff --check` — clean.
- Focused side-investigation/startup/shortcut E2E — 7/7 passed; full workstation exploration E2E — 19/19 passed.

## Compatibility tradeoff

The former bottom evidence report is removed from the visible flow. The legacy `[data-sides]` container is no longer mounted, and the side-investigation panel is hidden so discovered records are encountered through Files/NOTES first. Existing side-puzzle APIs and server rules remain unchanged; chapter-gated `.case` notes now provide the inspect and current-step submission path without restoring the dashboard-like panel.

## Astra final review

- `PASS` on commit `73a21cb`; fresh A/B blind play passed live note persistence, Files/NOTES investigation launch and submission, hidden legacy panels, locked/future Terminal isolation, lifecycle shortcut filtering, startup note visibility, A/B privacy, and mobile/scroll behavior.
- P2 follow-ups only: human-readable note labels and a stricter desktop overflow contract.
