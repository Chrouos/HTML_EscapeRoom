# Author Reveal Graph Viewer Design

Date: 2026-09-26
Status: Approved conversational design, awaiting written-spec review
Branch: `feat/reactive-narrative-reveal-20260924-active`

## 1. Purpose

Build a read-only authoring/debugging viewer for ORPHEUS/ECHO that helps a human understand the story flow without first understanding implementation details.

The viewer should answer four questions clearly:

1. What does the player know at this point?
2. Why do they know it?
3. Which player knows it: A, B, both, or ECHO-only?
4. What can happen next?

The viewer is not primarily a dependency debugger. It is a human-readable story map backed by the existing game content model.

## 2. Success criteria

A writer or developer should be able to open the viewer and quickly understand:

- the reveal progression from entry to ending;
- how A and B receive different information;
- when private information returns to the shared path;
- where ECHO observes, assists, manipulates, or reframes the experiment;
- which meaningful actions may lead toward which later story outcomes;
- whether important story content is unreachable, unsupported, or exposed to the wrong audience.

The default view must use story language, not implementation language.

Examples:

- `main5Completed` becomes "完成檔案庫復原" or is hidden as an implementation-only state.
- `archive.history_timeline` becomes "找到 ORPHEUS 完整歷史".
- `request_solo_validation` becomes "A 選擇個人存續驗證".
- `echo.behavior.reject_frame.a` becomes "A 拒絕 ECHO 的個人框架".

Technical IDs remain available in an expandable technical-details section.

## 3. Scope

### In scope

- Development/test-only author viewer.
- Read-only graph derived from existing canonical content.
- Human-readable story nodes and relationships.
- A/B/shared story swimlanes.
- Reveal-stage navigation.
- Node inspector.
- Filters for viewpoint, stage, type, and diagnostics.
- Static structural diagnostics.
- A technical-details mode for developers.
- Tests for graph derivation, routes, viewer behavior, and production isolation.

### Out of scope

- Editing content from the graph.
- Dragging nodes to rewrite source files.
- A second authoring schema that duplicates game logic.
- Live LLM-generated graph labels.
- Refactoring the ending engine solely for the viewer.
- Parsing arbitrary prose to infer story meaning.
- Full Unit01-16 historical rewrite.
- Production access to authoring routes.
- A third-party graph library in v1.

## 4. Source-of-truth rule

The existing game content remains authoritative.

Primary sources include:

- `game/content/terminalEntries.js`
- `game/content/dialogue.js`
- `game/content/operations.js`
- `game/content/privateMissions.js`
- `game/content/debrief.js`
- `game/content/endings.js`
- `game/endingEngine.js` for runtime ending resolution reference

The viewer may add presentation-only metadata where deterministic human labels cannot be inferred cleanly, but that metadata must never encode gameplay unlock logic, ending precedence, or state transitions.

Presentation metadata is allowed only for concerns such as:

- display label;
- short human explanation;
- optional story-stage grouping override;
- optional importance level;
- optional hidden-from-simple-view flag.

If such metadata is needed, it should live in one small authoring-only module, for example `game/authoring/storyGraphMetadata.js`.

## 5. Architecture

```text
Existing canonical content
        |
        | terminalEntries / dialogue / operations / missions / endings
        v
Story graph adapter
        |
        | normalize references
        | interpret predicates
        | derive causal relationships
        | collapse implementation-only facts
        | attach human presentation metadata
        | run diagnostics
        v
StoryGraphModel
        |
        +--> GET /author/api/reveal-graph
        |
        +--> GET /author/reveal-graph
                    |
                    v
             Human-readable viewer
```

The adapter must be pure and read-only. Building the graph must not mutate content modules or room state.

## 6. Development-only access

Authoring routes are available only when the application is not running in production.

Expected behavior:

```text
development/test:
GET /author/reveal-graph      -> 200
GET /author/api/reveal-graph  -> 200

production:
GET /author/reveal-graph      -> 404
GET /author/api/reveal-graph  -> 404
```

The feature does not need authentication in v1 because it is not exposed in production.

## 7. Story-first visual model

The simple view should not render every fact, predicate, gate, and engine state as a visible node.

Visible node categories are limited to story concepts:

1. **Discovery** — an important file, clue, record, or observation the player can learn.
2. **ECHO** — a meaningful ECHO message, observation, intervention, or manipulation.
3. **Action** — a meaningful player choice or operation.
4. **Truth** — a meaningful change in the player's model of what is actually happening.
5. **Ending** — a final story result.

Implementation entities such as `publicFact`, `roleFact`, predicate gates, reaction guards, and internal completion nodes are hidden by default and surfaced through the technical-details view.

## 8. Story stages

The viewer organizes the story from left to right using human-readable reveal stages.

| Stage | Human label | Player-level meaning |
|---|---|---|
| R0 | 進入實驗 | 我們被困在 Unit 17，需要理解眼前狀況 |
| R1 | 建立合作 | 兩人資訊不完整，必須交換資訊 |
| R2 | 產生矛盾 | 文件、時間或身份資訊開始互相衝突 |
| R3 | ECHO 介入 | ECHO 顯示出超出一般助手的觀察與影響能力 |
| R4 | 身分揭露 | A / B 與 ORPHEUS 實驗的真正身份逐漸被理解 |
| R5 | 選擇框架 | 玩家面對合作驗證與個體存續框架的衝突 |
| R6 | 結果 | 存續、共同覆核與 ECHO 解釋權形成結果 |

`R0` through `R6` appear as secondary labels. The human label is primary.

The graph adapter should infer stages from canonical dependencies where possible. A small presentation-only override is acceptable for ambiguous nodes, but overrides must not replace gameplay logic.

## 9. Swimlane layout

The central canvas uses story swimlanes rather than a free-form force graph.

Primary lanes:

```text
Shared story
-------------------------------------------------
A viewpoint
-------------------------------------------------
B viewpoint
-------------------------------------------------
ECHO / system intervention
```

Stages progress horizontally from left to right.

Conceptual example:

```text
                 Shared story
------------------------------------------------------------
 Unit 17 begins -> cooperative validation -> identity reveal
         |                                 |
         v                                 v
A: incident report -> ECHO private prompt -> solo protocol

B: roster anomaly  -> ECHO private prompt -> partner access

                       \                 /
                        -> shared choice -> endings
```

This layout should make information asymmetry visible without forcing the author to inspect raw audience fields.

## 10. Human-readable relationships

Edge labels use story language.

Preferred labels include:

- 解鎖
- 因為看過
- 因為選擇
- ECHO 注意到
- 證明
- 帶回共同路徑
- 私下得知
- 可能導向

Technical relationship names such as `PRODUCES`, `TRIGGERS`, `BLOCKS`, and `PRODUCES_PRIVATE` are hidden in simple mode and may be shown in technical mode.

## 11. Node inspector

Selecting a node opens a right-side inspector.

The default inspector answers four questions in this order:

### What is this?

A short human explanation of the event or discovery.

### How does the player reach it?

Human-readable prerequisites, such as:

- 完成前一階段;
- A 已讀過個人協定;
- 重複查看合作協定三次;
- B 選擇先警告夥伴.

### What changes after this?

Relevant consequences, including newly reachable discoveries, ECHO reactions, choices, or shared-path transitions.

### What may happen later?

A short set of downstream story consequences, not a claim that a particular ending is guaranteed.

At the bottom:

```text
Show technical details
```

Expanded technical details may include:

- canonical ID;
- source module;
- source content file;
- audience;
- normalized predicate;
- related public/role facts;
- operation effects;
- debrief fact IDs;
- raw edge kinds.

## 12. Graph model

The server-side normalized model may retain a richer structure than the simple UI exposes.

Example:

```js
{
  nodes: [
    {
      id: 'file:archive.history_timeline',
      refId: 'archive.history_timeline',
      technicalType: 'FILE',
      storyType: 'DISCOVERY',
      label: '找到 ORPHEUS 完整歷史',
      summary: '玩家取得 Unit 17 與過往研究的完整時間線。',
      audience: 'both',
      stage: 'R4',
      importance: 'major',
      source: {
        module: 'game/content/terminalEntries.js',
        contentFile: 'archives/orpheus_history_timeline.md'
      }
    }
  ],
  edges: [],
  diagnostics: [],
  stats: {}
}
```

All normalized IDs are namespaced, for example:

```text
fact:main5Completed
file:archive.history_timeline
action:complete_main5
echo:echo.behavior.protocol_recheck
ending:cooperative_escape
```

This prevents collisions between source domains.

## 13. Predicate handling

The graph adapter must share the same predicate semantics as the game's existing content schema.

Supported concepts include:

- `all`
- `any`
- `not`
- `publicFact`
- `roleFact`
- `entryOpened`
- `actionAttempted`
- `entryOpenedTimes`
- `elapsedSinceMeaningfulAction`
- `reactionFactMissing`

The viewer should not invent a second predicate evaluator with different semantics.

### Simple predicates

A simple dependency can collapse directly into a human edge.

```text
完成檔案庫復原 -> 解鎖 -> 找到 ORPHEUS 完整歷史
```

### Complex predicates

Nested `all`, `any`, and `not` remain represented in the internal graph but are hidden in simple mode.

For example, a technical condition such as:

```js
{
  all: [
    { publicFact: 'main1Completed' },
    { entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } },
    { reactionFactMissing: 'echo.behavior.protocol_recheck' }
  ]
}
```

should be presented as:

```text
重複查看合作協定三次
        |
        v
ECHO 察覺你正在反覆確認規則
```

The inspector can show that the reaction also requires the earlier story phase and has a one-time guard.

## 14. Operation effects

The adapter interprets existing operation effects to derive causal links.

Internal mappings include:

```text
publicFacts       -> produces shared state
roleFacts         -> produces private state
unlockEntryIds    -> unlocks discovery
completeNodeIds   -> completes internal progression
appendContentIds  -> appends story content
```

In simple mode, intermediary facts should be collapsed where doing so preserves meaning.

Example technical chain:

```text
complete_main5
    -> main5Completed
    -> archive.history_timeline
```

Simple view:

```text
完成第五階段
    -> 解鎖
找到 ORPHEUS 完整歷史
```

## 15. Ending representation

The five endings remain sourced from `game/content/endings.js`:

- `cooperative_escape`
- `a_solo_escape`
- `b_solo_escape`
- `exposed_ai_deception`
- `ambiguous_containment`

The actual ending selection logic currently lives in imperative runtime code in `game/endingEngine.js` and has ordered precedence.

V1 must not duplicate that logic in a second declarative graph definition.

The story map therefore shows the finale as a runtime-resolved branching area:

```text
Final commitment
      |
      v
Runtime ending resolution
  |     |     |     |     |
  v     v     v     v     v
 five possible ending nodes
```

The viewer may show known contributing facts and debrief relationships, but must clearly label exact ending resolution as runtime-calculated.

The viewer must not claim that a visible path guarantees a specific ending unless that claim is directly represented by canonical runtime logic.

## 16. Filters

V1 filters should be intentionally small and understandable.

### Story stage

- 全部
- 進入實驗
- 建立合作
- 產生矛盾
- ECHO 介入
- 身分揭露
- 選擇框架
- 結果

### Viewpoint

- 全部
- A 視角
- B 視角
- 共同資訊
- ECHO

### Story type

- 發現
- ECHO
- 行動
- 真相
- 結局

### Diagnostic mode

- 只看需要注意的地方

No query language, minimap, manual layout editor, or advanced graph search is required in v1.

## 17. Diagnostics

Diagnostics must be phrased for humans first and technical codes second.

The viewer must only report structural issues that can be justified from static data. It must not rate the quality of the story.

### Broken reference

Human message:

> 這段故事引用了一個不存在的內容。

Technical code: `BROKEN_REFERENCE`

Examples:

- an `unlockEntryId` does not exist;
- an `entryOpened` predicate references a missing entry;
- a verification entry references missing evidence.

Severity: Error.

### Story content may never appear

Human message:

> 這段故事可能永遠看不到。

Technical code: `UNREACHABLE`

A story node cannot be reached from the initial story state through known dependencies.

Severity: Warning.

### Isolated story content

Human message:

> 這段內容和其他故事節點沒有明確關係。

Technical code: `ORPHAN`

Initial/default content is excluded when isolation is intentional.

Severity: Warning or Hint depending on node type.

### Private information may leak

Human message:

> B 可能提前知道 A 的私人資訊。

or the inverse.

Technical code: `AUDIENCE_LEAK`

A shared node directly depends on private information without a known action that brings that information back to the shared path.

Severity: Warning.

### ECHO claim lacks visible support

Human message:

> ECHO 說了一件目前沒有證據支持的事。

Technical code: `MISSING_VERIFICATION`

Primarily applies to `observation` and `manipulation` dialogue that makes a factual claim but has no verification evidence.

It does not automatically apply to generic system or common-task dialogue.

Severity: Hint or Warning.

### Ending debrief fact cannot be traced

Human message:

> 這個結局提到的事實沒有找到可追溯來源。

Technical code: `ENDING_DEBRIEF_GAP`

The ending references a debrief fact that is absent from the debrief catalog or has no known source relationship.

Severity: Warning.

### Possible early reveal

Human message:

> 這份資訊可能比預期更早讓玩家看到後期真相。

Technical code: `SUSPICIOUS_EARLY_REVEAL`

This is advisory only. The author decides whether the reveal is intentional.

Severity: Hint.

## 18. Diagnostics interaction

The bottom/status area summarizes issues in plain language, for example:

```text
需要注意：
2 段故事可能無法抵達
1 個 ECHO 說法缺少可見證據
1 條 A/B 資訊邊界可能提前穿透
```

Selecting an issue should:

1. focus the relevant node;
2. highlight the relevant incoming/outgoing paths;
3. open the inspector;
4. explain the issue in human language;
5. show the technical code and source reference only as secondary information.

## 19. UI composition

The page uses three main areas.

```text
+-------------------------------------------------------------+
| ORPHEUS Story Map       stage / viewpoint / type filters    |
+---------------------------------------+---------------------+
|                                       |                     |
|          Story swimlane canvas        |     Inspector       |
|                                       |                     |
| Shared                                | What is this?       |
| A                                     | How reached?        |
| B                                     | What changes?       |
| ECHO                                  | What can follow?    |
|                                       | Technical details   |
+---------------------------------------+---------------------+
| Human-readable diagnostics summary                          |
+-------------------------------------------------------------+
```

The design should favor readability and focus over information density.

## 20. Rendering approach

V1 should use existing application technologies plus plain browser APIs.

Recommended implementation:

- EJS page shell;
- plain CSS;
- vanilla JavaScript;
- SVG for nodes, paths, lane backgrounds, focus states, and labels;
- deterministic lane/stage positioning;
- simple pan/zoom only if needed after the base layout is usable.

Do not add Cytoscape, D3, Mermaid, Graphviz, or another graph dependency in v1 unless implementation proves the deterministic SVG approach insufficient.

The deterministic layout is preferred because the story already has meaningful stage and audience axes. A force-directed layout would make the narrative harder, not easier, to read.

## 21. Error behavior

If graph generation detects malformed content that prevents a complete graph:

- the API should return a structured diagnostic response in development/test rather than silently dropping the problem;
- the page should remain usable when possible and show a clear "部分故事資料無法解析" message;
- production remains unaffected because the author routes do not exist there.

A single malformed optional presentation label must not break gameplay or normal room routes.

## 22. Testing strategy

Implementation should use TDD.

### Unit tests

Suggested file:

`test/unit/authorStoryGraph.test.js`

Cover at least:

- simple predicate normalization;
- nested `all`;
- nested `any`;
- `not` / one-time reaction guards;
- `entryOpenedTimes`;
- audience normalization;
- operation-effect relationships;
- hiding/collapsing implementation-only facts in simple presentation;
- reveal-stage propagation;
- human label fallback behavior;
- broken-reference detection;
- unreachable-node detection;
- audience-leak detection;
- ending debrief reference validation;
- graph generation does not mutate canonical content.

### Integration tests

Suggested file:

`test/integration/authorStoryGraphRoutes.test.js`

Cover:

- development/test page route returns 200;
- development/test API returns valid graph JSON;
- production page route returns 404;
- production API route returns 404;
- malformed graph data is represented as diagnostics rather than mutating gameplay state.

### E2E tests

Suggested file:

`test/e2e/authorRevealGraph.spec.js`

Minimum behavior:

1. viewer loads;
2. human-readable stage labels are visible;
3. switch to A viewpoint;
4. select a meaningful A-only node;
5. inspector explains what it is and how A reaches it;
6. switch to a later reveal stage;
7. select `archive.history_timeline` through its human label;
8. technical details expose `main5Completed` or the equivalent canonical dependency;
9. diagnostic selection focuses a related node when fixtures contain an issue.

The existing full `npm run check` suite must continue to pass.

## 23. Expected implementation boundaries

Likely new focused modules:

```text
game/authoring/storyGraph.js
  normalize canonical data and derive graph relationships

game/authoring/storyGraphPresentation.js
  collapse technical graph into human-readable story nodes

game/authoring/storyGraphDiagnostics.js
  static structural diagnostics

game/authoring/storyGraphMetadata.js
  optional presentation-only labels/overrides

routes/authorRoutes.js
  development/test-only page + API routes

views/author/revealGraph.ejs
public/js/authorRevealGraph.js
public/css/authorRevealGraph.css
```

Exact filenames may change during implementation planning, but responsibilities should remain isolated.

## 24. Non-goals and safeguards

The viewer must not become a second source of truth.

Specifically:

- no duplicate ending-condition table;
- no copied unlock tree maintained by hand;
- no write-back to content modules;
- no automatic prose scraping used as gameplay logic;
- no direct room-state mutation;
- no production author route;
- no graph-only behavior that changes what players see in the game.

## 25. Design principle

The governing principle for v1 is:

> The viewer is not for reading program dependencies. It is for answering: what does the player know now, why do they know it, who knows it, and what might happen next?

Technical dependency information remains available, but it supports the story map instead of defining its default presentation.
