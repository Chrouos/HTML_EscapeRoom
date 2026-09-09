# Branching Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic public announcements, private rapport/manipulation dialogue, six optional private missions, cross-verifiable conflicting documents, and automatic endings derived from accumulated actions.

**Architecture:** Narrative data lives in declarative manifests. Engines validate unlock predicates, select deterministic fixed copy, update public/role facts, and emit audience-scoped events. A graph validator proves every deception is verifiable and every mainline route remains reachable without private compliance. Finale commits are neutral and the server evaluates one immutable ending after both players commit.

**Tech Stack:** CommonJS data modules, Node test runner, existing Express action API, existing actor projections/live stream, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-restricted-dual-console-design.md`

## Global Constraints

- No LLM API. Dialogue is selected from reviewed fixed line pools.
- `broadcast` and `direct` are internal scheduling fields. Visible copy always comes from `ORPHEUS` with no public/private badge.
- Before `main1Completed`, emit at least three shared ORPHEUS announcements and zero direct events.
- A player's first private mission requires `rapportCount >= 2`. A `private_task` or `manipulation` requires `rapportSincePressure >= 1`, and pressure intents cannot be consecutive.
- Manipulation may reference an anomaly only after that player opened the corresponding anomaly entry.
- A/B private missions are unlocked by different operations, never by a paired timer or fixed offset.
- Every private mission has a mainline fallback; ignoring, declining, failing, or skipping it cannot block `finale_ready`.
- Out of scope: generated dialogue, voice synthesis, 3D scenes, and admin authoring tools.

---

## Task 1: Define and validate declarative content contracts

**Files:**

- Create: `game/content/contentSchema.js`
- Create: `game/content/operations.js`
- Create: `game/content/terminalEntries.js`
- Create: `game/content/dialogue.js`
- Create: `game/content/privateMissions.js`
- Create: `game/content/debrief.js`
- Create: `game/content/validateContent.js`
- Create: `scripts/validate-content.js`
- Create: `test/unit/contentValidation.test.js`
- Modify: `package.json`

- [ ] Write failing tests for duplicate IDs, invalid audience/intent combinations, missing verification entries, same-source verification, private-fact dependencies on mainline operations, unreachable fallbacks, missing outcome facts, and visible copy containing delivery labels.
- [ ] Add fixtures proving every deception has at least one reachable verification entry from a different `sourceGroup`.
- [ ] Run `node --test test/unit/contentValidation.test.js` and confirm red.
- [ ] Define content records with exact keys from the spec: `id`, `sourceEntryId`, `sourceGroup`, `audience`, `unlockWhen`, `verificationEntries`, `requiresPrivateFacts`, `mainlineFallbackOperationIds`, and `debriefFactIds`.
- [ ] Define operation records with `operationId`, `kind`, `unlockWhen`, and `effects.{publicFacts,roleFacts,unlockEntryIds,completeNodeIds,appendContentIds}`. Keep REST `actionId` out of manifests.
- [ ] Define the `commit_finale` `neutral_finale` manifest now, including the reachable nodes `finale_ready`, `finaleCommitted.A`, `finaleCommitted.B`, and `endingCommitted`; Task 6 adds its runtime transaction and ending evaluation.
- [ ] Implement `all`/`any`/`not` predicates over `chapterAtLeast`, `publicFact`, `roleFact`, `entryOpened`, and `actionAttempted`.
- [ ] Add `npm run validate:content` and make `npm run check` execute it before tests.
- [ ] Run content validation and commit with `feat: validate narrative content graph`.

## Task 2: Implement role-specific workstation entries and cross-verification

**Files:**

- Modify: `game/content/terminalEntries.js`
- Create: `game/terminalEngine.js`
- Create: `test/unit/terminalEngine.test.js`
- Modify: `game/createRoomState.js`
- Modify: `game/safeState.js`

- [ ] Add failing tests for the nine deception records and their verification groups: A-1, B-1, D-1, A-2, B-2, D-2, A-3, B-3, and L-1 as enumerated in the spec.
- [ ] Test that A and B may receive conflicting `doc.a_incident_report`/`doc.b_incident_report` and `doc.a_solo_protocol`/`doc.b_solo_protocol`, while shared raw evidence can later expose each contradiction.
- [ ] Test that locked IDs and filenames are absent, not merely disabled, from the wrong projection.
- [ ] Run `node --test test/unit/terminalEngine.test.js` and confirm red.
- [ ] Add per-role `workstation` state: unlocked entry IDs, opened entry IDs, active operations, and role facts. Implement `openEntry(draft, player, entryId)` and `executeOperation(draft, player, operationId)`.
- [ ] Add exact verification links from the spec, including `audio.original_incident_timestamp`, `log.mirror_backup`, `log.token_reissue`, `doc.protocol_signature_template`, and `log.audit_checksum`.
- [ ] Make `verify_incident_timestamp` a main2 workstation operation unlocked after both incident reports can be compared; it records the attempt independently of whether A-2 is accepted.
- [ ] Project only actor-visible Files, Terminal, and Logs records.
- [ ] Run the terminal engine tests and commit with `feat: add cross-verifiable workstation records`.

## Task 3: Schedule public rapport and private pressure without revealing channels

**Files:**

- Modify: `game/content/dialogue.js`
- Create: `game/privateEventEngine.js`
- Create: `test/unit/privateEventEngine.test.js`
- Modify: `game/storyEngine.js`
- Modify: `game/createRoomState.js`

- [ ] Add failing sequence tests for: three or more public announcements before main1 completion; no direct event before main1 completion; two rapport lines before each player's first private task; one rapport line between pressure events; and anomaly-gated manipulation.
- [ ] Add deterministic selection tests using UTF-8 SHA-256 seeds `${roomCode}:broadcast:${contentId}` and `${roomCode}:${playerId}:${contentId}`. Broadcast resolution must occur once before cloning to both streams.
- [ ] Test that A/B triggers can happen in either order and that triggering A produces no B event, cursor change, placeholder, or scheduler timestamp.
- [ ] Run `node --test test/unit/privateEventEngine.test.js` and confirm red.
- [ ] Add `directDialogueState` per role with `rapportCount`, `rapportSincePressure`, `lastIntent`, and delivered content IDs.
- [ ] Implement eligible-pool filtering and deterministic selection for `system`, `common_task`, `rapport`, `observation`, `manipulation`, and `private_task` intents.
- [ ] Preserve public ORPHEUS announcements throughout all acts; use direct delivery for rapport, observation, manipulation, and private tasks only.
- [ ] Emit the same display shape for every ORPHEUS line and keep channel/audience exclusively inside dispatcher input.
- [ ] Run the private event tests and commit with `feat: pace deterministic ORPHEUS dialogue`.

## Task 4: Implement six optional private mission lifecycles

**Files:**

- Modify: `game/content/privateMissions.js`
- Modify: `game/content/operations.js`
- Modify: `game/privateEventEngine.js`
- Create: `test/unit/privateMissions.test.js`
- Modify: `game/gameEngine.js`
- Modify: `routes/apiRoutes.js`

- [ ] Add failing tests for `locked -> available -> resolved` and outcomes `completed`, `declined`, `skipped`, and `failed`. Assert resolved missions cannot be resubmitted and all paths are idempotent by `actionId`.
- [ ] Encode A-1 operations `archive_index`, `decline_index_repair`, `skip_a1` with fallback `continue_file_index`; B-1 operations `flag_identity`, `share_roster`, `decline_identity_check`, `skip_b1` with fallback `continue_roster_review`.
- [ ] Encode A-2 operations `delete_local_mirror`, `share_mirror_first`, `decline_mirror_cleanup`, `skip_a2` with fallback `restore_mirror_from_backup`; B-2 operations `pause_local_mirror`, `keep_local_mirror`, `warn_partner_first`, `skip_b2` with fallback `fetch_mirror_manually`.
- [ ] Encode A-3 operations `request_solo_validation`, `publish_fragment`, `request_pair_validation`, `skip_a3` with fallback `pair_validate_protocol`; B-3 operations `file_full_report`, `file_anonymous_summary`, `disclose_report`, `skip_b3` with fallback `continue_without_report`.
- [ ] Encode and test the six distinct first-operation triggers: A-1 opens the mainline Files directory; B-1 opens the experiment roster; A-2 first attempts `verify_incident_timestamp` regardless of correctness; B-2 first opens the access log; A-3 opens the main5 evacuation protocol; B-3 opens the main5 monitoring summary.
- [ ] For each mission, assert its trigger produces no paired event for the other role and uses no wall-clock delay or fixed A/B offset.
- [ ] Assert B-2 modifies only B's local automatic mirror and never A's document, progress, or access.
- [ ] Assert A-3/B-3 become available before `finale_ready`, but unresolved missions are atomically marked skipped when that player commits the finale.
- [ ] Submit semantic operations through `{ actionId, operationId, value? }`; retain the legacy puzzle action path only until all mainline operations are migrated.
- [ ] Run `node --test test/unit/privateMissions.test.js` and commit with `feat: add six nonblocking private missions`.

## Task 5: Prove mainline reachability and migrate shared progression

**Files:**

- Modify: `game/content/operations.js`
- Modify: `game/content/validateContent.js`
- Modify: `game/gameEngine.js`
- Modify: `test/unit/fullGame.test.js`
- Modify: `test/integration/mainPuzzleOne.test.js`

- [ ] Add traversal tests starting from `roomCreated`, `hostJoined`, and `guestJoined`. Explore every operation outcome and prove at least one route reaches `finale_ready` when all six private missions are declined, skipped, or failed.
- [ ] Remove every `kind: 'private'` edge from a graph fixture and prove the remaining graph still reaches `finale_ready`, both role-specific finale commits, and `endingCommitted`.
- [ ] For each of the six missions, remove all of that mission's outcome edges in turn and prove the shared mainline and finale remain reachable.
- [ ] Add tests proving no `kind: 'mainline'` operation depends on role-private facts and no fallback operation has a private prerequisite.
- [ ] Run the full-game and content-validation tests and confirm red.
- [ ] Represent main1–main6 progress as public facts/complete node IDs while preserving existing answers and side-evidence behavior.
- [ ] Make operation effects the single source of progress mutations; eliminate hidden side effects outside manifests.
- [ ] Ensure private outcomes can alter later content and endings but never a shared unlock predicate.
- [ ] Run `node --test test/unit/fullGame.test.js test/unit/contentValidation.test.js test/integration/mainPuzzleOne.test.js` and commit with `refactor: drive mainline from reachable operations`.

## Task 6: Replace the explicit final choice with neutral automatic resolution

**Files:**

- Modify: `game/endingEngine.js`
- Modify: `game/content/endings.js`
- Modify: `game/content/debrief.js`
- Modify: `game/gameEngine.js`
- Modify: `test/unit/endingEngine.test.js`
- Modify: `test/e2e/fullEndings.spec.js`

- [ ] Replace COMPLY/RESIST/TRUTH tests with per-player idempotent `commit_finale` tests. The first commit must not choose an ending; the second commit evaluates exactly once and freezes the result.
- [ ] Add reachable fixtures for all five ordered outcomes: exposed AI deception, A solo escape, B solo escape, cooperative escape, and ambiguous containment.
- [ ] Require each fixture to produce at least three debrief items. Every item must cite a recorded fact and map through the debrief catalog to `surfaceClaim`, `actualEffect`, and verification entry IDs.
- [ ] Add omission tests: ignoring a private mission must appear as an explicit recorded omission fact when it influences the ending.
- [ ] Run `node --test test/unit/endingEngine.test.js` and confirm red.
- [ ] Implement `commit_finale` as a `neutral_finale` operation that marks the authenticated role, atomically skips that role's unresolved available missions, and evaluates only when `mainCompleted && finaleCommitted.A && finaleCommitted.B`.
- [ ] Apply the ending precedence and mutual-exclusion rules from the spec; store the final ending and debrief immutably.
- [ ] Render debrief explanations only after ending commit, never during play.
- [ ] Run the unit and full-endings e2e tests and commit with `feat: derive endings from accumulated decisions`.

## Task 7: Verify secrecy, pacing, fairness, and causality end to end

**Files:**

- Create: `test/e2e/privateNarrative.spec.js`
- Modify: `test/e2e/roomFlow.spec.js`
- Modify: `test/e2e/fullEndings.spec.js`

- [ ] Run two browser contexts through an A-first private path and a B-first private path. Verify triggers are operation-based, independently ordered, and invisible to the other player.
- [ ] Run a no-private-compliance path to the finale and confirm shared progression never stalls.
- [ ] For each deception, run a dedicated verification scenario proving the contradictory claim can be exposed. In ending scenarios, include only the 3–5 facts that actually affected that ending's debrief.
- [ ] Inspect both DOMs and all REST/WebSocket payloads for forbidden delivery labels and foreign private content.
- [ ] Run `npx playwright test test/e2e/privateNarrative.spec.js test/e2e/roomFlow.spec.js test/e2e/fullEndings.spec.js`.
- [ ] Run `npm run check` and commit with `test: verify private narrative outcomes end to end`.

## Completion Checks

- [ ] `npm run validate:content` proves all deception records are cross-verifiable and all private missions have reachable fallbacks.
- [ ] A complete run with every private task ignored reaches an ending.
- [ ] Every ending debrief explains at least three prior actions or omissions with discoverable evidence links.
- [ ] No player can infer a private event from cursor gaps, placeholder rows, labels, synchronized timing, or the other player's projection.
- [ ] Search `rg -n "AI_BROADCAST|AI_DIRECT|公開頻道|私人頻道" views public` and confirm zero player-visible matches; review server/test matches separately because internal fields and negative assertions are allowed.
- [ ] Run `npm run check`.
