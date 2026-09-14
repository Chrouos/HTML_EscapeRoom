# Task 1 fix round report

Addressed review findings in the narrative content validator:

- Verification links now require an existing target, a matching declared/actual `sourceGroup`, an independent source, and a reachable unlock graph.
- IDs and references are checked across debrief facts, entries, dialogue, missions, operation effects, and mission source entries.
- Fallbacks must be existing reachable `mainline` operations; unknown content and graph nodes are rejected.
- Mainline operations cannot depend on private role facts or private-required entry/content unlocks.
- The nine deception groups (`A-1`, `B-1`, `D-1`, `A-2`, `B-2`, `D-2`, `A-3`, `B-3`, `L-1`) are explicit manifest metadata and required by validation.
- Predicate validation is fail-closed for empty, mixed, multi-leaf, and multi-combinator objects.
- Delivery labels are rejected from every visible dialogue, terminal, and debrief copy field.

Verification:

- `node --test test/unit/contentValidation.test.js` — 11 passed.
- `npm run test:unit` — 73 passed.
- `npm run validate:content` — valid.
- `git diff --check` — clean.
