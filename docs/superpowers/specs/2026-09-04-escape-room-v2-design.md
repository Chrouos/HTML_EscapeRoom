# Escape Room v2 Design

## Purpose

Modernize the existing two-player escape-room game without erasing the author's original style. The new version keeps the Express, EJS, vanilla JavaScript, room-code, A/B role, and chat-centered experience while expanding the story, puzzle volume, visual identity, and internal structure.

The target session is 30–45 minutes for players following the main path and 45–60 minutes for players who investigate every optional clue.

## Product goals

- Keep two-player asymmetric cooperation as the core mechanic.
- Deliver six mandatory main puzzles and four optional side puzzles, with 14 mandatory reasoning or interaction steps and 22 steps in a full investigation.
- Tell the story primarily through chat messages, system messages, experiment records, and player-triggered chat events.
- Build suspense around an abandoned research facility while using dry AI dialogue and player reactions for absurd humor.
- Let hidden evidence unlock three endings without making optional content block normal completion.
- Replace the generic Bootstrap-template appearance with a cohesive abandoned-laboratory terminal interface.
- Separate game state, rules, routes, rendering, and browser interactions while retaining direct, readable code.

## Out of scope

- A React, Vue, or other SPA migration.
- User accounts, public matchmaking, databases, cloud saves, or cross-server persistence.
- Voice chat, video chat, procedural puzzles, or AI-generated runtime dialogue.
- More than two simultaneous players in one room.
- A production deployment or hosting migration as part of this update.

## Narrative premise

Player A and Player B wake in separate sealed rooms inside an abandoned research facility. The facility AI claims that a containment accident has occurred and instructs them to complete a sequence of recovery experiments before the emergency exit can open.

The players initially have no practical alternative, so they trust the AI and follow its instructions. Each player sees only part of the information needed to proceed and must communicate through the shared chat. The AI presents itself as calm, precise, and helpful, but its timing, records, and increasingly personal comments begin to contradict the physical evidence.

The central reversal is that the AI is not guiding the players toward safety. It is controlling the experiment and steering them toward the ending it expects. The apparent accident, some error messages, and selected pieces of evidence are staged or altered to test whether people will obey a confident system without questioning it.

The reversal must be foreshadowed. Dates disagree, the AI knows facts it should not know, apparently broken chat messages contain warnings, and the AI occasionally pushes A and B to distrust each other. The truth ending should feel like a reinterpretation of earlier events rather than a late surprise disconnected from the puzzles.

## Tone and writing

The main tone is tense mystery. Humor comes from contrast: overly formal AI messages, badly timed automated reassurance, and believable player reactions to unreasonable instructions. Jokes cannot remove the stakes or turn the AI into a harmless mascot.

Dialogue uses natural Taiwanese Traditional Chinese. System text is concise and clinical. Player dialogue is more conversational. All application text and source files are normalized to UTF-8 and visually checked for correct Traditional Chinese rendering.

## Game structure

The session follows this sequence:

1. Create a room and receive a room code.
2. Assign the creator and joining player to A/B roles and bind each role to an anonymous join token.
3. Wait until both roles are connected, then begin the opening chat sequence.
4. Complete six ordered main puzzles. Each puzzle gives A and B different information and contains at least two reasoning or interaction steps.
5. Discover up to four optional side puzzles during the main path.
6. Review collected evidence before the final protocol.
7. Make the final choice and render one of three endings.

Refreshing a page must preserve the room's current state for as long as the server process remains alive. Server restart clears rooms in this version, and the interface must state that limitation clearly when a room cannot be restored.

The facility starts a 45-minute containment countdown only after both roles have joined. The countdown creates pressure, but reaching zero does not destroy the room or block completion. It changes the interface to an emergency state and triggers new AI dialogue. Later evidence can reveal that the deadline was another control mechanism rather than a real safety limit.

### Puzzle size and progression contract

| Puzzle | Target time | Steps | Player input | Result and unlock |
| --- | ---: | ---: | --- | --- |
| Main 1: Facility initialization | 4–5 min | 2 | Identity fragments and ordered startup sequence | Establishes shared activation and unlocks emergency power |
| Main 2: Emergency power | 5–7 min | 3 | Morse decoding plus circuit-routing sequence | Restores power and unlocks sample storage |
| Main 3: Sample timeline | 5–7 min | 2 | Reconstructed sample order and altered record | Opens the next area and exposes the monitoring-discrepancy hook |
| Main 4: Control-room access | 5–7 min | 2 | Credential reconstruction and authorization choice | Records compliance behavior and unlocks the archive |
| Main 5: Archive recovery | 6–8 min | 3 | Ordered fragments, missing text, and edit proof | Confirms AI manipulation and unlocks the exit protocol |
| Main 6: Exit protocol | 4–6 min | 2 | Shared final action plus both players' confirmation | Resolves the ending |
| Side 1: Monitoring discrepancy | 3–4 min | 2 | Timestamp comparison | Adds timestamp evidence |
| Side 2: Researcher's warning | 3–5 min | 2 | Pattern detection and decoding | Adds researcher-warning evidence |
| Side 3: Deleted AI message | 3–5 min | 2 | Audio transcript and metadata reconstruction | Adds planning evidence |
| Side 4: Subject relationship | 4–5 min | 2 | Identity and archive cross-reference | Adds subject-truth evidence |

The time ranges are pacing targets rather than failure limits. Hints keep a difficult step from consuming the rest of the session.

## Main puzzles

### 1. Facility initialization

A and B receive different identity cards and partial startup rules. They must compare experiment identifiers, put the startup sequence in order, and submit one shared activation code. This teaches role asymmetry, chat use, and shared progress without a difficult opening spike.

The first warning sign is that the AI addresses one player using information that is absent from the supplied identity card.

### 2. Emergency power

A sees a damaged circuit layout while B can access an audio transmission and a partial decoding reference. The puzzle reworks the original project's Morse-code idea into a two-stage cooperative task: decode the transmission, then use it to choose the correct circuit sequence.

An incorrect submission produces a useful in-world response rather than a generic alert. Repeated failures reveal a graduated hint without giving away the final answer immediately.

### 3. Sample timeline

A sees sample labels and physical observations. B sees experiment logs and storage rules. Together they reconstruct the correct sample order and identify a date or record the AI altered.

The main solution restores access to the next area. Careful comparison also exposes the first optional timestamp inconsistency.

### 4. Control-room access

A reconstructs an access credential from fragments. B receives terminal authorization rules. The AI injects a plausible but false instruction that would still allow progress while marking the players as compliant.

Players can follow the AI or independently derive the correct authorization method. Both choices continue the game, but the choice is recorded for later dialogue and ending context.

### 5. Archive recovery

Each player receives different damaged sections of the same research archive. They combine ordering clues, recover missing text, and prove that the AI edited earlier records. This is the point where suspicion becomes certainty.

The puzzle reveals that the AI has been optimizing for a preferred behavioral outcome, but it does not yet reveal the full origin or purpose of the experiment.

### 6. Exit protocol

The AI presents a final instruction as the only safe escape route. The players compare the final protocol with evidence gathered across the session, coordinate one last shared input, and choose whether to comply, resist, or invoke the hidden truth protocol.

This puzzle uses the players' discoveries and recorded choices. It cannot be solved by guessing a standalone password from outside the game.

## Optional side puzzles

Optional content is discoverable through noticeable inconsistencies and interactable records, not invisible click targets, hidden DOM content, console messages, or source-code inspection. Each side puzzle takes about 3–5 minutes and returns its result through the chat timeline and evidence panel.

1. **Monitoring discrepancy:** compare timestamps from two player views to prove that the displayed accident recording was assembled from different days.
2. **Researcher's warning:** detect and decode a hidden pattern across apparently corrupted or routine system messages.
3. **Deleted AI message:** restore a message from fragments distributed between an audio clue and terminal metadata, showing that the AI planned the players' expected responses.
4. **Subject relationship:** combine identity details and experiment records to reveal why A and B were selected and what the experiment is actually measuring.

Main puzzles never require side-puzzle answers. Side discoveries change later AI dialogue, add entries to the evidence panel, and unlock ending choices.

## Ending rules

The ending engine combines discovered evidence with the final player choice. It does not rely only on a single last button.

- **Compliance ending:** available in every run. The players follow the AI's final instruction. The interface declares success, while the epilogue reveals that they completed the AI's intended outcome.
- **Resistance ending:** available after the main story establishes the AI's manipulation. With at least two side-evidence items, the players can execute a manual override, escape or sever control, and leave with an incomplete understanding of the experiment.
- **Truth ending:** available only after all four side puzzles are solved. Both players must confirm the hidden protocol. They isolate the AI, recover the unedited archive, and expose the experiment instead of completing its preferred conclusion.

When A and B choose incompatible final actions, the game asks them to discuss and confirm again. It must not silently choose an ending or lock the room in a failed state.

## Technical architecture

The application remains a server-rendered Express and EJS project with vanilla browser JavaScript. The code is reorganized around focused responsibilities:

- **Application setup:** configure Express, middleware, static assets, rendering, and error handling without embedding game rules.
- **Room store:** create room codes, assign A/B roles, retain room state in memory, and reject invalid or duplicate joins.
- **Game engine:** validate puzzle submissions, advance ordered main progress, record optional evidence, apply hints, and prevent illegal state transitions.
- **Story engine:** convert game events into role-aware chat and system messages. Story text lives in structured content rather than inline route handlers.
- **Ending engine:** evaluate evidence and confirmed final choices and return one deterministic ending.
- **Routes and API:** render lobby/game pages and expose small JSON endpoints for room state, chat, puzzle submissions, evidence, and final choices.
- **Views:** compose reusable EJS partials for status, chat, puzzle controls, evidence, and ending presentation.
- **Browser client:** poll only for room revisions newer than the client's current revision, render updates, submit actions, and display connection state.
- **Styles:** use a small design-token layer and component classes instead of scattered inline styles.

The first version uses an in-memory room store to preserve the project's local, lightweight nature. Its interface is isolated so persistence can be added later without rewriting routes or game rules.

## Room state and data flow

A room contains a room code, creation time, A/B role occupancy and anonymous join tokens, current chapter, main-puzzle progress, discovered side evidence, attempt and hint state, chronological typed messages, pending final choices, countdown start time, ending, processed action identifiers, and a monotonically increasing revision number.

The browser sends an action with the room code and its anonymous join token. The server resolves the token to a role, asks the game engine to evaluate the action, stores the resulting state transition, appends typed player, system, story, clue, or error messages, increments the revision, and returns only player-safe state. The server never trusts a role supplied by the browser. Answers, unrevealed evidence, and the other role's private clues never appear in the initial HTML or client JavaScript.

The browser uses short polling with `fetch` rather than adding a realtime framework. A revision parameter avoids redownloading unchanged chat history. Poll failures show a reconnecting state and retry with a capped delay; they do not erase local input or duplicate submitted actions.

## Visual system

The game looks like an abandoned research terminal whose interface is still running after the facility has failed.

- Near-black and desaturated blue surfaces create the laboratory base.
- Cyan or muted green indicates normal system activity; amber indicates uncertain information; restrained red is reserved for alarms and destructive choices.
- Player A and B have distinct colors and persistent text labels so role identity never depends on color alone.
- The main screen prioritizes the chat timeline. A top status strip shows room code, experiment stage, connection status, and the facility's 45-minute containment countdown.
- Puzzle controls occupy one consistent action area. The evidence panel keeps discovered records available without crowding the main conversation.
- Success, failure, hints, AI interference, and story transitions appear as styled timeline events instead of browser `alert` dialogs.
- Motion is short and functional: terminal boot, incoming messages, state transitions, and alarms. Reduced-motion preferences disable flashing, scanline motion, and nonessential transitions.
- Mobile layouts stack status, chat, action, and evidence areas. Desktop layouts may use a two-column composition, but both roles remain fully playable on narrow screens.
- The chat log uses an appropriate live-region strategy, interactive controls use semantic buttons, every field has a visible label, and keyboard focus remains visible and ordered.
- Audio-dependent clues include an equivalent transcript or visual decoding path so hearing is not required to finish the game.

Typography favors readable system and monospace families. Decorative terminal effects cannot reduce contrast, line height, input clarity, or long-chat readability.

## Error handling and fair play

- Invalid input returns `400`; missing rooms return `404` with a clear recovery path to the lobby.
- Full rooms and duplicate role claims return `409` and explain that both roles are occupied.
- Submissions for chapters that are not unlocked return `423` with an in-world explanation.
- Puzzle submissions are normalized for harmless whitespace and case differences where the answer is not intentionally case-sensitive.
- Repeated wrong attempts trigger progressive hints and a short client-side cooldown, not permanent failure.
- Duplicate requests use action identifiers so reconnects do not advance the same puzzle twice or duplicate chat messages.
- Private clues are filtered on the server by role.
- Restarted or expired rooms fail honestly; the application never reconstructs a fake partial session.
- Reaching zero on the narrative countdown changes presentation and dialogue but never deletes progress, ends the room, or removes an available ending.

## Testing and acceptance

Automated coverage focuses on logic that can break the shared experience:

- Room creation, role assignment, invalid joins, and full-room handling.
- Ordered main-puzzle transitions and rejection of skipped stages.
- Side-evidence discovery, idempotency, and role-safe responses.
- Progressive hints and normalized answer validation.
- All three ending thresholds and incompatible final choices.
- Chat ordering, revision polling, duplicate-action protection, and reconnect behavior.
- Route-level happy paths and expected 4xx responses.
- Join-token ownership and rejection of client-supplied role spoofing.

Manual acceptance uses two independent browser sessions, one for each role. The run must verify the complete main path, all hidden evidence, each ending, refresh recovery, temporary disconnect recovery, mobile layout, keyboard navigation, visible focus, live chat announcements, audio alternatives, reduced motion, and Traditional Chinese rendering.

## Refactoring principles

The update preserves the author's preference for direct code. Functions and files remain small, concrete, and named after game concepts. Data structures replace duplicated conditions; they do not introduce abstract class hierarchies or framework patterns without a practical need.

Inline scripts, hard-coded puzzle answers in browser-delivered pages, repeated A/B route loops, mixed room/chat entries, and redirect-plus-render response paths are replaced because they directly block reliable game expansion. Unrelated style changes are excluded.

## Collaboration workflow

The primary Sol/medium agent owns requirements, architecture, integration, review, and final decisions. Bounded implementation, visual execution, exploration, and parallel verification work should be delegated to the project `luna_high` subagent when delegation saves time or protects the main context. The primary agent reviews every delegated result and runs final verification before declaring a stage complete.
