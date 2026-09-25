# Author Reveal Graph Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a development/test-only, read-only ORPHEUS Story Map that derives the existing game content into a human-readable A/B/shared/ECHO reveal flow with diagnostics and technical drill-down.

**Architecture:** A pure server-side adapter derives a technical graph from canonical content, a presentation layer collapses implementation-only facts into human story nodes, and a diagnostics layer reports structural problems without mutating game state. Express exposes the resulting model only outside production; an EJS + vanilla JavaScript + SVG viewer renders deterministic reveal-stage columns and A/B/shared/ECHO swimlanes.

**Tech Stack:** Node.js >=20, CommonJS, Express 4, EJS, vanilla JavaScript, SVG, CSS, `node:test`, `node:assert/strict`, Playwright 1.63. No new graph dependency.

**Spec:** `docs/superpowers/specs/2026-09-26-author-reveal-graph-viewer-design.md`

## Global Constraints

- The existing game content remains the only gameplay source of truth.
- The viewer is read-only and must never mutate content modules, room state, ending state, or player-visible gameplay behavior.
- Default presentation is human story language; canonical IDs and predicates are secondary technical details.
- Author routes return 404 when `app.get('env') === 'production'`.
- V1 uses EJS, CSS, vanilla JavaScript, and SVG; do not add Cytoscape, D3, Mermaid, Graphviz, or another graph library.
- Do not duplicate `game/endingEngine.js` ending precedence or encode a second ending-condition table.
- Do not infer gameplay logic by scraping prose.
- Complex `all` / `any` / `not` predicates must preserve the same semantics already used by `game/content/contentSchema.js`.
- The existing `npm run check` suite must continue to pass.

## Review Focus

- Deeply nested predicates and one-time reaction guards must remain inspectable without creating misleading visible story nodes; Task 1 pins nested `all`/`any`/`not` behavior.
- Missing presentation metadata must fall back to deterministic readable labels instead of blank cards or crashes; Task 2 pins fallback behavior.
- Private A/B dependencies must not be reported as leaks when an explicit sharing action returns information to the shared path; Task 3 pins both the true-positive and allowed-sharing cases.
- Production must not expose either HTML or JSON author endpoints even though the router is mounted in the app; Task 4 pins both routes to 404 in production mode.
- A sparse or malformed graph response must leave the viewer usable and show a human-readable partial-data message rather than throwing client-side; Task 5 pins empty/partial rendering and Task 6 verifies it in-browser.

---

## File Structure

Create focused modules with one responsibility each:

```text
game/authoring/storyGraph.js
  Canonical technical graph derivation. No UI labels beyond deterministic identity fields.

game/authoring/storyGraphPresentation.js
  Human labels, story categories, reveal stages, swimlane assignment, and simple-view edge collapsing.

game/authoring/storyGraphMetadata.js
  Presentation-only overrides. No gameplay conditions or ending precedence.

game/authoring/storyGraphDiagnostics.js
  Static graph checks and human-readable diagnostic messages.

routes/authorRoutes.js
  Development/test-only Story Map page and graph JSON routes.

views/author/revealGraph.ejs
  Page shell and accessible controls.

public/js/authorRevealGraph.js
  Fetch model, apply filters, deterministic SVG layout, inspector, technical-details toggle, diagnostic focus.

public/css/authorRevealGraph.css
  Readable story-map layout and responsive author-tool styling.

test/unit/authorStoryGraph.test.js
  Technical graph and presentation tests.

test/unit/authorStoryGraphDiagnostics.test.js
  Diagnostics tests.

test/integration/authorStoryGraphRoutes.test.js
  Environment isolation and API/page contract tests.

test/e2e/authorRevealGraph.spec.js
  Human-facing Story Map behavior.
```

Modify:

```text
app.js
  Mount the author router under `/author`.
```

---

### Task 1: Derive a canonical technical story graph

**Files:**
- Create: `game/authoring/storyGraph.js`
- Create: `test/unit/authorStoryGraph.test.js`
- Read/consume: `game/content/contentSchema.js`
- Read/consume: `game/content/terminalEntries.js`
- Read/consume: `game/content/dialogue.js`
- Read/consume: `game/content/operations.js`
- Read/consume: `game/content/endings.js`

**Interfaces:**
- Consumes: `content` and `isPredicateShapeValid` from `game/content/contentSchema.js`, plus `endings` from `game/content/endings.js`.
- Produces: `buildTechnicalStoryGraph({ contentBundle, endingCatalog }) -> { nodes, edges, stats }`.
- Produces: `normalizePredicate(predicate, ownerId) -> { gates, edges }` for testable recursive predicate normalization.
- Node IDs are namespaced: `fact:*`, `file:*`, `action:*`, `echo:*`, `gate:*`, `ending:*`.

- [ ] **Step 1: Write failing tests for namespaced nodes, effects, and simple predicates**

Add to `test/unit/authorStoryGraph.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { content } = require('../../game/content/contentSchema');
const { endings } = require('../../game/content/endings');
const {
  buildTechnicalStoryGraph,
  normalizePredicate
} = require('../../game/authoring/storyGraph');

test('builds namespaced file, action, echo, fact, and ending nodes', () => {
  const graph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const ids = new Set(graph.nodes.map(node => node.id));

  assert.ok(ids.has('file:archive.history_timeline'));
  assert.ok(ids.has('action:complete_main5'));
  assert.ok(ids.has('echo:echo.behavior.protocol_recheck'));
  assert.ok(ids.has('fact:main5Completed'));
  assert.ok(ids.has('ending:cooperative_escape'));
});

test('operation effects create causal edges without mutating canonical content', () => {
  const before = structuredClone(content.operations);
  const graph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });

  assert.ok(graph.edges.some(edge =>
    edge.from === 'action:complete_main5'
      && edge.to === 'fact:main5Completed'
      && edge.kind === 'PRODUCES'
  ));
  assert.ok(graph.edges.some(edge =>
    edge.from === 'action:complete_main5'
      && edge.to === 'file:log.a_partner_unknown_access'
      && edge.kind === 'UNLOCKS'
  ));
  assert.deepEqual(content.operations, before);
});

test('simple predicate points prerequisite state at its owner', () => {
  const normalized = normalizePredicate(
    { publicFact: 'main5Completed' },
    'file:archive.history_timeline'
  );

  assert.deepEqual(normalized.gates, []);
  assert.deepEqual(normalized.edges, [{
    from: 'fact:main5Completed',
    to: 'file:archive.history_timeline',
    kind: 'REQUIRES',
    polarity: 'positive',
    detail: null
  }]);
});
```

- [ ] **Step 2: Run the focused unit test and verify the module is missing**

Run:

```bash
node --test test/unit/authorStoryGraph.test.js
```

Expected: FAIL because `game/authoring/storyGraph.js` does not exist.

- [ ] **Step 3: Implement the minimal graph builder and leaf predicate normalizer**

Create `game/authoring/storyGraph.js` with these public shapes:

```js
const { isPredicateShapeValid } = require('../content/contentSchema');

function namespacedPredicateNode(predicate) {
  if (predicate.publicFact) return `fact:${predicate.publicFact}`;
  if (predicate.roleFact) return `roleFact:${predicate.roleFact}`;
  if (predicate.entryOpened) return `file:${predicate.entryOpened}`;
  if (predicate.actionAttempted) return `action:${predicate.actionAttempted}`;
  if (predicate.entryOpenedTimes) return `file:${predicate.entryOpenedTimes.entryId}`;
  if (predicate.reactionFactMissing) return `reaction:${predicate.reactionFactMissing}`;
  if (predicate.chapterAtLeast !== undefined) return `chapter:${predicate.chapterAtLeast}`;
  if (predicate.elapsedSinceMeaningfulAction !== undefined) {
    return `idle:${predicate.elapsedSinceMeaningfulAction}`;
  }
  return null;
}

function normalizePredicate(predicate, ownerId, path = 'unlock') {
  if (!isPredicateShapeValid(predicate)) {
    return { gates: [], edges: [], errors: [{ code: 'INVALID_PREDICATE', ownerId, predicate }] };
  }

  const leaf = namespacedPredicateNode(predicate);
  if (leaf) {
    const detail = predicate.entryOpenedTimes
      ? { atLeast: predicate.entryOpenedTimes.atLeast }
      : predicate.elapsedSinceMeaningfulAction !== undefined
        ? { milliseconds: predicate.elapsedSinceMeaningfulAction }
        : null;
    return {
      gates: [],
      edges: [{
        from: leaf,
        to: ownerId,
        kind: 'REQUIRES',
        polarity: predicate.reactionFactMissing ? 'negative' : 'positive',
        detail
      }],
      errors: []
    };
  }

  return { gates: [], edges: [], errors: [] };
}

function buildTechnicalStoryGraph({ contentBundle, endingCatalog }) {
  const nodes = [];
  const edges = [];

  for (const entry of contentBundle.terminalEntries || []) {
    nodes.push({
      id: `file:${entry.id}`,
      refId: entry.id,
      technicalType: 'FILE',
      audience: entry.audience,
      source: { module: 'game/content/terminalEntries.js', contentFile: entry.contentFile || null },
      raw: entry
    });
  }

  for (const operation of contentBundle.operations || []) {
    nodes.push({
      id: `action:${operation.operationId}`,
      refId: operation.operationId,
      technicalType: 'ACTION',
      source: { module: 'game/content/operations.js' },
      raw: operation
    });
    for (const fact of operation.effects?.publicFacts || []) {
      nodes.push({ id: `fact:${fact}`, refId: fact, technicalType: 'FACT', audience: { kind: 'both' } });
      edges.push({ from: `action:${operation.operationId}`, to: `fact:${fact}`, kind: 'PRODUCES' });
    }
    for (const entryId of operation.effects?.unlockEntryIds || []) {
      edges.push({ from: `action:${operation.operationId}`, to: `file:${entryId}`, kind: 'UNLOCKS' });
    }
  }

  for (const line of contentBundle.dialogue || []) {
    nodes.push({
      id: `echo:${line.id}`,
      refId: line.id,
      technicalType: 'ECHO',
      audience: line.audience,
      source: { module: 'game/content/dialogue.js' },
      raw: line
    });
  }

  for (const ending of Object.values(endingCatalog || {})) {
    nodes.push({
      id: `ending:${ending.id}`,
      refId: ending.id,
      technicalType: 'ENDING',
      source: { module: 'game/content/endings.js' },
      raw: ending
    });
  }

  // Deduplicate synthetic facts that are produced more than once.
  const byId = new Map(nodes.map(node => [node.id, node]));
  return {
    nodes: [...byId.values()],
    edges,
    stats: { nodes: byId.size, edges: edges.length }
  };
}

module.exports = { buildTechnicalStoryGraph, normalizePredicate };
```

Then extend `buildTechnicalStoryGraph()` so every entry, dialogue line, and operation `unlockWhen` contributes `normalizePredicate()` edges.

- [ ] **Step 4: Add failing recursive predicate tests**

Append:

```js
test('nested all and any predicates become explicit technical gates', () => {
  const normalized = normalizePredicate({
    all: [
      { publicFact: 'main1Completed' },
      { any: [
        { actionAttempted: 'share_roster' },
        { actionAttempted: 'warn_partner_first' }
      ] }
    ]
  }, 'echo:example');

  assert.equal(normalized.errors.length, 0);
  assert.ok(normalized.gates.some(gate => gate.operator === 'ALL'));
  assert.ok(normalized.gates.some(gate => gate.operator === 'ANY'));
  assert.ok(normalized.edges.some(edge => edge.from === 'fact:main1Completed'));
  assert.ok(normalized.edges.some(edge => edge.from === 'action:share_roster'));
  assert.ok(normalized.edges.some(edge => edge.from === 'action:warn_partner_first'));
});

test('not and one-time reaction guards preserve negative polarity', () => {
  const normalized = normalizePredicate({
    all: [
      { not: { publicFact: 'mainCompleted' } },
      { reactionFactMissing: 'echo.behavior.protocol_recheck' }
    ]
  }, 'echo:example');

  const negativeEdges = normalized.edges.filter(edge => edge.polarity === 'negative');
  assert.ok(negativeEdges.some(edge => edge.from === 'fact:mainCompleted'));
  assert.ok(negativeEdges.some(edge => edge.from === 'reaction:echo.behavior.protocol_recheck'));
});

test('entry-open count keeps its threshold as edge detail', () => {
  const normalized = normalizePredicate({
    entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 }
  }, 'echo:echo.behavior.protocol_recheck');

  assert.deepEqual(normalized.edges[0].detail, { atLeast: 3 });
});
```

- [ ] **Step 5: Run the recursive tests and verify they fail**

Run:

```bash
node --test test/unit/authorStoryGraph.test.js
```

Expected: FAIL on missing gate recursion / polarity propagation.

- [ ] **Step 6: Implement recursive `all` / `any` / `not` normalization**

Use deterministic gate IDs based on owner plus predicate path:

```js
function normalizePredicate(predicate, ownerId, path = 'unlock', inheritedPolarity = 'positive') {
  if (!isPredicateShapeValid(predicate)) {
    return { gates: [], edges: [], errors: [{ code: 'INVALID_PREDICATE', ownerId, predicate }] };
  }

  if (predicate.not !== undefined) {
    return normalizePredicate(
      predicate.not,
      ownerId,
      `${path}.not`,
      inheritedPolarity === 'positive' ? 'negative' : 'positive'
    );
  }

  const operator = Array.isArray(predicate.all) ? 'ALL' : Array.isArray(predicate.any) ? 'ANY' : null;
  if (operator) {
    const items = operator === 'ALL' ? predicate.all : predicate.any;
    const gateId = `gate:${ownerId}:${path}`;
    const gates = [{ id: gateId, operator, ownerId }];
    const edges = [{ from: gateId, to: ownerId, kind: 'REQUIRES', polarity: inheritedPolarity, detail: null }];
    const errors = [];

    items.forEach((item, index) => {
      const child = normalizePredicate(item, gateId, `${path}.${operator.toLowerCase()}.${index}`, inheritedPolarity);
      gates.push(...child.gates);
      edges.push(...child.edges);
      errors.push(...child.errors);
    });
    return { gates, edges, errors };
  }

  const leaf = namespacedPredicateNode(predicate);
  // Return leaf -> owner edge with inherited polarity and threshold/idle details.
  // Use the exact object shape asserted above.
}
```

Add gate nodes returned by predicate normalization to the technical graph with `technicalType: 'GATE'`.

- [ ] **Step 7: Run Task 1 tests and existing unit suite**

Run:

```bash
node --test test/unit/authorStoryGraph.test.js
npm run test:unit
```

Expected: all tests PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add game/authoring/storyGraph.js test/unit/authorStoryGraph.test.js
git commit -m "feat: derive canonical author story graph"
```

---

### Task 2: Convert the technical graph into a human-readable Story Map model

**Files:**
- Create: `game/authoring/storyGraphPresentation.js`
- Create: `game/authoring/storyGraphMetadata.js`
- Modify: `test/unit/authorStoryGraph.test.js`

**Interfaces:**
- Consumes: technical graph from `buildTechnicalStoryGraph()`.
- Produces: `buildStoryMapModel(technicalGraph, metadata) -> { nodes, edges, stages, lanes, stats }`.
- Produces presentation nodes with `{ id, refId, storyType, label, summary, audience, lane, stage, importance, source, technical }`.
- `storyGraphMetadata.js` exports presentation-only `{ nodes: { [canonicalId]: override } }`; no unlock or ending rules.

- [ ] **Step 1: Write failing presentation tests**

Append to `test/unit/authorStoryGraph.test.js`:

```js
const { storyGraphMetadata } = require('../../game/authoring/storyGraphMetadata');
const { buildStoryMapModel } = require('../../game/authoring/storyGraphPresentation');

test('simple Story Map hides implementation-only fact and gate nodes', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);

  assert.equal(story.nodes.some(node => node.technicalType === 'FACT'), false);
  assert.equal(story.nodes.some(node => node.technicalType === 'GATE'), false);
  assert.ok(story.nodes.some(node => node.refId === 'archive.history_timeline'));
});

test('known canonical IDs use human labels and stage names', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  const history = story.nodes.find(node => node.refId === 'archive.history_timeline');

  assert.equal(history.label, '找到 ORPHEUS 完整歷史');
  assert.equal(history.stage, 'R4');
  assert.equal(history.lane, 'shared');
});

test('missing metadata falls back to a deterministic readable label', () => {
  const technical = {
    nodes: [{
      id: 'action:verify_incident_timestamp',
      refId: 'verify_incident_timestamp',
      technicalType: 'ACTION',
      source: { module: 'game/content/operations.js' },
      raw: {}
    }],
    edges: [],
    stats: {}
  };
  const story = buildStoryMapModel(technical, { nodes: {} });

  assert.equal(story.nodes[0].label, 'Verify incident timestamp');
  assert.equal(story.nodes[0].storyType, 'ACTION');
});

test('A, B, both, and ECHO content map to stable swimlanes', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);

  assert.equal(story.nodes.find(node => node.refId === 'doc.a_survival_task_01').lane, 'A');
  assert.equal(story.nodes.find(node => node.refId === 'doc.b_survival_task_01').lane, 'B');
  assert.equal(story.nodes.find(node => node.refId === 'archive.history_timeline').lane, 'shared');
  assert.equal(story.nodes.find(node => node.refId === 'echo.behavior.protocol_recheck').lane, 'ECHO');
});
```

- [ ] **Step 2: Run tests and verify presentation modules are missing**

Run:

```bash
node --test test/unit/authorStoryGraph.test.js
```

Expected: FAIL because presentation modules do not exist.

- [ ] **Step 3: Add presentation-only metadata for the core reveal spine**

Create `game/authoring/storyGraphMetadata.js`:

```js
const storyGraphMetadata = Object.freeze({
  nodes: Object.freeze({
    'file:archive.history_timeline': Object.freeze({
      label: '找到 ORPHEUS 完整歷史',
      summary: '玩家取得 Unit 17 與過往研究的完整時間線。',
      storyType: 'DISCOVERY',
      stage: 'R4',
      importance: 'major'
    }),
    'action:request_solo_validation': Object.freeze({
      label: 'A 選擇個人存續驗證',
      summary: 'A 開始接受 ECHO 提出的個體存續框架。',
      storyType: 'ACTION',
      stage: 'R5',
      importance: 'major'
    }),
    'echo:echo.behavior.reject_frame.a': Object.freeze({
      label: 'ECHO 注意到 A 拒絕個人框架',
      summary: 'A 看見較短的個人路徑後仍回到共同覆核。',
      storyType: 'ECHO',
      stage: 'R5',
      importance: 'major'
    })
  })
});

module.exports = { storyGraphMetadata };
```

During implementation, extend this same object only for high-value story nodes that need authored labels. Do not add gameplay conditions.

- [ ] **Step 4: Implement deterministic fallback labels, lanes, story types, and stage propagation**

Create `game/authoring/storyGraphPresentation.js` around these helpers:

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

function audienceLane(node) {
  if (node.technicalType === 'ECHO') return 'ECHO';
  if (node.audience?.kind === 'role') return node.audience.role === 'host' ? 'A' : 'B';
  if (node.audience?.kind === 'player') return node.audience.player === 'A' ? 'A' : 'B';
  return 'shared';
}

function defaultStoryType(node) {
  if (node.technicalType === 'FILE') return 'DISCOVERY';
  if (node.technicalType === 'ECHO') return 'ECHO';
  if (node.technicalType === 'ACTION') return 'ACTION';
  if (node.technicalType === 'ENDING') return 'ENDING';
  return null;
}

function buildStoryMapModel(technicalGraph, metadata = { nodes: {} }) {
  const visible = technicalGraph.nodes
    .filter(node => !['FACT', 'GATE'].includes(node.technicalType))
    .map(node => {
      const override = metadata.nodes?.[node.id] || {};
      return {
        id: node.id,
        refId: node.refId,
        technicalType: node.technicalType,
        storyType: override.storyType || defaultStoryType(node),
        label: override.label || humanizeId(node.refId),
        summary: override.summary || '',
        lane: override.lane || audienceLane(node),
        stage: override.stage || 'R0',
        importance: override.importance || 'normal',
        source: node.source || null,
        technical: { raw: node.raw || null }
      };
    });

  return { nodes: visible, edges: [], stages: STAGES, lanes: ['shared', 'A', 'B', 'ECHO'], stats: technicalGraph.stats };
}

module.exports = { buildStoryMapModel, humanizeId };
```

Then implement stage inference for the mainline chain rather than leaving every fallback at `R0`:

```text
roomCreated -> R0
main1Completed -> R1
main2Completed -> R2
main3Completed -> R3
main4Completed -> R4
main5Completed -> R5
mainCompleted/finale_ready/endings -> R6
```

Derive those milestone levels by reading `complete_mainN` operation outputs from the technical graph. Presentation metadata may override a node when its story meaning intentionally differs from the mechanical milestone.

- [ ] **Step 5: Collapse technical dependency chains into human edges**

Add tests:

```js
test('fact intermediates collapse into a direct human-readable story edge', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);

  assert.ok(story.edges.some(edge =>
    edge.to === 'file:archive.history_timeline'
      && edge.label === '解鎖'
      && !edge.from.startsWith('fact:')
  ));
});

test('ending nodes are marked runtime-calculated rather than given copied conditions', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  const ending = story.nodes.find(node => node.id === 'ending:cooperative_escape');

  assert.equal(ending.technical.endingResolution, 'runtime-calculated');
  assert.equal(ending.technical.condition, undefined);
});
```

Implement collapsing by following hidden FACT/GATE nodes between visible endpoints. Use a visited set to avoid cycles. Preserve a `technicalPath` array on each collapsed edge for inspector drill-down.

- [ ] **Step 6: Run Task 2 tests and full unit suite**

Run:

```bash
node --test test/unit/authorStoryGraph.test.js
npm run test:unit
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add game/authoring/storyGraphPresentation.js game/authoring/storyGraphMetadata.js test/unit/authorStoryGraph.test.js
git commit -m "feat: present story graph in human language"
```

---

### Task 3: Add structural story diagnostics with human-first messages

**Files:**
- Create: `game/authoring/storyGraphDiagnostics.js`
- Create: `test/unit/authorStoryGraphDiagnostics.test.js`
- Modify: `game/authoring/storyGraphPresentation.js`

**Interfaces:**
- Consumes: technical graph + presented Story Map.
- Produces: `runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle, endingCatalog }) -> Diagnostic[]`.
- Diagnostic shape: `{ id, code, severity, title, message, nodeIds, edgeIds, technical }`.
- Presentation model exposes `diagnostics` and summary counts; diagnostics never alter reachability or gameplay.

- [ ] **Step 1: Write failing tests for broken references and unreachable story content**

Create `test/unit/authorStoryGraphDiagnostics.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { content } = require('../../game/content/contentSchema');
const { endings } = require('../../game/content/endings');
const { buildTechnicalStoryGraph } = require('../../game/authoring/storyGraph');
const { buildStoryMapModel } = require('../../game/authoring/storyGraphPresentation');
const { runStoryGraphDiagnostics } = require('../../game/authoring/storyGraphDiagnostics');

function diagnosticsFor(contentBundle) {
  const technicalGraph = buildTechnicalStoryGraph({ contentBundle, endingCatalog: endings });
  const storyMap = buildStoryMapModel(technicalGraph, { nodes: {} });
  return runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle, endingCatalog: endings });
}

test('reports a missing entry reference in human language', () => {
  const broken = structuredClone(content);
  broken.operations.find(op => op.operationId === 'complete_main1')
    .effects.unlockEntryIds.push('missing.entry');

  const issue = diagnosticsFor(broken).find(item => item.code === 'BROKEN_REFERENCE');
  assert.ok(issue);
  assert.equal(issue.severity, 'error');
  assert.match(issue.message, /不存在|找不到/);
});

test('reports story content that has no reachable dependency path', () => {
  const broken = structuredClone(content);
  broken.terminalEntries.push({
    id: 'doc.unreachable',
    sourceEntryId: 'doc.unreachable',
    sourceGroup: 'test',
    audience: { kind: 'both' },
    unlockWhen: { publicFact: 'neverProduced' },
    verificationEntries: [],
    requiresPrivateFacts: [],
    mainlineFallbackOperationIds: [],
    debriefFactIds: [],
    kind: 'document',
    filename: 'unreachable.md',
    text: 'test'
  });

  const issue = diagnosticsFor(broken).find(item =>
    item.code === 'UNREACHABLE' && item.nodeIds.includes('file:doc.unreachable')
  );
  assert.ok(issue);
  assert.match(issue.message, /可能永遠看不到/);
});
```

- [ ] **Step 2: Run diagnostics tests and verify the module is missing**

Run:

```bash
node --test test/unit/authorStoryGraphDiagnostics.test.js
```

Expected: FAIL because the diagnostics module does not exist.

- [ ] **Step 3: Implement broken-reference and reachability checks**

Create `game/authoring/storyGraphDiagnostics.js`:

```js
function diagnostic(code, severity, title, message, nodeIds = [], technical = {}) {
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

function runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle, endingCatalog }) {
  const issues = [];
  const entryIds = new Set((contentBundle.terminalEntries || []).map(entry => entry.id));

  for (const operation of contentBundle.operations || []) {
    for (const entryId of operation.effects?.unlockEntryIds || []) {
      if (!entryIds.has(entryId)) {
        issues.push(diagnostic(
          'BROKEN_REFERENCE',
          'error',
          '故事引用失效',
          `這段故事引用了一個不存在的內容：${entryId}`,
          [`action:${operation.operationId}`],
          { missingRef: entryId }
        ));
      }
    }
  }

  // Build reachability from roomCreated and nodes with intentionally empty predicates.
  // Traverse positive technical edges only; negative guards do not create reachability.
  // Emit UNREACHABLE for visible story nodes that cannot be reached.

  return issues;
}

module.exports = { runStoryGraphDiagnostics };
```

Reuse the technical graph rather than re-evaluating game rules independently.

- [ ] **Step 4: Add failing audience-leak tests including the explicit-sharing exception**

Append:

```js
test('warns when shared content directly depends on A-only information', () => {
  const broken = structuredClone(content);
  const shared = broken.dialogue.find(line => line.id === 'orpheus.common_progress');
  shared.unlockWhen = { entryOpened: 'doc.a_survival_task_01' };

  const issue = diagnosticsFor(broken).find(item => item.code === 'AUDIENCE_LEAK');
  assert.ok(issue);
  assert.match(issue.message, /私人資訊|提前知道/);
});

test('does not call an explicit sharing action an audience leak', () => {
  const issues = diagnosticsFor(content);
  const falsePositive = issues.find(item =>
    item.code === 'AUDIENCE_LEAK'
      && item.technical?.viaAction === 'share_roster'
  );
  assert.equal(falsePositive, undefined);
});
```

Implement audience tracing so `share_roster`, `share_mirror_first`, `warn_partner_first`, `request_pair_validation`, and `disclose_report` act as explicit sharing boundaries because they are canonical actions already used by the narrative.

- [ ] **Step 5: Add debrief and ECHO verification tests**

Append:

```js
test('reports ending debrief facts that are absent from the debrief catalog', () => {
  const endingCatalog = structuredClone(endings);
  endingCatalog.cooperative_escape.debriefFactIds = ['missingDebriefFact'];
  const technicalGraph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog });
  const storyMap = buildStoryMapModel(technicalGraph, { nodes: {} });
  const issues = runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle: content, endingCatalog });

  assert.ok(issues.some(item => item.code === 'ENDING_DEBRIEF_GAP'));
});

test('flags factual ECHO observation without verification as advisory', () => {
  const broken = structuredClone(content);
  const line = broken.dialogue.find(item => item.id === 'orpheus.observation.a');
  line.verificationEntries = [];

  const issue = diagnosticsFor(broken).find(item =>
    item.code === 'MISSING_VERIFICATION' && item.nodeIds.includes('echo:orpheus.observation.a')
  );
  assert.ok(issue);
  assert.ok(['hint', 'warning'].includes(issue.severity));
});
```

Use `contentBundle.debrief` to validate ending `debriefFactIds`. Restrict missing-verification advice to dialogue intents `observation` and `manipulation`.

- [ ] **Step 6: Attach diagnostics to the Story Map model**

Add a composition function to `storyGraphPresentation.js` or a small exported helper:

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

Do not let diagnostic generation throw away an otherwise renderable graph; convert malformed optional presentation data into a graph-level diagnostic where possible.

- [ ] **Step 7: Run diagnostics and full unit suites**

Run:

```bash
node --test test/unit/authorStoryGraphDiagnostics.test.js
npm run test:unit
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add game/authoring/storyGraphDiagnostics.js game/authoring/storyGraphPresentation.js test/unit/authorStoryGraphDiagnostics.test.js
git commit -m "feat: add story graph diagnostics"
```

---

### Task 4: Expose the Story Map through development/test-only routes

**Files:**
- Create: `routes/authorRoutes.js`
- Create: `views/author/revealGraph.ejs`
- Create: `test/integration/authorStoryGraphRoutes.test.js`
- Modify: `app.js`

**Interfaces:**
- Produces: `createAuthorRoutes({ buildModel }) -> express.Router`.
- Page: `GET /author/reveal-graph`.
- JSON: `GET /author/api/reveal-graph`.
- Both call `next()` in production so existing HTML 404 handling remains authoritative.

- [ ] **Step 1: Write failing integration tests for test/development access**

Create `test/integration/authorStoryGraphRoutes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../../app');
const testServer = require('../helpers/testServer');

let runningServer;

test.before(async () => {
  runningServer = await testServer(app);
});

test.after(async () => {
  if (runningServer) await runningServer.close();
});

test('author Story Map page is available in test environment', async () => {
  const response = await fetch(`${runningServer.baseUrl}/author/reveal-graph`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /ORPHEUS Story Map/);
  assert.match(body, /進入實驗/);
});

test('author graph API returns human story nodes and technical detail', async () => {
  const response = await fetch(`${runningServer.baseUrl}/author/api/reveal-graph`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.nodes.some(node => node.label === '找到 ORPHEUS 完整歷史'));
  assert.ok(body.stages.some(stage => stage.label === '身分揭露'));
});
```

- [ ] **Step 2: Add failing production-isolation tests**

Append:

```js
test('production hides both author endpoints behind normal 404 behavior', async () => {
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

- [ ] **Step 3: Run integration test and verify routes are missing**

Run:

```bash
node --test test/integration/authorStoryGraphRoutes.test.js
```

Expected: FAIL with 404 for test-environment author routes.

- [ ] **Step 4: Implement `createAuthorRoutes()` and graph composition**

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
  const diagnostics = runStoryGraphDiagnostics({
    technicalGraph,
    storyMap,
    contentBundle: content,
    endingCatalog: endings
  });
  return attachDiagnostics(storyMap, diagnostics);
}

function createAuthorRoutes({ buildModel = defaultBuildModel } = {}) {
  const router = express.Router();

  router.use((request, response, next) => {
    if (request.app.get('env') === 'production') return next();
    return next('route');
  });

  // Use an explicit guard per route instead of relying on next('route') from router middleware.
  function authorOnly(request, response, next) {
    if (request.app.get('env') === 'production') return next('router');
    return next();
  }

  router.get('/reveal-graph', authorOnly, (request, response) => {
    response.render('author/revealGraph');
  });

  router.get('/api/reveal-graph', authorOnly, (request, response) => {
    response.json(buildModel());
  });

  return router;
}

module.exports = { createAuthorRoutes, defaultBuildModel };
```

When implementing, remove the illustrative `router.use()` block above and keep only the explicit `authorOnly` middleware so production behavior is unambiguous.

- [ ] **Step 5: Mount the router and create the minimal page shell**

Modify `app.js`:

```js
const { createAuthorRoutes } = require('./routes/authorRoutes');
```

Mount before the generic page router / 404 handlers:

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
    <nav aria-label="故事階段">
      <span>進入實驗</span>
      <span>建立合作</span>
      <span>產生矛盾</span>
      <span>ECHO 介入</span>
      <span>身分揭露</span>
      <span>選擇框架</span>
      <span>結果</span>
    </nav>
    <section data-story-map-status aria-live="polite">載入故事地圖…</section>
    <section data-story-map-root></section>
  </main>
  <script src="/public/js/authorRevealGraph.js" defer></script>
</body>
</html>
```

Task 5 will create the referenced CSS/JS assets.

- [ ] **Step 6: Run integration and full server-side tests**

Run:

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

### Task 5: Render the human-readable SVG swimlane map

**Files:**
- Create: `public/js/authorRevealGraph.js`
- Create: `public/css/authorRevealGraph.css`
- Modify: `views/author/revealGraph.ejs`
- Create: `test/e2e/authorRevealGraph.spec.js`

**Interfaces:**
- Browser loads `GET /author/api/reveal-graph`.
- Rendering entry point: `renderStoryMap(model, root)`.
- Pure helpers exported to `window.AuthorRevealGraph` for browser testing/debugging: `filterModel`, `layoutNodes`, `renderStoryMap`.
- Deterministic layout axes: columns = stages R0-R6; rows = `shared`, `A`, `B`, `ECHO`.

- [ ] **Step 1: Write the first failing Playwright test for readable content**

Create `test/e2e/authorRevealGraph.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test('Story Map loads human-readable reveal stages and story nodes', async ({ page }) => {
  await page.goto('/author/reveal-graph');

  await expect(page.getByRole('heading', { name: 'ORPHEUS Story Map' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A 視角' })).toBeVisible();
  await expect(page.getByText('找到 ORPHEUS 完整歷史')).toBeVisible();
  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toBeVisible();
});
```

- [ ] **Step 2: Run the focused E2E test and verify the interactive map is absent**

Run:

```bash
npx playwright test test/e2e/authorRevealGraph.spec.js
```

Expected: FAIL because filters/nodes have not been rendered.

- [ ] **Step 3: Expand the EJS shell with accessible filters and inspector landmarks**

Use controls with stable labels/data attributes:

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
  <label>
    故事階段
    <select data-stage-filter>
      <option value="all">全部</option>
      <option value="R0">進入實驗</option>
      <option value="R1">建立合作</option>
      <option value="R2">產生矛盾</option>
      <option value="R3">ECHO 介入</option>
      <option value="R4">身分揭露</option>
      <option value="R5">選擇框架</option>
      <option value="R6">結果</option>
    </select>
  </label>
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

- [ ] **Step 4: Implement resilient model loading and deterministic layout**

Create `public/js/authorRevealGraph.js` with:

```js
(() => {
  const LANE_ORDER = ['shared', 'A', 'B', 'ECHO'];
  const STAGE_ORDER = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'];

  function filterModel(model, filters = {}) {
    const nodes = model.nodes.filter(node => {
      if (filters.viewpoint && filters.viewpoint !== 'all' && node.lane !== filters.viewpoint) return false;
      if (filters.stage && filters.stage !== 'all' && node.stage !== filters.stage) return false;
      if (filters.storyType && filters.storyType !== 'all' && node.storyType !== filters.storyType) return false;
      return true;
    });
    const visibleIds = new Set(nodes.map(node => node.id));
    const edges = model.edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));
    return { ...model, nodes, edges };
  }

  function layoutNodes(model) {
    const counters = new Map();
    return model.nodes.map(node => {
      const stageIndex = Math.max(0, STAGE_ORDER.indexOf(node.stage));
      const laneIndex = Math.max(0, LANE_ORDER.indexOf(node.lane));
      const bucket = `${node.stage}:${node.lane}`;
      const offset = counters.get(bucket) || 0;
      counters.set(bucket, offset + 1);
      return {
        ...node,
        x: 160 + stageIndex * 260,
        y: 110 + laneIndex * 190 + offset * 76
      };
    });
  }

  function renderStoryMap(model, root) {
    const nodes = layoutNodes(model);
    if (!nodes.length) {
      root.innerHTML = '<p data-empty-story-map>這個篩選條件下沒有故事節點。</p>';
      return;
    }

    const width = 1900;
    const height = Math.max(820, ...nodes.map(node => node.y + 100));
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const paths = model.edges
      .map(edge => [edge, nodeById.get(edge.from), nodeById.get(edge.to)])
      .filter(([, from, to]) => from && to)
      .map(([edge, from, to]) => `
        <path class="story-edge" data-edge-kind="${edge.kind || ''}"
          d="M ${from.x + 170} ${from.y + 28} C ${from.x + 205} ${from.y + 28}, ${to.x - 35} ${to.y + 28}, ${to.x} ${to.y + 28}" />
      `).join('');

    const cards = nodes.map(node => `
      <g class="story-node" tabindex="0" role="button"
         data-story-node="${node.refId}" data-node-id="${node.id}"
         transform="translate(${node.x} ${node.y})">
        <rect width="170" height="58" rx="10"></rect>
        <text x="12" y="24">${escapeHtml(node.label)}</text>
        <text class="story-node-meta" x="12" y="43">${escapeHtml(node.stage)} · ${escapeHtml(node.lane)}</text>
      </g>
    `).join('');

    root.innerHTML = `<svg class="story-map-svg" viewBox="0 0 ${width} ${height}" aria-label="ORPHEUS 故事流程圖">${paths}${cards}</svg>`;
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function load() {
    const root = document.querySelector('[data-story-map-root]');
    const status = document.querySelector('[data-story-map-status]');
    try {
      const response = await fetch('/author/api/reveal-graph');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const model = await response.json();
      window.__AUTHOR_STORY_MAP_MODEL__ = model;
      renderStoryMap(model, root);
      status.textContent = `已載入 ${model.nodes.length} 段故事。`;
    } catch (error) {
      status.textContent = '部分故事資料無法解析。';
      root.innerHTML = '<p data-story-map-error>故事地圖目前無法完整載入，技術細節請查看開發者工具。</p>';
      console.error(error);
    }
  }

  window.AuthorRevealGraph = { filterModel, layoutNodes, renderStoryMap };
  window.addEventListener('DOMContentLoaded', load);
})();
```

Use DOM creation or escaping for every user/content-derived string. Do not concatenate unescaped authored prose into HTML.

- [ ] **Step 5: Add CSS for readable lanes and focus states**

Create `public/css/authorRevealGraph.css` with layout requirements rather than decorative complexity:

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color-scheme: dark;
}

body {
  margin: 0;
  background: #0d1016;
  color: #f4f6fb;
}

.story-map-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  min-height: 70vh;
}

.story-map-canvas {
  overflow: auto;
  border-block: 1px solid rgba(255, 255, 255, 0.12);
}

.story-map-inspector {
  padding: 20px;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
}

.story-map-svg {
  width: max(100%, 1500px);
  min-height: 760px;
}

.story-node rect {
  fill: #171c27;
  stroke: rgba(255, 255, 255, 0.24);
}

.story-node:focus rect,
.story-node:hover rect,
.story-node.is-selected rect {
  stroke-width: 2;
  stroke: currentColor;
}

.story-node text {
  fill: currentColor;
  font-size: 12px;
  pointer-events: none;
}

.story-node-meta {
  opacity: 0.65;
  font-size: 10px;
}

.story-edge {
  fill: none;
  stroke: rgba(255, 255, 255, 0.28);
  stroke-width: 1.5;
}

@media (max-width: 900px) {
  .story-map-workspace {
    grid-template-columns: 1fr;
  }

  .story-map-inspector {
    border-left: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }
}
```

Specific visual colors may be refined during implementation without changing the semantic layout; accessibility/focus contrast remains required.

- [ ] **Step 6: Pin sparse/partial model behavior in-browser**

Add a Playwright route override:

```js
test('partial graph data keeps the page usable', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      nodes: [],
      edges: [],
      stages: [],
      lanes: ['shared', 'A', 'B', 'ECHO'],
      diagnostics: [],
      stats: {}
    })
  }));

  await page.goto('/author/reveal-graph');
  await expect(page.getByText('這個篩選條件下沒有故事節點。')).toBeVisible();
});
```

- [ ] **Step 7: Run focused Story Map E2E**

Run:

```bash
npx playwright test test/e2e/authorRevealGraph.spec.js
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add public/js/authorRevealGraph.js public/css/authorRevealGraph.css views/author/revealGraph.ejs test/e2e/authorRevealGraph.spec.js
git commit -m "feat: render author story map swimlanes"
```

---

### Task 6: Add filtering, inspector, diagnostics focus, and technical drill-down

**Files:**
- Modify: `public/js/authorRevealGraph.js`
- Modify: `public/css/authorRevealGraph.css`
- Modify: `views/author/revealGraph.ejs`
- Modify: `test/e2e/authorRevealGraph.spec.js`
- Modify as needed after verification: `game/authoring/storyGraphMetadata.js`

**Interfaces:**
- Selecting a story node populates the inspector sections: `這是什麼？`, `玩家怎麼看到？`, `這會改變什麼？`, `後面可能發生？`.
- Technical details are collapsed by default and reveal canonical ID, source, audience, predicate path, operation effects, and raw edge kinds when available.
- Diagnostic controls focus/highlight related nodes; they never modify the graph.

- [ ] **Step 1: Write failing E2E tests for viewpoint/stage filtering**

Append:

```js
test('viewpoint and stage filters keep the story readable', async ({ page }) => {
  await page.goto('/author/reveal-graph');

  await page.getByRole('button', { name: 'A 視角' }).click();
  await expect(page.locator('[data-lane="B"]')).toHaveCount(0);

  await page.locator('[data-stage-filter]').selectOption('R4');
  await expect(page.getByText('找到 ORPHEUS 完整歷史')).toBeVisible();
});
```

Ensure rendered story nodes receive `data-lane` and `data-stage` attributes so the test checks semantic output rather than SVG coordinates.

- [ ] **Step 2: Write failing inspector and technical-details E2E tests**

Append:

```js
test('node inspector explains story meaning before technical implementation', async ({ page }) => {
  await page.goto('/author/reveal-graph');
  await page.locator('[data-story-node="archive.history_timeline"]').click();

  const inspector = page.locator('[data-story-map-inspector]');
  await expect(inspector.getByRole('heading', { name: '這是什麼？' })).toBeVisible();
  await expect(inspector.getByText(/ORPHEUS|Unit 17/)).toBeVisible();
  await expect(inspector.getByRole('button', { name: '顯示技術細節' })).toBeVisible();

  await inspector.getByRole('button', { name: '顯示技術細節' }).click();
  await expect(inspector.getByText('archive.history_timeline')).toBeVisible();
  await expect(inspector.getByText(/main5Completed/)).toBeVisible();
});
```

- [ ] **Step 3: Implement filter state and rerendering**

Add state and event handlers:

```js
const state = {
  model: null,
  filters: { viewpoint: 'all', stage: 'all', storyType: 'all' },
  selectedNodeId: null
};

function renderCurrentView() {
  const root = document.querySelector('[data-story-map-root]');
  const filtered = filterModel(state.model, state.filters);
  renderStoryMap(filtered, root);
  bindNodeInteractions(root);
}

function bindFilters() {
  document.querySelectorAll('[data-viewpoint]').forEach(button => {
    button.addEventListener('click', () => {
      state.filters.viewpoint = button.dataset.viewpoint;
      document.querySelectorAll('[data-viewpoint]').forEach(item => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      renderCurrentView();
    });
  });

  document.querySelector('[data-stage-filter]')?.addEventListener('change', event => {
    state.filters.stage = event.target.value;
    renderCurrentView();
  });
}
```

- [ ] **Step 4: Implement story-first inspector with technical details collapsed**

Add:

```js
function renderInspector(node, model) {
  const inspector = document.querySelector('[data-story-map-inspector]');
  const incoming = model.edges.filter(edge => edge.to === node.id);
  const outgoing = model.edges.filter(edge => edge.from === node.id);
  const later = outgoing
    .map(edge => model.nodes.find(candidate => candidate.id === edge.to))
    .filter(Boolean)
    .slice(0, 4);

  inspector.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = node.label;
  inspector.append(title);

  inspector.append(
    inspectorSection('這是什麼？', node.summary || '這是一個故事流程中的關鍵節點。'),
    inspectorSection('玩家怎麼看到？', humanIncoming(incoming, model)),
    inspectorSection('這會改變什麼？', humanOutgoing(outgoing, model)),
    inspectorSection('後面可能發生？', later.map(item => item.label).join('、') || '目前沒有更後面的可見故事節點。')
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

Implement `inspectorSection()` with DOM APIs and make `humanIncoming()` / `humanOutgoing()` prefer edge human labels such as `解鎖`, `因為看過`, `因為選擇`, `ECHO 注意到`, `帶回共同路徑`, `可能導向`.

- [ ] **Step 5: Add keyboard-equivalent node selection**

Bind both click and Enter/Space on SVG node groups:

```js
function bindNodeInteractions(root) {
  root.querySelectorAll('[data-node-id]').forEach(element => {
    const select = () => selectNode(element.dataset.nodeId);
    element.addEventListener('click', select);
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  });
}
```

Add E2E assertion using `.press('Enter')` on one node and verify inspector update.

- [ ] **Step 6: Write and implement diagnostic focus behavior**

Add E2E fixture:

```js
test('diagnostic selection explains the issue and focuses its story node', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', async route => {
    const response = await route.fetch();
    const model = await response.json();
    model.diagnostics = [{
      id: 'UNREACHABLE:file:archive.history_timeline',
      code: 'UNREACHABLE',
      severity: 'warning',
      title: '這段故事可能永遠看不到',
      message: '目前沒有找到可以抵達這段故事的路徑。',
      nodeIds: ['file:archive.history_timeline'],
      edgeIds: [],
      technical: {}
    }];
    await route.fulfill({ response, json: model });
  });

  await page.goto('/author/reveal-graph');
  await page.getByRole('button', { name: /這段故事可能永遠看不到/ }).click();

  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toHaveClass(/is-selected/);
  await expect(page.locator('[data-story-map-inspector]')).toContainText('目前沒有找到可以抵達這段故事的路徑');
});
```

Render diagnostics as buttons containing human title/message first, then a secondary technical code. Clicking one clears filters if necessary, selects the first related visible node, applies `.is-selected`, and shows the diagnostic message above the standard inspector sections.

- [ ] **Step 7: Add story-type and diagnostics-only controls**

Extend EJS:

```html
<label>
  類型
  <select data-story-type-filter>
    <option value="all">全部</option>
    <option value="DISCOVERY">發現</option>
    <option value="ECHO">ECHO</option>
    <option value="ACTION">行動</option>
    <option value="TRUTH">真相</option>
    <option value="ENDING">結局</option>
  </select>
</label>
<label>
  <input type="checkbox" data-diagnostics-only>
  只看需要注意的地方
</label>
```

When diagnostics-only is enabled, keep nodes listed in `diagnostic.nodeIds` plus direct connecting edges; do not invent new reachability.

- [ ] **Step 8: Run focused E2E and full project verification**

Run:

```bash
npx playwright test test/e2e/authorRevealGraph.spec.js
npm run validate:content
npm test
npm run test:e2e
npm run check
```

Expected: all commands PASS. `npm run check` is the final evidence before claiming implementation complete.

- [ ] **Step 9: Scan for accidental second sources of truth**

Run:

```bash
grep -R "cooperative_escape.*aRequested\|a_solo_escape.*aRequested\|verifiedDifferences" game/authoring routes public/js/authorRevealGraph.js || true
grep -R "Cytoscape\|cytoscape\|d3\|mermaid\|graphviz" package.json package-lock.json game/authoring public/js public/css || true
```

Expected:

```text
(no copied ending-resolution condition table)
(no newly added graph-library dependency)
```

References to ending IDs as display nodes are allowed; copied runtime predicates/precedence are not.

- [ ] **Step 10: Commit Task 6**

```bash
git add public/js/authorRevealGraph.js public/css/authorRevealGraph.css views/author/revealGraph.ejs test/e2e/authorRevealGraph.spec.js game/authoring/storyGraphMetadata.js
git commit -m "feat: add story map filters inspector and diagnostics"
```

---

## Completion Criteria

Implementation is complete only when all of the following are demonstrated by tests or direct inspection:

```text
[ ] /author/reveal-graph is readable by a human without knowing canonical IDs.
[ ] A/B/shared/ECHO information asymmetry is visible through stable swimlanes.
[ ] Reveal progression is organized by human stage names from 進入實驗 through 結果.
[ ] Core story nodes use human labels; missing optional metadata degrades to readable fallback labels.
[ ] Canonical IDs, predicate paths, and source files remain available through technical details.
[ ] Complex predicates preserve canonical all/any/not semantics internally.
[ ] Intermediate facts/gates are hidden in simple mode rather than overwhelming the map.
[ ] Diagnostics use human-first messages and do not rate story quality.
[ ] Explicit sharing actions do not trigger false private-information leak warnings.
[ ] Ending nodes are shown as runtime-resolved possibilities; ending precedence is not duplicated.
[ ] HTML and JSON author routes both return 404 in production mode.
[ ] Empty/partial graph data keeps the page usable.
[ ] No gameplay state or canonical content is mutated by graph generation.
[ ] No new graph library dependency is introduced.
[ ] npm run check passes.
```
