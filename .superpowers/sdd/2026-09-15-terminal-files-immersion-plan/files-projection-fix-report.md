# Files projection fix report

## Scope

The workstation Files projection now carries an explicit `files.rootId` in
addition to each entry's `id`, `parentId`, `name`, `kind`, lock/open state,
archive metadata, and answer-gate metadata. This keeps the client filesystem
anchor deterministic across actor-safe state projection and future content
ordering changes. Locked/private content remains server-filtered.

## Regression coverage

- Added unit assertions for `rootId` and nested `parentId` values through both
  `projectWorkstation` and `projectForPlayer`.
- Existing actor isolation, lock metadata, archive expansion, and answer-gate
  tests remain green.
- Focused Files E2E (`workstationExploration.spec.js`, Files folder flow)
  passed.

## Verification

- `npm test` — 125 unit, 34 integration passed.
- `npm run validate:content` — passed.
- `node --check game/terminalEngine.js` — passed.
- Focused Files E2E — 1 passed.
- `git diff --check` — passed.

## Commit

`fix: preserve workstation folder topology`
