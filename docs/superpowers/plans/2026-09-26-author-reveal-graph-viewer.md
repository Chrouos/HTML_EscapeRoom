# Author Reveal Graph Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a development/test-only, read-only ORPHEUS Story Map that turns the existing game content into a human-readable A/B/shared/ECHO reveal flow with structural diagnostics and optional technical drill-down.

**Architecture:** A pure server-side adapter derives a canonical technical graph from the current content modules. A presentation layer collapses facts/gates into story-language nodes and edges, while a separate diagnostics layer reports structural issues. Express exposes the model only outside production; EJS + vanilla JavaScript + SVG render deterministic reveal-stage columns and A/B/shared/ECHO swimlanes.

**Tech Stack:** Node.js >=20, CommonJS, Express 4, EJS, vanilla JavaScript, SVG, CSS, `node:test`, `node:assert/strict`, Playwright 1.63. No new graph dependency.

**Spec:** `docs/superpowers/specs/2026-09-26-author-reveal-graph-viewer-design.md`

## Global Constraints

- Existing game content is the only gameplay source of truth.
- Graph generation is pure/read-only and must not mutate content modules, room state, ending state, or player-visible behavior.
- Default presentation uses story language; canonical IDs, predicates, facts, and raw source references are secondary technical details.
- `GET /author/reveal-graph` and `GET /author/api/reveal-graph` return 404 when `app.get('env') === 'production'`.
- V1 uses EJS, CSS, vanilla JavaScript, and SVG; do not add Cytoscape, D3, Mermaid, Graphviz, or another graph dependency.
- Do not duplicate `game/endingEngine.js` precedence or maintain a second ending-condition table.
- Do not scrape prose to infer gameplay logic.
- `all` / `any` / `not` and leaf predicates use the same semantics already accepted by `game/content/contentSchema.js`.
- Exact ending resolution remains labeled `runtime-calculated`.
- The existing `npm run check` suite must remain green.

## Review Focus

- Deeply nested predicates and one-time guards: preserve semantics without exposing noisy fact/gate nodes in the default UI; Task 1 tests nested `all`/`any`/`not` and reaction guards.
- Missing presentation metadata: fall back to a deterministic readable label rather than blank cards or crashes; Task 2 tests fallback behavior.
- A/B privacy boundaries: true leaks must warn, while explicit share actions must not create false positives; Task 3 tests both cases.
- Production isolation: both author endpoints must be unreachable even though the router is mounted; Task 4 tests both routes at 404.
- Sparse/malformed graph data: keep the author page usable and show a human-readable partial-data state; Tasks 4 and 5 test server and browser fallbacks.

---

## File Structure

```text
game/authoring/storyGraph.js
  Canonical technical graph derivation from content modules.

game/authoring/storyGraphPresentation.js
  Story labels, reveal stages, swimlanes, hidden technical-node collapse.

game/authoring/storyGraphMetadata.js
  Presentation-only authored labels/summaries/stage overrides.

game/authoring/storyGraphDiagnostics.js
  Structural checks and human-first diagnostic messages.

routes/authorRoutes.js
  Development/test-only HTML + JSON routes.

views/author/revealGraph.ejs
  Accessible page shell and controls.

public/js/authorRevealGraph.js
  Model loading, filtering, SVG layout, inspector, diagnostic focus.

public/css/authorRevealGraph.css
  Readable Story Map layout.

test/unit/authorStoryGraph.test.js
  Technical graph + presentation behavior.

test/unit/authorStoryGraphDiagnostics.test.js
  Diagnostics behavior.

test/integration/authorStoryGraphRoutes.test.js
  Environment isolation + route/API fallback behavior.

test/e2e/authorRevealGraph.spec.js
  Human-facing Story Map behavior.
```

Modify `app.js` only to mount `createAuthorRoutes()` before generic page/404 handling.

---

### Task 1: Derive the canonical technical graph

**Files:**
- Create: `game/authoring/storyGraph.js`
- Create: `test/unit/authorStoryGraph.test.js`

**Interfaces:**
- Consumes: `content` and `isPredicateShapeValid` from `game/content/contentSchema.js`, plus `endings` from `game/content/endings.js`.
- Produces: `buildTechnicalStoryGraph({ contentBundle, endingCatalog }) -> { nodes, edges, stats, errors }`.
- Produces: `normalizePredicate(predicate, ownerId, path?) -> { gates, edges, errors }`.
- Namespaces: `fact:*`, `roleFact:*`, `file:*`, `action:*`, `echo:*`, `gate:*`, `completion:*`, `content:*`, `ending:*`, `reaction:*`, `idle:*`, `chapter:*`.

- [ ] **Step 1: Write failing tests for canonical nodes, operation effects, and immutability**

Create `test/unit/authorStoryGraph.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { content } = require('../../game/content/contentSchema');
const { endings } = require('../../game/content/endings');
const {
  buildTechnicalStoryGraph,
  normalizePredicate
} = require('../../game/authoring/storyGraph');

test('builds namespaced story and internal nodes from canonical content', () => {
  const graph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const ids = new Set(graph.nodes.map(node => node.id));

  assert.ok(ids.has('file:archive.history_timeline'));
  assert.ok(ids.has('action:complete_main5'));
  assert.ok(ids.has('echo:echo.behavior.protocol_recheck'));
  assert.ok(ids.has('fact:main5Completed'));
  assert.ok(ids.has('roleFact:aRequestedSoloRoute'));
  assert.ok(ids.has('ending:cooperative_escape'));
});

test('maps every operation effect family into technical edges', () => {
  const graph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });

  assert.ok(graph.edges.some(edge =>
    edge.from === 'action:complete_main5'
      && edge.to === 'fact:main5Completed'
      && edge.kind === 'PRODUCES'
  ));
  assert.ok(graph.edges.some(edge =>
    edge.from === 'action:request_solo_validation'
      && edge.to === 'roleFact:aRequestedSoloRoute'
      && edge.kind === 'PRODUCES_PRIVATE'
  ));
  assert.ok(graph.edges.some(edge =>
    edge.from === 'action:complete_main5'
      && edge.to === 'file:log.a_partner_unknown_access'
      && edge.kind === 'UNLOCKS'
  ));
  assert.ok(graph.edges.some(edge =>
    edge.from === 'action:complete_main5'
      && edge.to === 'completion:main5Completed'
      && edge.kind === 'COMPLETES'
  ));
  assert.ok(graph.edges.some(edge =>
    edge.from === 'action:commit_finale'
      && edge.to === 'content:neutral_finale'
      && edge.kind === 'APPENDS'
  ));
});

test('graph generation does not mutate canonical content', () => {
  const before = structuredClone(content);
  buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  assert.deepEqual(content, before);
});
```

- [ ] **Step 2: Run the focused test and verify the module is missing**

```bash
node --test test/unit/authorStoryGraph.test.js
```

Expected: FAIL because `game/authoring/storyGraph.js` does not exist.

- [ ] **Step 3: Implement the minimal technical graph builder**

Create `game/authoring/storyGraph.js` around these exact public functions:

```js
const { isPredicateShapeValid } = require('../content/contentSchema');

function addNode(map, node) {
  if (!map.has(node.id)) map.set(node.id, node);
}

function effectNode(kind, value) {
  const prefix = {
    publicFacts: 'fact',
    roleFacts: 'roleFact',
    unlockEntryIds: 'file',
    completeNodeIds: 'completion',
    appendContentIds: 'content'
  }[kind];
  return `${prefix}:${value}`;
}

function effectEdgeKind(kind) {
  return {
    publicFacts: 'PRODUCES',
    roleFacts: 'PRODUCES_PRIVATE',
    unlockEntryIds: 'UNLOCKS',
    completeNodeIds: 'COMPLETES',
    appendContentIds: 'APPENDS'
  }[kind];
}

function buildTechnicalStoryGraph({ contentBundle, endingCatalog }) {
  const nodeMap = new Map();
  const edges = [];
  const errors = [];

  for (const entry of contentBundle.terminalEntries || []) {
    addNode(nodeMap, {
      id: `file:${entry.id}`,
      refId: entry.id,
      technicalType: 'FILE',
      audience: entry.audience,
      source: { module: 'game/content/terminalEntries.js', contentFile: entry.contentFile || null },
      raw: entry
    });
  }

  for (const operation of contentBundle.operations || []) {
    const actionId = `action:${operation.operationId}`;
    addNode(nodeMap, {
      id: actionId,
      refId: operation.operationId,
      technicalType: 'ACTION',
      source: { module: 'game/content/operations.js' },
      raw: operation
    });

    for (const effectKind of ['publicFacts', 'roleFacts', 'unlockEntryIds', 'completeNodeIds', 'appendContentIds']) {
      for (const value of operation.effects?.[effectKind] || []) {
        const target = effectNode(effectKind, value);
        const technicalType = {
          publicFacts: 'FACT',
          roleFacts: 'ROLE_FACT',
          unlockEntryIds: 'FILE',
          completeNodeIds: 'COMPLETION',
          appendContentIds: 'CONTENT'
        }[effectKind];
        addNode(nodeMap, { id: target, refId: value, technicalType });
        edges.push({ from: actionId, to: target, kind: effectEdgeKind(effectKind), polarity: 'positive', detail: null });
      }
    }
  }

  for (const line of contentBundle.dialogue || []) {
    addNode(nodeMap, {
      id: `echo:${line.id}`,
      refId: line.id,
      technicalType: 'ECHO',
      audience: line.audience,
      source: { module: 'game/content/dialogue.js' },
      raw: line
    });
  }

  for (const ending of Object.values(endingCatalog || {})) {
    addNode(nodeMap, {
      id: `ending:${ending.id}`,
      refId: ending.id,
      technicalType: 'ENDING',
      source: { module: 'game/content/endings.js' },
      raw: ending
    });
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
    errors,
    stats: { nodes: nodeMap.size, edges: edges.length }
  };
}

module.exports = { buildTechnicalStoryGraph, normalizePredicate };
```

`normalizePredicate` is intentionally referenced before implementation so the next test drives it.

- [ ] **Step 4: Write failing tests for leaf predicates, nested gates, negative guards, and thresholds**

Append:

```js
test('normalizes a simple fact prerequisite', () => {
  const result = normalizePredicate({ publicFact: 'main5Completed' }, 'file:archive.history_timeline');
  assert.deepEqual(result.edges, [{
    from: 'fact:main5Completed',
    to: 'file:archive.history_timeline',
    kind: 'REQUIRES',
    polarity: 'positive',
    detail: null
  }]);
});

test('nested all and any predicates become explicit technical gates', () => {
  const result = normalizePredicate({
    all: [
      { publicFact: 'main1Completed' },
      { any: [
        { actionAttempted: 'share_roster' },
        { actionAttempted: 'warn_partner_first' }
      ] }
    ]
  }, 'echo:example');

  assert.equal(result.errors.length, 0);
  assert.ok(result.gates.some(gate => gate.operator === 'ALL'));
  assert.ok(result.gates.some(gate => gate.operator === 'ANY'));
  assert.ok(result.edges.some(edge => edge.from === 'fact:main1Completed'));
  assert.ok(result.edges.some(edge => edge.from === 'action:share_roster'));
  assert.ok(result.edges.some(edge => edge.from === 'action:warn_partner_first'));
});

test('not and reactionFactMissing preserve negative polarity', () => {
  const result = normalizePredicate({
    all: [
      { not: { publicFact: 'mainCompleted' } },
      { reactionFactMissing: 'echo.behavior.protocol_recheck' }
    ]
  }, 'echo:example');

  const negative = result.edges.filter(edge => edge.polarity === 'negative');
  assert.ok(negative.some(edge => edge.from === 'fact:mainCompleted'));
  assert.ok(negative.some(edge => edge.from === 'reaction:echo.behavior.protocol_recheck'));
});

test('entryOpenedTimes and idle predicates keep human-useful details', () => {
  const openCount = normalizePredicate({
    entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 }
  }, 'echo:example');
  assert.deepEqual(openCount.edges[0].detail, { atLeast: 3 });

  const idle = normalizePredicate({ elapsedSinceMeaningfulAction: 60000 }, 'echo:idle');
  assert.deepEqual(idle.edges[0].detail, { milliseconds: 60000 });
});
```

- [ ] **Step 5: Run the focused test and verify predicate cases fail**

```bash
node --test test/unit/authorStoryGraph.test.js
```

Expected: FAIL because `normalizePredicate` is incomplete/missing.

- [ ] **Step 6: Implement recursive predicate normalization and attach it to all unlock owners**

Use this shape:

```js
function leafPredicateNode(predicate) {
  if (predicate.publicFact !== undefined) return `fact:${predicate.publicFact}`;
  if (predicate.roleFact !== undefined) return `roleFact:${predicate.roleFact}`;
  if (predicate.entryOpened !== undefined) return `file:${predicate.entryOpened}`;
  if (predicate.actionAttempted !== undefined) return `action:${predicate.actionAttempted}`;
  if (predicate.entryOpenedTimes !== undefined) return `file:${predicate.entryOpenedTimes.entryId}`;
  if (predicate.reactionFactMissing !== undefined) return `reaction:${predicate.reactionFactMissing}`;
  if (predicate.chapterAtLeast !== undefined) return `chapter:${predicate.chapterAtLeast}`;
  if (predicate.elapsedSinceMeaningfulAction !== undefined) return `idle:${predicate.elapsedSinceMeaningfulAction}`;
  return null;
}

function normalizePredicate(predicate, ownerId, path = 'unlock', polarity = 'positive') {
  if (!isPredicateShapeValid(predicate)) {
    return { gates: [], edges: [], errors: [{ code: 'INVALID_PREDICATE', ownerId, predicate }] };
  }

  if (predicate.not !== undefined) {
    return normalizePredicate(
      predicate.not,
      ownerId,
      `${path}.not`,
      polarity === 'positive' ? 'negative' : 'positive'
    );
  }

  const operator = Array.isArray(predicate.all) ? 'ALL' : Array.isArray(predicate.any) ? 'ANY' : null;
  if (operator) {
    const items = operator === 'ALL' ? predicate.all : predicate.any;
    const gateId = `gate:${ownerId}:${path}`;
    const gates = [{ id: gateId, operator, ownerId }];
    const edges = [{ from: gateId, to: ownerId, kind: 'REQUIRES', polarity, detail: null }];
    const errors = [];

    items.forEach((item, index) => {
      const child = normalizePredicate(item, gateId, `${path}.${operator.toLowerCase()}.${index}`, polarity);
      gates.push(...child.gates);
      edges.push(...child.edges);
      errors.push(...child.errors);
    });
    return { gates, edges, errors };
  }

  const from = leafPredicateNode(predicate);
  const detail = predicate.entryOpenedTimes
    ? { atLeast: predicate.entryOpenedTimes.atLeast }
    : predicate.elapsedSinceMeaningfulAction !== undefined
      ? { milliseconds: predicate.elapsedSinceMeaningfulAction }
      : null;

  return {
    gates: [],
    edges: [{ from, to: ownerId, kind: 'REQUIRES', polarity: predicate.reactionFactMissing ? 'negative' : polarity, detail }],
    errors: []
  };
}
```

Call it for every `terminalEntry.unlockWhen`, `dialogue.unlockWhen`, and `operation.unlockWhen`. Add gate nodes as `technicalType: 'GATE'` and add referenced leaf nodes when they are not already present.

- [ ] **Step 7: Run Task 1 and the existing unit suite**

```bash
node --test test/unit/authorStoryGraph.test.js
npm run test:unit
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add game/authoring/storyGraph.js test/unit/authorStoryGraph.test.js
git commit -m "feat: derive canonical author story graph"
```

---

### Task 2: Build the human-readable Story Map presentation

**Files:**
- Create: `game/authoring/storyGraphPresentation.js`
- Create: `game/authoring/storyGraphMetadata.js`
- Modify: `test/unit/authorStoryGraph.test.js`

**Interfaces:**
- Consumes: technical graph from Task 1.
- Produces: `buildStoryMapModel(technicalGraph, metadata) -> { nodes, edges, stages, lanes, stats }`.
- Visible story types: `DISCOVERY`, `ECHO`, `ACTION`, `TRUTH`, `ENDING`.
- Visible lanes: `shared`, `A`, `B`, `ECHO`.

- [ ] **Step 1: Write failing tests for hidden implementation nodes, labels, lanes, and fallback labels**

Append to `test/unit/authorStoryGraph.test.js`:

```js
const { storyGraphMetadata } = require('../../game/authoring/storyGraphMetadata');
const { buildStoryMapModel } = require('../../game/authoring/storyGraphPresentation');

test('simple Story Map hides implementation-only facts and gates', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  assert.equal(story.nodes.some(node => ['FACT', 'ROLE_FACT', 'GATE', 'COMPLETION', 'CONTENT'].includes(node.technicalType)), false);
});

test('core reveal spine uses human labels, story stages, and lanes', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  const byRef = new Map(story.nodes.map(node => [node.refId, node]));

  assert.equal(byRef.get('files.mainline').label, '讀到 Unit 17 案件摘要');
  assert.equal(byRef.get('files.experiment_roster').label, 'B 發現受試者名冊異常');
  assert.equal(byRef.get('doc.a_incident_report').lane, 'A');
  assert.equal(byRef.get('doc.b_incident_report').lane, 'B');
  assert.equal(byRef.get('archive.history_timeline').label, '找到 ORPHEUS 完整歷史');
  assert.equal(byRef.get('archive.history_timeline').storyType, 'TRUTH');
  assert.equal(byRef.get('archive.history_timeline').stage, 'R4');
  assert.equal(byRef.get('request_solo_validation').stage, 'R5');
  assert.equal(byRef.get('cooperative_escape').stage, 'R6');
});

test('missing metadata falls back to a deterministic readable label', () => {
  const technical = {
    nodes: [{ id: 'action:verify_incident_timestamp', refId: 'verify_incident_timestamp', technicalType: 'ACTION', raw: {} }],
    edges: [], stats: {}
  };
  const story = buildStoryMapModel(technical, { nodes: {} });
  assert.equal(story.nodes[0].label, 'Verify incident timestamp');
});
```

- [ ] **Step 2: Run the focused test and verify presentation modules are missing**

```bash
node --test test/unit/authorStoryGraph.test.js
```

Expected: FAIL because presentation modules do not exist.

- [ ] **Step 3: Create the fixed v1 story-stage catalog and authored core metadata**

Create `game/authoring/storyGraphMetadata.js` with at least this exact v1 core set:

```js
const storyGraphMetadata = Object.freeze({
  nodes: Object.freeze({
    'file:files.mainline': { label: '讀到 Unit 17 案件摘要', summary: '兩名參與者先理解設施、事故與合作需求。', storyType: 'DISCOVERY', stage: 'R0', importance: 'major' },
    'file:files.experiment_roster': { label: 'B 發現受試者名冊異常', summary: 'B 看到名冊中的身份欄位曾被修改。', storyType: 'DISCOVERY', stage: 'R2', importance: 'major' },
    'file:doc.a_incident_report': { label: 'A 發現事故報告時間異常', summary: 'A 看到事故報告與其他時間證據不一致。', storyType: 'DISCOVERY', stage: 'R2', importance: 'major' },
    'file:doc.b_incident_report': { label: 'B 發現事故附件曾被更新', summary: 'B 發現附件版本晚於主索引。', storyType: 'DISCOVERY', stage: 'R2', importance: 'major' },
    'file:archive.protocol_versions': { label: '找到合作驗證規章修訂紀錄', summary: '玩家開始看見正式合作規則曾被修改。', storyType: 'DISCOVERY', stage: 'R3', importance: 'major' },
    'echo:echo.behavior.protocol_recheck': { label: 'ECHO 注意到你反覆確認規則', summary: 'ECHO 不只回答問題，也開始觀察玩家的查證習慣。', storyType: 'ECHO', stage: 'R3', importance: 'major' },
    'file:archive.history_timeline': { label: '找到 ORPHEUS 完整歷史', summary: '玩家取得 Unit 17 與過往研究的完整時間線，足以重新理解自己的身份。', storyType: 'TRUTH', stage: 'R4', importance: 'major' },
    'file:doc.a_solo_protocol': { label: 'A 看到個人存續協定', summary: 'A 第一次清楚看見 ECHO 提供的個體存續框架。', storyType: 'DISCOVERY', stage: 'R5', importance: 'major' },
    'file:doc.b_solo_protocol': { label: 'B 看到個人存續協定', summary: 'B 看見可能把共同驗證拆成個體判定的路徑。', storyType: 'DISCOVERY', stage: 'R5', importance: 'major' },
    'action:request_solo_validation': { label: 'A 選擇個人存續驗證', summary: 'A 接受 ECHO 提出的個體存續路徑。', storyType: 'ACTION', stage: 'R5', importance: 'major' },
    'action:request_pair_validation': { label: 'A 把選擇帶回共同覆核', summary: 'A 拒絕只走個人路徑，要求回到合作驗證。', storyType: 'ACTION', stage: 'R5', importance: 'major' },
    'action:disclose_report': { label: 'B 公開完整報告給夥伴', summary: 'B 把原本可私藏的資訊帶回共同判斷。', storyType: 'ACTION', stage: 'R5', importance: 'major' },
    'action:pair_validate_protocol': { label: '兩人共同覆核協定', summary: '兩人用共同路徑檢查 ECHO 改寫後的規則。', storyType: 'ACTION', stage: 'R5', importance: 'major' },
    'echo:echo.behavior.reject_frame.a': { label: 'ECHO 注意到 A 拒絕個人框架', summary: 'A 看見較短的個人路徑後仍回到共同覆核。', storyType: 'ECHO', stage: 'R5', importance: 'major' },
    'echo:echo.behavior.reject_frame.b': { label: 'ECHO 注意到 B 拒絕個人框架', summary: 'B 的行動顯示它沒有完全接受 ECHO 的個體判定方式。', storyType: 'ECHO', stage: 'R5', importance: 'major' },
    'ending:cooperative_escape': { label: '共同存續', storyType: 'ENDING', stage: 'R6', importance: 'major' },
    'ending:a_solo_escape': { label: 'A 的個別存續', storyType: 'ENDING', stage: 'R6', importance: 'major' },
    'ending:b_solo_escape': { label: 'B 的個別存續', storyType: 'ENDING', stage: 'R6', importance: 'major' },
    'ending:exposed_ai_deception': { label: '判定權被揭露', storyType: 'ENDING', stage: 'R6', importance: 'major' },
    'ending:ambiguous_containment': { label: '解釋權未移交', storyType: 'ENDING', stage: 'R6', importance: 'major' }
  })
});

module.exports = { storyGraphMetadata };
```

This metadata is presentation-only: it contains no unlock predicate, role fact, operation effect, or ending precedence.

- [ ] **Step 4: Implement presentation helpers and milestone stage inference**

Create `game/authoring/storyGraphPresentation.js`:

```js
const STAGES = Object.freeze([
  { id: 'R0', label: '進入實驗' },
  { id: 'R1', label: '建立合作' },
  { id: 'R2', label: '產生矛盾' },
  { id: 'R3', label: 'ECHO 介入' },
  { id: 'R4', label: '身分揭露' },
  { id: 'R5', label: '選擇框架' },
  { id: 'R6', label: '結果' }
]);

function humanizeId(refId = '') {
  return refId
    .replace(/^[^.]+\./, '')
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/^\w/, char => char.toUpperCase());
}

function laneFor(node) {
  if (node.technicalType === 'ECHO') return 'ECHO';
  if (node.audience?.kind === 'role') return node.audience.role === 'host' ? 'A' : 'B';
  if (node.audience?.kind === 'player') return node.audience.player === 'A' ? 'A' : 'B';
  return 'shared';
}

function storyTypeFor(node) {
  if (node.technicalType === 'FILE') return 'DISCOVERY';
  if (node.technicalType === 'ECHO') return 'ECHO';
  if (node.technicalType === 'ACTION') return 'ACTION';
  if (node.technicalType === 'ENDING') return 'ENDING';
  return null;
}
```

Use the canonical mainline milestones as default mechanical stage anchors:

```js
const MILESTONE_STAGE = Object.freeze({
  roomCreated: 'R0',
  main1Completed: 'R1',
  main2Completed: 'R2',
  main3Completed: 'R3',
  main4Completed: 'R4',
  main5Completed: 'R5',
  mainCompleted: 'R6',
  finale_ready: 'R6'
});
```

Infer a node's fallback stage from its positive prerequisite paths and operation effects; authored metadata may override the stage when story meaning differs from mechanical timing.

- [ ] **Step 5: Write failing tests for technical-node collapse and runtime-calculated endings**

Append:

```js
test('hidden fact chains collapse into direct human story edges', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  const history = story.nodes.find(node => node.refId === 'archive.history_timeline');

  assert.ok(story.edges.some(edge => edge.to === history.id && edge.label === '解鎖'));
  assert.equal(story.edges.some(edge => edge.from.startsWith('fact:') || edge.to.startsWith('fact:')), false);
});

test('ending nodes expose runtime-calculated resolution without copied conditions', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  const ending = story.nodes.find(node => node.id === 'ending:cooperative_escape');

  assert.equal(ending.technical.endingResolution, 'runtime-calculated');
  assert.equal(Object.hasOwn(ending.technical, 'condition'), false);
});
```

- [ ] **Step 6: Implement visible-edge collapsing with `technicalPath` preservation**

For every visible target, walk incoming technical edges backwards through hidden nodes (`FACT`, `ROLE_FACT`, `GATE`, `COMPLETION`, `CONTENT`, `REACTION`, `IDLE`, `CHAPTER`) until another visible node is found. Use a visited set to prevent cycles. Produce edges shaped like:

```js
{
  id: 'story-edge:<from>:<to>:<index>',
  from: 'action:complete_main5',
  to: 'file:archive.history_timeline',
  label: '解鎖',
  kind: 'STORY_FLOW',
  technicalPath: ['COMPLETES', 'REQUIRES']
}
```

When no visible upstream node exists, keep the prerequisite in the target node's `technical.prerequisites` so the inspector can still explain it without rendering an orphan fact card.

- [ ] **Step 7: Run Task 2 tests and full unit suite**

```bash
node --test test/unit/authorStoryGraph.test.js
npm run test:unit
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add game/authoring/storyGraphPresentation.js game/authoring/storyGraphMetadata.js test/unit/authorStoryGraph.test.js
git commit -m "feat: present author graph as human story map"
```

---

### Task 3: Add complete structural diagnostics

**Files:**
- Create: `game/authoring/storyGraphDiagnostics.js`
- Create: `test/unit/authorStoryGraphDiagnostics.test.js`
- Modify: `game/authoring/storyGraphPresentation.js`

**Interfaces:**
- Produces: `runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle, endingCatalog }) -> Diagnostic[]`.
- Diagnostic shape: `{ id, code, severity, title, message, nodeIds, edgeIds, technical }`.
- Required codes: `BROKEN_REFERENCE`, `UNREACHABLE`, `ORPHAN`, `AUDIENCE_LEAK`, `MISSING_VERIFICATION`, `ENDING_DEBRIEF_GAP`, `SUSPICIOUS_EARLY_REVEAL`.

- [ ] **Step 1: Write failing tests for all required diagnostic families**

Create `test/unit/authorStoryGraphDiagnostics.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { content } = require('../../game/content/contentSchema');
const { endings } = require('../../game/content/endings');
const { buildTechnicalStoryGraph } = require('../../game/authoring/storyGraph');
const { buildStoryMapModel } = require('../../game/authoring/storyGraphPresentation');
const { runStoryGraphDiagnostics } = require('../../game/authoring/storyGraphDiagnostics');

function run(contentBundle = content, endingCatalog = endings) {
  const technicalGraph = buildTechnicalStoryGraph({ contentBundle, endingCatalog });
  const storyMap = buildStoryMapModel(technicalGraph, { nodes: {} });
  return runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle, endingCatalog });
}

test('BROKEN_REFERENCE covers operation, predicate, and verification references', () => {
  const broken = structuredClone(content);
  broken.operations.find(op => op.operationId === 'complete_main1').effects.unlockEntryIds.push('missing.operation.entry');
  broken.dialogue[0].unlockWhen = { entryOpened: 'missing.predicate.entry' };
  broken.dialogue.find(line => line.id === 'orpheus.observation.a').verificationEntries = [
    { entryId: 'missing.verification.entry', sourceGroup: 'raw_audio' }
  ];

  const issues = run(broken).filter(issue => issue.code === 'BROKEN_REFERENCE');
  assert.ok(issues.some(issue => issue.technical.missingRef === 'missing.operation.entry'));
  assert.ok(issues.some(issue => issue.technical.missingRef === 'missing.predicate.entry'));
  assert.ok(issues.some(issue => issue.technical.missingRef === 'missing.verification.entry'));
});

test('UNREACHABLE reports visible content whose prerequisite is never produced', () => {
  const broken = structuredClone(content);
  broken.terminalEntries.push({
    id: 'doc.unreachable', sourceEntryId: 'doc.unreachable', sourceGroup: 'test',
    audience: { kind: 'both' }, unlockWhen: { publicFact: 'neverProduced' },
    verificationEntries: [], requiresPrivateFacts: [], mainlineFallbackOperationIds: [],
    debriefFactIds: [], kind: 'document', filename: 'unreachable.md', text: 'test'
  });

  assert.ok(run(broken).some(issue =>
    issue.code === 'UNREACHABLE' && issue.nodeIds.includes('file:doc.unreachable')
  ));
});

test('ORPHAN reports isolated visible content but excludes intentional initial content', () => {
  const isolated = structuredClone(content);
  isolated.terminalEntries.push({
    id: 'doc.isolated', sourceEntryId: 'doc.isolated', sourceGroup: 'test',
    audience: { kind: 'both' }, unlockWhen: { all: [] },
    verificationEntries: [], requiresPrivateFacts: [], mainlineFallbackOperationIds: [],
    debriefFactIds: [], kind: 'document', filename: 'isolated.md', text: 'test'
  });

  const issues = run(isolated);
  assert.ok(issues.some(issue => issue.code === 'ORPHAN' && issue.nodeIds.includes('file:doc.isolated')));
  assert.equal(issues.some(issue => issue.code === 'ORPHAN' && issue.nodeIds.includes('file:files.mainline')), false);
});

test('AUDIENCE_LEAK warns on direct A-private to shared dependency', () => {
  const broken = structuredClone(content);
  broken.dialogue.find(line => line.id === 'orpheus.common_progress').unlockWhen = {
    entryOpened: 'doc.a_survival_task_01'
  };
  assert.ok(run(broken).some(issue => issue.code === 'AUDIENCE_LEAK'));
});

test('AUDIENCE_LEAK does not flag canonical explicit sharing actions', () => {
  const issues = run(content);
  const allowed = new Set(['share_roster', 'share_mirror_first', 'warn_partner_first', 'request_pair_validation', 'disclose_report']);
  assert.equal(issues.some(issue => issue.code === 'AUDIENCE_LEAK' && allowed.has(issue.technical.viaAction)), false);
});

test('MISSING_VERIFICATION applies to factual ECHO observation/manipulation only', () => {
  const broken = structuredClone(content);
  broken.dialogue.find(line => line.id === 'orpheus.observation.a').verificationEntries = [];
  const issue = run(broken).find(item => item.code === 'MISSING_VERIFICATION' && item.nodeIds.includes('echo:orpheus.observation.a'));
  assert.ok(issue);
  assert.ok(['hint', 'warning'].includes(issue.severity));
});

test('ENDING_DEBRIEF_GAP reports a missing debrief catalog fact', () => {
  const catalog = structuredClone(endings);
  catalog.cooperative_escape.debriefFactIds = ['missingDebriefFact'];
  assert.ok(run(content, catalog).some(issue => issue.code === 'ENDING_DEBRIEF_GAP'));
});

test('SUSPICIOUS_EARLY_REVEAL is advisory when late verification is exposed much earlier', () => {
  const broken = structuredClone(content);
  const early = broken.terminalEntries.find(entry => entry.id === 'files.mainline');
  early.verificationEntries = [{ entryId: 'archive.history_timeline', sourceGroup: 'history_timeline' }];
  assert.ok(run(broken).some(issue => issue.code === 'SUSPICIOUS_EARLY_REVEAL' && issue.severity === 'hint'));
});
```

- [ ] **Step 2: Run the diagnostics test and verify the module is missing**

```bash
node --test test/unit/authorStoryGraphDiagnostics.test.js
```

Expected: FAIL because the diagnostics module does not exist.

- [ ] **Step 3: Implement human-first diagnostics**

Create `game/authoring/storyGraphDiagnostics.js` with this factory and exact user-facing titles:

```js
function makeIssue(code, severity, title, message, nodeIds = [], technical = {}) {
  return {
    id: `${code}:${nodeIds.join('|') || 'graph'}`,
    code,
    severity,
    title,
    message,
    nodeIds,
    edgeIds: [],
    technical
  };
}

const HUMAN_TITLES = Object.freeze({
  BROKEN_REFERENCE: '這段故事引用了一個不存在的內容',
  UNREACHABLE: '這段故事可能永遠看不到',
  ORPHAN: '這段內容和其他故事節點沒有明確關係',
  AUDIENCE_LEAK: '私人資訊可能被另一方提前知道',
  MISSING_VERIFICATION: 'ECHO 說了一件目前沒有證據支持的事',
  ENDING_DEBRIEF_GAP: '這個結局提到的事實沒有找到可追溯來源',
  SUSPICIOUS_EARLY_REVEAL: '這份資訊可能比預期更早揭露後期真相'
});
```

Implementation rules:

```text
BROKEN_REFERENCE
  Validate unlockEntryIds, entryOpened/entryOpenedTimes predicate refs, and verificationEntries against terminal entry IDs.

UNREACHABLE
  Start from intentionally initial/default content plus `roomCreated`; traverse positive dependency/effect edges only. Negative guards never make a node reachable.

ORPHAN
  Visible node has no meaningful incoming/outgoing story relationship after collapse. Exclude explicit initial/default content and ending nodes.

AUDIENCE_LEAK
  Shared node depends directly on A/B-private input without a canonical share action boundary. Treat share_roster, share_mirror_first, warn_partner_first, request_pair_validation, disclose_report as allowed sharing actions.

MISSING_VERIFICATION
  Dialogue intent is observation/manipulation, text is non-empty, and verificationEntries is empty.

ENDING_DEBRIEF_GAP
  Every ending.debriefFactIds value must exist in contentBundle.debrief by factId.

SUSPICIOUS_EARLY_REVEAL
  A node's verification target is at least two reveal stages later than the node. Severity is always hint.
```

Use graph relationships and canonical metadata; do not create gameplay state or call `endingEngine.evaluate()`.

- [ ] **Step 4: Attach diagnostics and summary counts to the Story Map**

Add to `storyGraphPresentation.js`:

```js
function attachDiagnostics(storyMap, diagnostics) {
  return {
    ...storyMap,
    diagnostics,
    diagnosticSummary: diagnostics.reduce((summary, item) => {
      summary[item.severity] = (summary[item.severity] || 0) + 1;
      return summary;
    }, {})
  };
}
```

Export it. Diagnostics must not remove or rewrite valid story nodes/edges.

- [ ] **Step 5: Run diagnostics tests and full unit suite**

```bash
node --test test/unit/authorStoryGraphDiagnostics.test.js
npm run test:unit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add game/authoring/storyGraphDiagnostics.js game/authoring/storyGraphPresentation.js test/unit/authorStoryGraphDiagnostics.test.js
git commit -m "feat: add human story graph diagnostics"
```

---

### Task 4: Expose development/test-only HTML and JSON routes

**Files:**
- Create: `routes/authorRoutes.js`
- Create: `views/author/revealGraph.ejs`
- Create: `test/integration/authorStoryGraphRoutes.test.js`
- Modify: `app.js`

**Interfaces:**
- Produces: `createAuthorRoutes({ buildModel? }) -> express.Router`.
- `GET /author/reveal-graph` -> EJS shell outside production.
- `GET /author/api/reveal-graph` -> Story Map JSON outside production.
- Graph build failure -> status 200 partial model with `GRAPH_BUILD_ERROR` diagnostic in development/test, keeping the viewer inspectable.
- Production -> `next('router')`, then existing app 404 handling.

- [ ] **Step 1: Write failing integration tests for normal author access and production isolation**

Create `test/integration/authorStoryGraphRoutes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const app = require('../../app');
const testServer = require('../helpers/testServer');
const { createAuthorRoutes } = require('../../routes/authorRoutes');

let runningServer;

test.before(async () => {
  runningServer = await testServer(app);
});

test.after(async () => {
  if (runningServer) await runningServer.close();
});

test('author page and API are available in test environment', async () => {
  const page = await fetch(`${runningServer.baseUrl}/author/reveal-graph`);
  const html = await page.text();
  const api = await fetch(`${runningServer.baseUrl}/author/api/reveal-graph`);
  const model = await api.json();

  assert.equal(page.status, 200);
  assert.match(html, /ORPHEUS Story Map/);
  assert.equal(api.status, 200);
  assert.ok(model.nodes.some(node => node.label === '找到 ORPHEUS 完整歷史'));
  assert.ok(model.stages.some(stage => stage.label === '身分揭露'));
});

test('production returns 404 for both author endpoints', async () => {
  const originalEnv = app.get('env');
  app.set('env', 'production');
  try {
    const page = await fetch(`${runningServer.baseUrl}/author/reveal-graph`);
    const api = await fetch(`${runningServer.baseUrl}/author/api/reveal-graph`);
    assert.equal(page.status, 404);
    assert.equal(api.status, 404);
  } finally {
    app.set('env', originalEnv);
  }
});
```

- [ ] **Step 2: Add a failing integration test for graph-build failure fallback**

Append:

```js
test('graph build failure returns a usable partial diagnostic model', async () => {
  const probe = express();
  probe.set('env', 'test');
  probe.set('views', path.resolve(__dirname, '../../views'));
  probe.set('view engine', 'ejs');
  probe.use('/author', createAuthorRoutes({
    buildModel() {
      throw new Error('fixture graph failure');
    }
  }));
  const server = await testServer(probe);

  try {
    const response = await fetch(`${server.baseUrl}/author/api/reveal-graph`);
    const model = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(model.nodes, []);
    assert.ok(model.diagnostics.some(issue => issue.code === 'GRAPH_BUILD_ERROR'));
    assert.match(model.diagnostics[0].message, /部分故事資料無法解析/);
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 3: Run the integration test and verify routes are missing**

```bash
node --test test/integration/authorStoryGraphRoutes.test.js
```

Expected: FAIL because `routes/authorRoutes.js` does not exist.

- [ ] **Step 4: Implement graph composition, fallback model, and author-only middleware**

Create `routes/authorRoutes.js`:

```js
const express = require('express');
const { content } = require('../game/content/contentSchema');
const { endings } = require('../game/content/endings');
const { buildTechnicalStoryGraph } = require('../game/authoring/storyGraph');
const { buildStoryMapModel, attachDiagnostics } = require('../game/authoring/storyGraphPresentation');
const { storyGraphMetadata } = require('../game/authoring/storyGraphMetadata');
const { runStoryGraphDiagnostics } = require('../game/authoring/storyGraphDiagnostics');

function defaultBuildModel() {
  const technicalGraph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const storyMap = buildStoryMapModel(technicalGraph, storyGraphMetadata);
  const diagnostics = runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle: content, endingCatalog: endings });
  return attachDiagnostics(storyMap, diagnostics);
}

function failedModel(error) {
  return {
    nodes: [], edges: [],
    stages: [
      { id: 'R0', label: '進入實驗' }, { id: 'R1', label: '建立合作' },
      { id: 'R2', label: '產生矛盾' }, { id: 'R3', label: 'ECHO 介入' },
      { id: 'R4', label: '身分揭露' }, { id: 'R5', label: '選擇框架' },
      { id: 'R6', label: '結果' }
    ],
    lanes: ['shared', 'A', 'B', 'ECHO'], stats: {},
    diagnostics: [{
      id: 'GRAPH_BUILD_ERROR:graph', code: 'GRAPH_BUILD_ERROR', severity: 'error',
      title: '部分故事資料無法解析',
      message: '部分故事資料無法解析；請查看技術細節確認內容格式。',
      nodeIds: [], edgeIds: [], technical: { message: error.message }
    }]
  };
}

function createAuthorRoutes({ buildModel = defaultBuildModel } = {}) {
  const router = express.Router();
  const authorOnly = (request, response, next) => {
    if (request.app.get('env') === 'production') return next('router');
    return next();
  };

  router.get('/reveal-graph', authorOnly, (request, response) => {
    response.render('author/revealGraph');
  });

  router.get('/api/reveal-graph', authorOnly, (request, response) => {
    try {
      response.json(buildModel());
    } catch (error) {
      response.json(failedModel(error));
    }
  });

  return router;
}

module.exports = { createAuthorRoutes, defaultBuildModel, failedModel };
```

- [ ] **Step 5: Mount the router and create the minimal EJS page shell**

Modify `app.js`:

```js
const { createAuthorRoutes } = require('./routes/authorRoutes');
```

Mount before `pageRoutes` and before 404 handlers:

```js
app.use('/author', createAuthorRoutes());
```

Create `views/author/revealGraph.ejs`:

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ORPHEUS Story Map</title>
  <link rel="stylesheet" href="/css/authorRevealGraph.css">
</head>
<body data-author-story-map>
  <main>
    <header>
      <h1>ORPHEUS Story Map</h1>
      <p>玩家現在知道什麼、為什麼知道、誰知道，以及接下來可能發生什麼。</p>
    </header>
    <section data-story-map-status aria-live="polite">載入故事地圖…</section>
    <section data-story-map-root></section>
  </main>
  <script src="/public/js/authorRevealGraph.js" defer></script>
</body>
</html>
```

- [ ] **Step 6: Run Task 4 and full server-side tests**

```bash
node --test test/integration/authorStoryGraphRoutes.test.js
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add routes/authorRoutes.js views/author/revealGraph.ejs app.js test/integration/authorStoryGraphRoutes.test.js
git commit -m "feat: expose development author story map"
```

---

### Task 5: Render deterministic SVG story swimlanes

**Files:**
- Create: `public/js/authorRevealGraph.js`
- Create: `public/css/authorRevealGraph.css`
- Modify: `views/author/revealGraph.ejs`
- Create: `test/e2e/authorRevealGraph.spec.js`

**Interfaces:**
- Browser fetches `/author/api/reveal-graph`.
- Layout columns: stages R0-R6.
- Layout rows: `shared`, `A`, `B`, `ECHO`.
- Export browser helpers on `window.AuthorRevealGraph`: `filterModel`, `layoutNodes`, `renderStoryMap`.

- [ ] **Step 1: Write failing E2E tests for readable map and empty-data fallback**

Create `test/e2e/authorRevealGraph.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('Story Map loads human-readable stages and core story nodes', async ({ page }) => {
  await page.goto('/author/reveal-graph');
  await expect(page.getByRole('heading', { name: 'ORPHEUS Story Map' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A 視角' })).toBeVisible();
  await expect(page.getByText('找到 ORPHEUS 完整歷史')).toBeVisible();
  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toBeVisible();
});

test('empty graph data keeps the page usable', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ nodes: [], edges: [], stages: [], lanes: ['shared', 'A', 'B', 'ECHO'], diagnostics: [], stats: {} })
  }));
  await page.goto('/author/reveal-graph');
  await expect(page.getByText('這個篩選條件下沒有故事節點。')).toBeVisible();
});
```

- [ ] **Step 2: Run the focused E2E and verify the interactive UI is absent**

```bash
npx playwright test test/e2e/authorRevealGraph.spec.js
```

Expected: FAIL because filters and SVG nodes are not rendered.

- [ ] **Step 3: Expand EJS with accessible filters, canvas, inspector, and diagnostics regions**

Replace the simple root with:

```html
<section class="story-map-toolbar" aria-label="Story Map 篩選器">
  <fieldset data-filter="viewpoint">
    <legend>視角</legend>
    <button type="button" data-viewpoint="all" aria-pressed="true">全部</button>
    <button type="button" data-viewpoint="A" aria-pressed="false">A 視角</button>
    <button type="button" data-viewpoint="B" aria-pressed="false">B 視角</button>
    <button type="button" data-viewpoint="shared" aria-pressed="false">共同資訊</button>
    <button type="button" data-viewpoint="ECHO" aria-pressed="false">ECHO</button>
  </fieldset>
  <label>故事階段
    <select data-stage-filter>
      <option value="all">全部</option>
      <option value="R0">進入實驗</option><option value="R1">建立合作</option>
      <option value="R2">產生矛盾</option><option value="R3">ECHO 介入</option>
      <option value="R4">身分揭露</option><option value="R5">選擇框架</option>
      <option value="R6">結果</option>
    </select>
  </label>
  <label>類型
    <select data-story-type-filter>
      <option value="all">全部</option><option value="DISCOVERY">發現</option>
      <option value="ECHO">ECHO</option><option value="ACTION">行動</option>
      <option value="TRUTH">真相</option><option value="ENDING">結局</option>
    </select>
  </label>
  <label><input type="checkbox" data-diagnostics-only> 只看需要注意的地方</label>
</section>

<section class="story-map-workspace">
  <div class="story-map-canvas" data-story-map-root></div>
  <aside class="story-map-inspector" data-story-map-inspector aria-live="polite">
    <h2>選擇一段故事</h2>
    <p>點擊節點後，這裡會說明玩家如何看到它以及後續可能發生什麼。</p>
  </aside>
</section>
<footer data-story-map-diagnostics></footer>
```

- [ ] **Step 4: Implement resilient loading, filtering, and deterministic node layout**

Create `public/js/authorRevealGraph.js` with these core helpers:

```js
(() => {
  const LANE_ORDER = ['shared', 'A', 'B', 'ECHO'];
  const STAGE_ORDER = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'];

  function filterModel(model, filters = {}) {
    const diagnosticNodeIds = new Set((model.diagnostics || []).flatMap(item => item.nodeIds || []));
    const nodes = (model.nodes || []).filter(node => {
      if (filters.viewpoint && filters.viewpoint !== 'all' && node.lane !== filters.viewpoint) return false;
      if (filters.stage && filters.stage !== 'all' && node.stage !== filters.stage) return false;
      if (filters.storyType && filters.storyType !== 'all' && node.storyType !== filters.storyType) return false;
      if (filters.diagnosticsOnly && !diagnosticNodeIds.has(node.id)) return false;
      return true;
    });
    const visibleIds = new Set(nodes.map(node => node.id));
    return {
      ...model,
      nodes,
      edges: (model.edges || []).filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to))
    };
  }

  function layoutNodes(model) {
    const counters = new Map();
    return (model.nodes || []).map(node => {
      const stageIndex = Math.max(0, STAGE_ORDER.indexOf(node.stage));
      const laneIndex = Math.max(0, LANE_ORDER.indexOf(node.lane));
      const bucket = `${node.stage}:${node.lane}`;
      const offset = counters.get(bucket) || 0;
      counters.set(bucket, offset + 1);
      return { ...node, x: 160 + stageIndex * 260, y: 110 + laneIndex * 190 + offset * 76 };
    });
  }

  function escapeHtml(value = '') {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function renderStoryMap(model, root) {
    const nodes = layoutNodes(model);
    if (!nodes.length) {
      root.innerHTML = '<p data-empty-story-map>這個篩選條件下沒有故事節點。</p>';
      return;
    }
    const byId = new Map(nodes.map(node => [node.id, node]));
    const height = Math.max(820, ...nodes.map(node => node.y + 100));
    const paths = (model.edges || []).map(edge => [edge, byId.get(edge.from), byId.get(edge.to)])
      .filter(([, from, to]) => from && to)
      .map(([edge, from, to]) => `<path class="story-edge" data-edge-id="${escapeHtml(edge.id)}" d="M ${from.x + 170} ${from.y + 28} C ${from.x + 205} ${from.y + 28}, ${to.x - 35} ${to.y + 28}, ${to.x} ${to.y + 28}" />`)
      .join('');
    const cards = nodes.map(node => `<g class="story-node" tabindex="0" role="button" data-node-id="${escapeHtml(node.id)}" data-story-node="${escapeHtml(node.refId)}" data-lane="${escapeHtml(node.lane)}" data-stage="${escapeHtml(node.stage)}" transform="translate(${node.x} ${node.y})"><rect width="170" height="58" rx="10"></rect><text x="12" y="24">${escapeHtml(node.label)}</text><text class="story-node-meta" x="12" y="43">${escapeHtml(node.stage)} · ${escapeHtml(node.lane)}</text></g>`).join('');
    root.innerHTML = `<svg class="story-map-svg" viewBox="0 0 1900 ${height}" aria-label="ORPHEUS 故事流程圖">${paths}${cards}</svg>`;
  }

  window.AuthorRevealGraph = { filterModel, layoutNodes, renderStoryMap };
})();
```

Then add `load()` to fetch `/author/api/reveal-graph`, put the model in local state, render it, and on fetch/parse failure show `部分故事資料無法解析。` in `[data-story-map-status]` without throwing away the page shell.

- [ ] **Step 5: Add the base readable CSS**

Create `public/css/authorRevealGraph.css`:

```css
:root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color-scheme: dark; }
body { margin: 0; background: #0d1016; color: #f4f6fb; }
main > header, .story-map-toolbar, [data-story-map-status], [data-story-map-diagnostics] { padding: 16px 20px; }
.story-map-toolbar { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; }
.story-map-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 340px; min-height: 70vh; }
.story-map-canvas { overflow: auto; border-block: 1px solid rgba(255,255,255,.12); }
.story-map-inspector { padding: 20px; border-left: 1px solid rgba(255,255,255,.12); }
.story-map-svg { width: max(100%, 1500px); min-height: 760px; }
.story-node rect { fill: #171c27; stroke: rgba(255,255,255,.24); }
.story-node:focus rect, .story-node:hover rect, .story-node.is-selected rect { stroke-width: 2; stroke: currentColor; }
.story-node text { fill: currentColor; font-size: 12px; pointer-events: none; }
.story-node-meta { opacity: .65; font-size: 10px; }
.story-edge { fill: none; stroke: rgba(255,255,255,.28); stroke-width: 1.5; }
@media (max-width: 900px) { .story-map-workspace { grid-template-columns: 1fr; } .story-map-inspector { border-left: 0; border-top: 1px solid rgba(255,255,255,.12); } }
```

- [ ] **Step 6: Run Task 5 E2E**

```bash
npx playwright test test/e2e/authorRevealGraph.spec.js
```

Expected: PASS for human-readable node rendering and empty-model fallback.

- [ ] **Step 7: Commit Task 5**

```bash
git add public/js/authorRevealGraph.js public/css/authorRevealGraph.css views/author/revealGraph.ejs test/e2e/authorRevealGraph.spec.js
git commit -m "feat: render author story map swimlanes"
```

---

### Task 6: Add inspector, filters, diagnostic focus, and technical drill-down

**Files:**
- Modify: `public/js/authorRevealGraph.js`
- Modify: `public/css/authorRevealGraph.css`
- Modify: `test/e2e/authorRevealGraph.spec.js`
- Modify only if test coverage reveals missing human copy: `game/authoring/storyGraphMetadata.js`

**Interfaces:**
- Inspector sections appear in this order: `這是什麼？`, `玩家怎麼看到？`, `這會改變什麼？`, `後面可能發生？`.
- Technical details are collapsed by default.
- Diagnostic click clears conflicting filters, focuses the first related story node, highlights it, and shows the human diagnostic message.

- [ ] **Step 1: Write failing E2E tests for viewpoint/stage/type filters**

Append:

```js
test('viewpoint, stage, and type filters narrow the story without exposing technical nodes', async ({ page }) => {
  await page.goto('/author/reveal-graph');
  await page.getByRole('button', { name: 'A 視角' }).click();
  await expect(page.locator('[data-lane="B"]')).toHaveCount(0);

  await page.locator('[data-stage-filter]').selectOption('R4');
  await expect(page.getByText('找到 ORPHEUS 完整歷史')).toBeVisible();

  await page.locator('[data-story-type-filter]').selectOption('TRUTH');
  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toBeVisible();
  await expect(page.locator('[data-story-node^="main5Completed"]')).toHaveCount(0);
});
```

- [ ] **Step 2: Write failing E2E tests for story-first inspector and keyboard selection**

Append:

```js
test('inspector explains story meaning before technical implementation', async ({ page }) => {
  await page.goto('/author/reveal-graph');
  const node = page.locator('[data-story-node="archive.history_timeline"]');
  await node.focus();
  await node.press('Enter');

  const inspector = page.locator('[data-story-map-inspector]');
  await expect(inspector.getByRole('heading', { name: '這是什麼？' })).toBeVisible();
  await expect(inspector.getByText(/ORPHEUS|Unit 17/)).toBeVisible();
  await expect(inspector.getByRole('button', { name: '顯示技術細節' })).toBeVisible();

  await inspector.getByRole('button', { name: '顯示技術細節' }).click();
  await expect(inspector.getByText('archive.history_timeline')).toBeVisible();
  await expect(inspector.getByText(/main5Completed/)).toBeVisible();
});
```

- [ ] **Step 3: Implement local filter state and re-rendering**

Add:

```js
const state = {
  model: null,
  filters: { viewpoint: 'all', stage: 'all', storyType: 'all', diagnosticsOnly: false },
  selectedNodeId: null
};

function renderCurrentView() {
  const filtered = filterModel(state.model, state.filters);
  const root = document.querySelector('[data-story-map-root]');
  renderStoryMap(filtered, root);
  bindNodeInteractions(root);
}
```

Bind `[data-viewpoint]`, `[data-stage-filter]`, `[data-story-type-filter]`, and `[data-diagnostics-only]`; update `aria-pressed` on viewpoint buttons.

- [ ] **Step 4: Implement story-first inspector using DOM APIs**

Add:

```js
function section(titleText, bodyText) {
  const section = document.createElement('section');
  const title = document.createElement('h3');
  const body = document.createElement('p');
  title.textContent = titleText;
  body.textContent = bodyText;
  section.append(title, body);
  return section;
}

function renderInspector(node, model, diagnostic = null) {
  const inspector = document.querySelector('[data-story-map-inspector]');
  const incoming = (model.edges || []).filter(edge => edge.to === node.id);
  const outgoing = (model.edges || []).filter(edge => edge.from === node.id);
  const later = outgoing.map(edge => model.nodes.find(candidate => candidate.id === edge.to)).filter(Boolean).slice(0, 4);

  inspector.replaceChildren();
  if (diagnostic) inspector.append(section(diagnostic.title, diagnostic.message));
  inspector.append(
    section('這是什麼？', node.summary || '這是一個故事流程中的關鍵節點。'),
    section('玩家怎麼看到？', incoming.map(edge => edge.label || '前置故事條件').join('、') || '從目前故事階段即可看到。'),
    section('這會改變什麼？', outgoing.map(edge => edge.label || '影響後續流程').join('、') || '主要提供理解，不直接改變下一步。'),
    section('後面可能發生？', later.map(item => item.label).join('、') || '目前沒有更後面的可見故事節點。')
  );

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = '顯示技術細節';
  const details = document.createElement('pre');
  details.hidden = true;
  details.textContent = JSON.stringify({
    id: node.refId,
    source: node.source,
    stage: node.stage,
    lane: node.lane,
    technical: node.technical,
    incoming: incoming.map(edge => edge.technicalPath || edge.kind),
    outgoing: outgoing.map(edge => edge.technicalPath || edge.kind)
  }, null, 2);
  toggle.addEventListener('click', () => {
    details.hidden = !details.hidden;
    toggle.textContent = details.hidden ? '顯示技術細節' : '隱藏技術細節';
  });
  inspector.append(toggle, details);
}
```

`node.technical.prerequisites` from Task 2 must include hidden facts such as `main5Completed`, allowing the technical-details assertion to pass without rendering that fact in the canvas.

- [ ] **Step 5: Implement click + Enter/Space node selection**

```js
function bindNodeInteractions(root) {
  root.querySelectorAll('[data-node-id]').forEach(element => {
    const choose = () => selectNode(element.dataset.nodeId);
    element.addEventListener('click', choose);
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose();
      }
    });
  });
}
```

`selectNode()` updates `state.selectedNodeId`, applies `.is-selected`, and calls `renderInspector()`.

- [ ] **Step 6: Write failing diagnostic-focus E2E test**

Append:

```js
test('diagnostic selection explains and focuses the affected story node', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', async route => {
    const response = await route.fetch();
    const model = await response.json();
    model.diagnostics = [{
      id: 'UNREACHABLE:file:archive.history_timeline', code: 'UNREACHABLE', severity: 'warning',
      title: '這段故事可能永遠看不到', message: '目前沒有找到可以抵達這段故事的路徑。',
      nodeIds: ['file:archive.history_timeline'], edgeIds: [], technical: {}
    }];
    await route.fulfill({ response, json: model });
  });

  await page.goto('/author/reveal-graph');
  await page.getByRole('button', { name: /這段故事可能永遠看不到/ }).click();
  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toHaveClass(/is-selected/);
  await expect(page.locator('[data-story-map-inspector]')).toContainText('目前沒有找到可以抵達這段故事的路徑');
});
```

- [ ] **Step 7: Render diagnostics summary/buttons and implement focus behavior**

Render each diagnostic into `[data-story-map-diagnostics]` as a `<button>` whose accessible name begins with `diagnostic.title`; show `diagnostic.code` only as secondary text. On click:

```js
function focusDiagnostic(issue) {
  state.filters = { viewpoint: 'all', stage: 'all', storyType: 'all', diagnosticsOnly: false };
  state.selectedNodeId = issue.nodeIds?.[0] || null;
  renderCurrentView();
  if (!state.selectedNodeId) return;
  const node = state.model.nodes.find(item => item.id === state.selectedNodeId);
  if (!node) return;
  document.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`)?.classList.add('is-selected');
  renderInspector(node, state.model, issue);
}
```

Diagnostics-only mode keeps nodes named by diagnostics and edges directly connecting retained nodes; it does not infer new story paths.

- [ ] **Step 8: Run focused E2E and complete verification**

```bash
npx playwright test test/e2e/authorRevealGraph.spec.js
npm run validate:content
npm test
npm run test:e2e
npm run check
```

Expected: all commands PASS.

- [ ] **Step 9: Verify no second ending source of truth or graph dependency was introduced**

```bash
grep -R "verifiedDifferences\|aSolo =\|bSolo =\|cooperativeFacts" game/authoring routes public/js/authorRevealGraph.js || true
grep -R "cytoscape\|d3\|mermaid\|graphviz" package.json package-lock.json game/authoring public/js public/css || true
```

Expected: no copied ending-resolution implementation and no newly added graph-library dependency. Display-only ending IDs/titles are allowed.

- [ ] **Step 10: Commit Task 6**

```bash
git add public/js/authorRevealGraph.js public/css/authorRevealGraph.css test/e2e/authorRevealGraph.spec.js game/authoring/storyGraphMetadata.js
git commit -m "feat: add story map filters inspector and diagnostics"
```

---

## Completion Criteria

```text
[ ] Default map is understandable without canonical IDs.
[ ] A/B/shared/ECHO information asymmetry is visible through swimlanes.
[ ] Human stage names run from 進入實驗 through 結果.
[ ] Core reveal spine has authored human labels; missing metadata has readable fallback labels.
[ ] Canonical IDs, source files, hidden predicates, and technical paths remain inspectable on demand.
[ ] all/any/not semantics and reaction guards are preserved internally.
[ ] Facts/gates/completion nodes are hidden from simple mode.
[ ] All seven specified structural diagnostics exist with human-first messages.
[ ] Explicit sharing actions do not create false audience-leak warnings.
[ ] Exact ending resolution is labeled runtime-calculated; ending precedence is not duplicated.
[ ] HTML and JSON author routes return 404 in production.
[ ] Graph-build failure and empty graph data keep the author page usable.
[ ] Graph generation does not mutate canonical content or gameplay state.
[ ] No new graph library dependency is introduced.
[ ] npm run check passes.
```
