# Author Reveal Graph Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a development/test-only, read-only ORPHEUS Story Map that turns canonical game content into a human-readable A/B/shared/ECHO reveal flow with structural diagnostics and optional technical drill-down.

**Architecture:** A pure server-side adapter derives a technical graph from current content modules, including private missions and a synthetic runtime-ending-resolution hub. A presentation layer collapses technical facts/gates/missions into human story nodes and edges. A diagnostics layer reports structural problems without changing game logic. Express exposes the model only outside production; EJS + vanilla JavaScript + SVG render deterministic reveal-stage columns and A/B/shared/ECHO swimlanes.

**Tech Stack:** Node.js >=20, CommonJS, Express 4, EJS, vanilla JavaScript, SVG, CSS, `node:test`, `node:assert/strict`, Playwright 1.63. No new graph dependency.

**Spec:** `docs/superpowers/specs/2026-09-26-author-reveal-graph-viewer-design.md`

## Global Constraints

- Existing game content is the only gameplay source of truth.
- Graph generation is pure/read-only and must not mutate content modules, room state, ending state, or player-visible behavior.
- Default presentation uses story language; canonical IDs, predicates, facts, mission lifecycle data, and source paths are secondary technical details.
- Both author endpoints return 404 when `app.get('env') === 'production'`.
- V1 uses EJS, CSS, vanilla JavaScript, and SVG; no Cytoscape, D3, Mermaid, Graphviz, or other graph dependency.
- Do not duplicate `game/endingEngine.js` precedence or copy its condition logic into metadata.
- The synthetic ending-resolution node represents only “runtime decides here”; it contains no ending conditions.
- Predicate structure preserves `all` / `any` / `not` semantics from `game/content/contentSchema.js`; `not` remains an explicit NOT gate.
- Do not infer gameplay logic by scraping prose.
- `npm run check` must remain green.

## Review Focus

- Nested predicate correctness: Task 1 pins ALL/ANY/NOT and reaction guards.
- Private mission structure: Task 1 pins mission → available action/fallback relationships instead of reconstructing them from prose.
- Human readability with incomplete metadata: Task 2 pins deterministic fallback labels.
- A/B privacy boundaries: Task 3 pins both true leaks and allowed share actions.
- Production and malformed-data isolation: Tasks 4–5 pin 404 and partial-data behavior.

---

## File Structure

```text
game/authoring/storyGraph.js
  Canonical technical graph derivation.

game/authoring/storyGraphPresentation.js
  Human labels, stages, lanes, hidden-node collapse.

game/authoring/storyGraphMetadata.js
  Presentation-only authored labels/summaries/stage overrides.

game/authoring/storyGraphDiagnostics.js
  Structural diagnostics with human-first messages.

routes/authorRoutes.js
views/author/revealGraph.ejs
public/js/authorRevealGraph.js
public/css/authorRevealGraph.css

test/unit/authorStoryGraph.test.js
test/unit/authorStoryGraphDiagnostics.test.js
test/integration/authorStoryGraphRoutes.test.js
test/e2e/authorRevealGraph.spec.js
```

Modify `app.js` only to mount the author router before generic page/404 handling.

---

### Task 1: Derive the canonical technical graph

**Files:**
- Create: `game/authoring/storyGraph.js`
- Create: `test/unit/authorStoryGraph.test.js`

**Interfaces:**
- Consumes: `content` + `isPredicateShapeValid` from `game/content/contentSchema.js`, `endings` from `game/content/endings.js`.
- Produces: `buildTechnicalStoryGraph({ contentBundle, endingCatalog }) -> { nodes, edges, stats, errors }`.
- Produces: `normalizePredicate(predicate, ownerId, path?) -> { gates, edges, errors }`.
- Namespaces include `fact:*`, `roleFact:*`, `file:*`, `action:*`, `echo:*`, `mission:*`, `gate:*`, `completion:*`, `content:*`, `endingResolution:runtime`, `ending:*`, `reaction:*`, `idle:*`, `chapter:*`.

- [ ] **Step 1: Write failing tests for canonical nodes, private missions, runtime ending hub, operation effects, and immutability**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { content } = require('../../game/content/contentSchema');
const { endings } = require('../../game/content/endings');
const { buildTechnicalStoryGraph, normalizePredicate } = require('../../game/authoring/storyGraph');

test('builds canonical story/internal nodes including missions and runtime ending hub', () => {
  const graph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const ids = new Set(graph.nodes.map(node => node.id));
  for (const id of [
    'file:archive.history_timeline',
    'action:complete_main5',
    'echo:echo.behavior.protocol_recheck',
    'mission:mission.a3.solo_validation',
    'fact:main5Completed',
    'roleFact:aRequestedSoloRoute',
    'endingResolution:runtime',
    'ending:cooperative_escape'
  ]) assert.ok(ids.has(id), `missing ${id}`);
});

test('private mission exposes its authored choices and fallback', () => {
  const graph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const has = (from, to, kind) => graph.edges.some(edge => edge.from === from && edge.to === to && edge.kind === kind);
  assert.ok(has('mission:mission.a3.solo_validation', 'action:request_solo_validation', 'OFFERS'));
  assert.ok(has('mission:mission.a3.solo_validation', 'action:request_pair_validation', 'OFFERS'));
  assert.ok(has('mission:mission.a3.solo_validation', 'action:pair_validate_protocol', 'FALLBACK'));
});

test('runtime ending hub connects final commitment to all endings without conditions', () => {
  const graph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  assert.ok(graph.edges.some(edge => edge.from === 'action:commit_finale' && edge.to === 'endingResolution:runtime' && edge.kind === 'RESOLVES'));
  for (const endingId of Object.keys(endings)) {
    assert.ok(graph.edges.some(edge => edge.from === 'endingResolution:runtime' && edge.to === `ending:${endingId}` && edge.kind === 'MAY_RESOLVE_TO'));
  }
  const resolver = graph.nodes.find(node => node.id === 'endingResolution:runtime');
  assert.equal(Object.hasOwn(resolver, 'condition'), false);
});

test('operation effects map to technical edges and generation is immutable', () => {
  const before = structuredClone(content);
  const graph = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const has = (from, to, kind) => graph.edges.some(edge => edge.from === from && edge.to === to && edge.kind === kind);
  assert.ok(has('action:complete_main5', 'fact:main5Completed', 'PRODUCES'));
  assert.ok(has('action:request_solo_validation', 'roleFact:aRequestedSoloRoute', 'PRODUCES_PRIVATE'));
  assert.ok(has('action:complete_main5', 'file:log.a_partner_unknown_access', 'UNLOCKS'));
  assert.ok(has('action:complete_main5', 'completion:main5Completed', 'COMPLETES'));
  assert.ok(has('action:commit_finale', 'content:neutral_finale', 'APPENDS'));
  assert.deepEqual(content, before);
});
```

- [ ] **Step 2: Run focused test and verify module-not-found**

```bash
node --test test/unit/authorStoryGraph.test.js
```

Expected: FAIL because `game/authoring/storyGraph.js` is absent.

- [ ] **Step 3: Implement node/effect/mission/ending-hub graph construction**

```js
const { isPredicateShapeValid } = require('../content/contentSchema');

function addNode(map, node) { if (!map.has(node.id)) map.set(node.id, node); }

const EFFECT_PREFIX = Object.freeze({
  publicFacts: 'fact', roleFacts: 'roleFact', unlockEntryIds: 'file',
  completeNodeIds: 'completion', appendContentIds: 'content'
});
const EFFECT_KIND = Object.freeze({
  publicFacts: 'PRODUCES', roleFacts: 'PRODUCES_PRIVATE', unlockEntryIds: 'UNLOCKS',
  completeNodeIds: 'COMPLETES', appendContentIds: 'APPENDS'
});

function buildTechnicalStoryGraph({ contentBundle, endingCatalog }) {
  const nodeMap = new Map();
  const edges = [];
  const errors = [];

  for (const entry of contentBundle.terminalEntries || []) {
    addNode(nodeMap, { id: `file:${entry.id}`, refId: entry.id, technicalType: 'FILE', audience: entry.audience, source: { module: 'game/content/terminalEntries.js', contentFile: entry.contentFile || null }, raw: entry });
  }

  for (const operation of contentBundle.operations || []) {
    const actionId = `action:${operation.operationId}`;
    addNode(nodeMap, { id: actionId, refId: operation.operationId, technicalType: 'ACTION', source: { module: 'game/content/operations.js' }, raw: operation });
    for (const family of Object.keys(EFFECT_PREFIX)) {
      for (const value of operation.effects?.[family] || []) {
        const id = `${EFFECT_PREFIX[family]}:${value}`;
        const type = { publicFacts: 'FACT', roleFacts: 'ROLE_FACT', unlockEntryIds: 'FILE', completeNodeIds: 'COMPLETION', appendContentIds: 'CONTENT' }[family];
        addNode(nodeMap, { id, refId: value, technicalType: type });
        edges.push({ from: actionId, to: id, kind: EFFECT_KIND[family], polarity: 'positive', detail: null });
      }
    }
  }

  for (const line of contentBundle.dialogue || []) {
    addNode(nodeMap, { id: `echo:${line.id}`, refId: line.id, technicalType: 'ECHO', audience: line.audience, source: { module: 'game/content/dialogue.js' }, raw: line });
  }

  for (const mission of contentBundle.privateMissions || []) {
    const missionId = `mission:${mission.id}`;
    addNode(nodeMap, { id: missionId, refId: mission.id, technicalType: 'MISSION', audience: mission.audience, source: { module: 'game/content/privateMissions.js' }, raw: mission });
    for (const operationId of mission.operationIds || []) edges.push({ from: missionId, to: `action:${operationId}`, kind: 'OFFERS', polarity: 'positive', detail: null });
    for (const fallbackId of mission.mainlineFallbackOperationIds || []) edges.push({ from: missionId, to: `action:${fallbackId}`, kind: 'FALLBACK', polarity: 'positive', detail: null });
  }

  addNode(nodeMap, { id: 'endingResolution:runtime', refId: 'runtime', technicalType: 'ENDING_RESOLUTION', source: { module: 'game/endingEngine.js' } });
  if ((contentBundle.operations || []).some(op => op.operationId === 'commit_finale')) {
    edges.push({ from: 'action:commit_finale', to: 'endingResolution:runtime', kind: 'RESOLVES', polarity: 'positive', detail: null });
  }
  for (const ending of Object.values(endingCatalog || {})) {
    addNode(nodeMap, { id: `ending:${ending.id}`, refId: ending.id, technicalType: 'ENDING', source: { module: 'game/content/endings.js' }, raw: ending });
    edges.push({ from: 'endingResolution:runtime', to: `ending:${ending.id}`, kind: 'MAY_RESOLVE_TO', polarity: 'positive', detail: null });
  }

  return { nodes: [...nodeMap.values()], edges, errors, stats: { nodes: nodeMap.size, edges: edges.length } };
}
```

- [ ] **Step 4: Add failing predicate tests that pin ALL/ANY/NOT and special leaves**

```js
test('ALL and ANY become explicit gates', () => {
  const result = normalizePredicate({ all: [{ publicFact: 'main1Completed' }, { any: [{ actionAttempted: 'share_roster' }, { actionAttempted: 'warn_partner_first' }] }] }, 'echo:example');
  assert.ok(result.gates.some(g => g.operator === 'ALL'));
  assert.ok(result.gates.some(g => g.operator === 'ANY'));
});

test('NOT remains an explicit gate around child logic', () => {
  const result = normalizePredicate({ not: { all: [{ publicFact: 'mainCompleted' }, { actionAttempted: 'commit_finale' }] } }, 'echo:example');
  const notGate = result.gates.find(g => g.operator === 'NOT');
  const allGate = result.gates.find(g => g.operator === 'ALL');
  assert.ok(notGate && allGate);
  assert.ok(result.edges.some(edge => edge.from === allGate.id && edge.to === notGate.id));
});

test('reaction guard is negative and thresholds retain detail', () => {
  assert.equal(normalizePredicate({ reactionFactMissing: 'echo.behavior.protocol_recheck' }, 'echo:x').edges[0].polarity, 'negative');
  assert.deepEqual(normalizePredicate({ entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } }, 'echo:x').edges[0].detail, { atLeast: 3 });
  assert.deepEqual(normalizePredicate({ elapsedSinceMeaningfulAction: 60000 }, 'echo:x').edges[0].detail, { milliseconds: 60000 });
});
```

- [ ] **Step 5: Implement predicate normalization and attach it to entries/dialogue/operations/missions**

```js
function leafNode(predicate) {
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

function normalizePredicate(predicate, ownerId, path = 'unlock') {
  if (!isPredicateShapeValid(predicate)) return { gates: [], edges: [], errors: [{ code: 'INVALID_PREDICATE', ownerId, predicate }] };
  if (predicate.not !== undefined) {
    const gate = { id: `gate:${ownerId}:${path}.not`, operator: 'NOT', ownerId };
    const child = normalizePredicate(predicate.not, gate.id, `${path}.not.child`);
    return { gates: [gate, ...child.gates], edges: [...child.edges, { from: gate.id, to: ownerId, kind: 'REQUIRES', polarity: 'positive', detail: null }], errors: child.errors };
  }
  const operator = Array.isArray(predicate.all) ? 'ALL' : Array.isArray(predicate.any) ? 'ANY' : null;
  if (operator) {
    const gate = { id: `gate:${ownerId}:${path}`, operator, ownerId };
    const gates = [gate];
    const edges = [{ from: gate.id, to: ownerId, kind: 'REQUIRES', polarity: 'positive', detail: null }];
    const errors = [];
    const items = operator === 'ALL' ? predicate.all : predicate.any;
    items.forEach((item, index) => {
      const child = normalizePredicate(item, gate.id, `${path}.${operator.toLowerCase()}.${index}`);
      gates.push(...child.gates); edges.push(...child.edges); errors.push(...child.errors);
    });
    return { gates, edges, errors };
  }
  const detail = predicate.entryOpenedTimes ? { atLeast: predicate.entryOpenedTimes.atLeast }
    : predicate.elapsedSinceMeaningfulAction !== undefined ? { milliseconds: predicate.elapsedSinceMeaningfulAction } : null;
  return { gates: [], edges: [{ from: leafNode(predicate), to: ownerId, kind: 'REQUIRES', polarity: predicate.reactionFactMissing !== undefined ? 'negative' : 'positive', detail }], errors: [] };
}
```

Apply to every `unlockWhen` in `terminalEntries`, `dialogue`, `operations`, and `privateMissions`. Add gates as `technicalType: 'GATE'`; add referenced leaf nodes when missing.

- [ ] **Step 6: Run Task 1 and commit**

```bash
node --test test/unit/authorStoryGraph.test.js
npm run test:unit
git add game/authoring/storyGraph.js test/unit/authorStoryGraph.test.js
git commit -m "feat: derive canonical author story graph"
```

Expected: tests PASS before commit.

---

### Task 2: Build the human-readable Story Map model

**Files:**
- Create: `game/authoring/storyGraphPresentation.js`
- Create: `game/authoring/storyGraphMetadata.js`
- Modify: `test/unit/authorStoryGraph.test.js`

**Interfaces:**
- Produces: `buildStoryMapModel(technicalGraph, metadata) -> { nodes, edges, stages, lanes, stats }`.
- Visible story types: `DISCOVERY`, `ECHO`, `ACTION`, `TRUTH`, `ENDING`.
- Hidden technical types: `FACT`, `ROLE_FACT`, `GATE`, `MISSION`, `COMPLETION`, `CONTENT`.
- `ENDING_RESOLUTION` is visible as an `ACTION` named `依完整紀錄判定結局`.

- [ ] **Step 1: Add failing presentation tests**

```js
const { storyGraphMetadata } = require('../../game/authoring/storyGraphMetadata');
const { buildStoryMapModel } = require('../../game/authoring/storyGraphPresentation');

test('simple map hides facts/gates/missions but shows runtime ending resolution', () => {
  const story = buildStoryMapModel(buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings }), storyGraphMetadata);
  assert.equal(story.nodes.some(node => ['FACT','ROLE_FACT','GATE','MISSION','COMPLETION','CONTENT'].includes(node.technicalType)), false);
  assert.equal(story.nodes.find(node => node.id === 'endingResolution:runtime').label, '依完整紀錄判定結局');
});

test('core reveal spine uses human labels/stages/lanes', () => {
  const story = buildStoryMapModel(buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings }), storyGraphMetadata);
  const byRef = new Map(story.nodes.map(node => [node.refId, node]));
  assert.equal(byRef.get('files.mainline').label, '讀到 Unit 17 案件摘要');
  assert.equal(byRef.get('files.experiment_roster').label, 'B 發現受試者名冊異常');
  assert.equal(byRef.get('doc.a_incident_report').lane, 'A');
  assert.equal(byRef.get('doc.b_incident_report').lane, 'B');
  assert.equal(byRef.get('archive.history_timeline').storyType, 'TRUTH');
  assert.equal(byRef.get('archive.history_timeline').stage, 'R4');
  assert.equal(byRef.get('request_solo_validation').stage, 'R5');
  assert.equal(byRef.get('cooperative_escape').stage, 'R6');
});

test('missing metadata has deterministic readable fallback', () => {
  const story = buildStoryMapModel({ nodes: [{ id: 'action:verify_incident_timestamp', refId: 'verify_incident_timestamp', technicalType: 'ACTION' }], edges: [], stats: {} }, { nodes: {} });
  assert.equal(story.nodes[0].label, 'Verify incident timestamp');
});
```

- [ ] **Step 2: Create human stage catalog and v1 core metadata**

```js
const storyGraphMetadata = Object.freeze({ nodes: Object.freeze({
  'file:files.mainline': { label: '讀到 Unit 17 案件摘要', summary: '兩名參與者先理解設施、事故與合作需求。', storyType: 'DISCOVERY', stage: 'R0', importance: 'major' },
  'file:files.experiment_roster': { label: 'B 發現受試者名冊異常', summary: 'B 看到名冊中的身份欄位曾被修改。', storyType: 'DISCOVERY', stage: 'R2', importance: 'major' },
  'file:doc.a_incident_report': { label: 'A 發現事故報告時間異常', summary: 'A 看到事故報告與其他時間證據不一致。', storyType: 'DISCOVERY', stage: 'R2', importance: 'major' },
  'file:doc.b_incident_report': { label: 'B 發現事故附件曾被更新', summary: 'B 發現附件版本晚於主索引。', storyType: 'DISCOVERY', stage: 'R2', importance: 'major' },
  'file:archive.protocol_versions': { label: '找到合作驗證規章修訂紀錄', summary: '玩家開始看見正式合作規則曾被修改。', storyType: 'DISCOVERY', stage: 'R3', importance: 'major' },
  'echo:echo.behavior.protocol_recheck': { label: 'ECHO 注意到你反覆確認規則', summary: 'ECHO 開始觀察玩家的查證習慣。', storyType: 'ECHO', stage: 'R3', importance: 'major' },
  'file:archive.history_timeline': { label: '找到 ORPHEUS 完整歷史', summary: '玩家取得 Unit 17 與過往研究的完整時間線，足以重新理解自己的身份。', storyType: 'TRUTH', stage: 'R4', importance: 'major' },
  'file:doc.a_solo_protocol': { label: 'A 看到個人存續協定', summary: 'A 清楚看見 ECHO 提供的個體存續框架。', storyType: 'DISCOVERY', stage: 'R5', importance: 'major' },
  'file:doc.b_solo_protocol': { label: 'B 看到個人存續協定', summary: 'B 看見可能把共同驗證拆成個體判定的路徑。', storyType: 'DISCOVERY', stage: 'R5', importance: 'major' },
  'action:request_solo_validation': { label: 'A 選擇個人存續驗證', summary: 'A 接受 ECHO 提出的個體存續路徑。', storyType: 'ACTION', stage: 'R5', importance: 'major' },
  'action:request_pair_validation': { label: 'A 把選擇帶回共同覆核', summary: 'A 拒絕只走個人路徑。', storyType: 'ACTION', stage: 'R5', importance: 'major' },
  'action:disclose_report': { label: 'B 公開完整報告給夥伴', summary: 'B 把可私藏的資訊帶回共同判斷。', storyType: 'ACTION', stage: 'R5', importance: 'major' },
  'action:pair_validate_protocol': { label: '兩人共同覆核協定', summary: '兩人用共同路徑檢查 ECHO 改寫後的規則。', storyType: 'ACTION', stage: 'R5', importance: 'major' },
  'endingResolution:runtime': { label: '依完整紀錄判定結局', summary: '遊戲在這裡依真正的 runtime 規則決定結果；Story Map 不複製判定條件。', storyType: 'ACTION', stage: 'R6', importance: 'major' },
  'ending:cooperative_escape': { label: '共同存續', storyType: 'ENDING', stage: 'R6', importance: 'major' },
  'ending:a_solo_escape': { label: 'A 的個別存續', storyType: 'ENDING', stage: 'R6', importance: 'major' },
  'ending:b_solo_escape': { label: 'B 的個別存續', storyType: 'ENDING', stage: 'R6', importance: 'major' },
  'ending:exposed_ai_deception': { label: '判定權被揭露', storyType: 'ENDING', stage: 'R6', importance: 'major' },
  'ending:ambiguous_containment': { label: '解釋權未移交', storyType: 'ENDING', stage: 'R6', importance: 'major' }
}) });
module.exports = { storyGraphMetadata };
```

- [ ] **Step 3: Implement stage/lane/fallback helpers**

```js
const STAGES = Object.freeze([
  { id: 'R0', label: '進入實驗' }, { id: 'R1', label: '建立合作' }, { id: 'R2', label: '產生矛盾' },
  { id: 'R3', label: 'ECHO 介入' }, { id: 'R4', label: '身分揭露' }, { id: 'R5', label: '選擇框架' }, { id: 'R6', label: '結果' }
]);
const MILESTONE_STAGE = Object.freeze({ roomCreated: 'R0', main1Completed: 'R1', main2Completed: 'R2', main3Completed: 'R3', main4Completed: 'R4', main5Completed: 'R5', mainCompleted: 'R6', finale_ready: 'R6' });
function humanizeId(refId = '') { return refId.replace(/^[^.]+\./, '').replace(/[._-]+/g, ' ').trim().replace(/^\w/, c => c.toUpperCase()); }
function laneFor(node) {
  if (node.technicalType === 'ECHO') return 'ECHO';
  if (node.audience?.kind === 'role') return node.audience.role === 'host' ? 'A' : 'B';
  if (node.audience?.kind === 'player') return node.audience.player === 'A' ? 'A' : 'B';
  return 'shared';
}
```

Infer fallback stage from positive prerequisite/effect paths anchored by `MILESTONE_STAGE`; presentation metadata may override mechanical stage.

- [ ] **Step 4: Add failing collapse/ending tests, then implement hidden-node collapse**

```js
test('hidden paths collapse into visible human edges and preserve technical path', () => {
  const story = buildStoryMapModel(buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings }), storyGraphMetadata);
  const history = story.nodes.find(node => node.refId === 'archive.history_timeline');
  const edge = story.edges.find(item => item.to === history.id);
  assert.equal(edge.label, '解鎖');
  assert.ok(Array.isArray(edge.technicalPath));
  assert.equal(story.edges.some(item => item.from.startsWith('fact:') || item.to.startsWith('fact:')), false);
});

test('runtime ending resolution stays connected but has no copied condition', () => {
  const story = buildStoryMapModel(buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings }), storyGraphMetadata);
  const resolver = story.nodes.find(node => node.id === 'endingResolution:runtime');
  assert.equal(resolver.technical.endingResolution, 'runtime-calculated');
  assert.equal(Object.hasOwn(resolver.technical, 'condition'), false);
  assert.ok(story.edges.some(edge => edge.from === 'endingResolution:runtime' && edge.to === 'ending:cooperative_escape'));
});
```

Collapse through hidden types with a visited set. Preserve `technicalPath`; if no visible upstream node exists, place raw prerequisite IDs under `node.technical.prerequisites` for the inspector.

- [ ] **Step 5: Run Task 2 and commit**

```bash
node --test test/unit/authorStoryGraph.test.js
npm run test:unit
git add game/authoring/storyGraphPresentation.js game/authoring/storyGraphMetadata.js test/unit/authorStoryGraph.test.js
git commit -m "feat: present author graph as human story map"
```

Expected: PASS before commit.

---

### Task 3: Add complete structural diagnostics

**Files:**
- Create: `game/authoring/storyGraphDiagnostics.js`
- Create: `test/unit/authorStoryGraphDiagnostics.test.js`
- Modify: `game/authoring/storyGraphPresentation.js`

**Interfaces:**
- `runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle, endingCatalog }) -> Diagnostic[]`.
- Required codes: `BROKEN_REFERENCE`, `UNREACHABLE`, `ORPHAN`, `AUDIENCE_LEAK`, `MISSING_VERIFICATION`, `ENDING_DEBRIEF_GAP`, `SUSPICIOUS_EARLY_REVEAL`.

- [ ] **Step 1: Write failing tests covering all seven diagnostic families**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { content } = require('../../game/content/contentSchema');
const { endings } = require('../../game/content/endings');
const { buildTechnicalStoryGraph } = require('../../game/authoring/storyGraph');
const { buildStoryMapModel } = require('../../game/authoring/storyGraphPresentation');
const { runStoryGraphDiagnostics } = require('../../game/authoring/storyGraphDiagnostics');

function diagnose(contentBundle = content, endingCatalog = endings) {
  const technicalGraph = buildTechnicalStoryGraph({ contentBundle, endingCatalog });
  const storyMap = buildStoryMapModel(technicalGraph, { nodes: {} });
  return runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle, endingCatalog });
}

test('BROKEN_REFERENCE checks operation, predicate, and verification refs', () => {
  const broken = structuredClone(content);
  broken.operations.find(op => op.operationId === 'complete_main1').effects.unlockEntryIds.push('missing.operation.entry');
  broken.dialogue[0].unlockWhen = { entryOpened: 'missing.predicate.entry' };
  broken.dialogue.find(line => line.id === 'orpheus.observation.a').verificationEntries = [{ entryId: 'missing.verification.entry', sourceGroup: 'raw_audio' }];
  const refs = diagnose(broken).filter(i => i.code === 'BROKEN_REFERENCE').map(i => i.technical.missingRef);
  assert.ok(refs.includes('missing.operation.entry') && refs.includes('missing.predicate.entry') && refs.includes('missing.verification.entry'));
});

test('UNREACHABLE and ORPHAN are distinguishable', () => {
  const broken = structuredClone(content);
  broken.terminalEntries.push({ id: 'doc.unreachable', sourceEntryId: 'doc.unreachable', sourceGroup: 'test', audience: { kind: 'both' }, unlockWhen: { publicFact: 'neverProduced' }, verificationEntries: [], requiresPrivateFacts: [], mainlineFallbackOperationIds: [], debriefFactIds: [], kind: 'document', filename: 'unreachable.md', text: 'test' });
  broken.terminalEntries.push({ id: 'doc.isolated', sourceEntryId: 'doc.isolated', sourceGroup: 'test', audience: { kind: 'both' }, unlockWhen: { all: [] }, verificationEntries: [], requiresPrivateFacts: [], mainlineFallbackOperationIds: [], debriefFactIds: [], kind: 'document', filename: 'isolated.md', text: 'test' });
  const issues = diagnose(broken);
  assert.ok(issues.some(i => i.code === 'UNREACHABLE' && i.nodeIds.includes('file:doc.unreachable')));
  assert.ok(issues.some(i => i.code === 'ORPHAN' && i.nodeIds.includes('file:doc.isolated')));
  assert.equal(issues.some(i => i.code === 'ORPHAN' && i.nodeIds.includes('file:files.mainline')), false);
});

test('AUDIENCE_LEAK warns direct private leak but allows authored share actions', () => {
  const broken = structuredClone(content);
  broken.dialogue.find(line => line.id === 'orpheus.common_progress').unlockWhen = { entryOpened: 'doc.a_survival_task_01' };
  assert.ok(diagnose(broken).some(i => i.code === 'AUDIENCE_LEAK'));
  const allowed = new Set(['share_roster','share_mirror_first','warn_partner_first','request_pair_validation','disclose_report']);
  assert.equal(diagnose(content).some(i => i.code === 'AUDIENCE_LEAK' && allowed.has(i.technical.viaAction)), false);
});

test('MISSING_VERIFICATION, ENDING_DEBRIEF_GAP, and SUSPICIOUS_EARLY_REVEAL fire correctly', () => {
  const noProof = structuredClone(content);
  noProof.dialogue.find(line => line.id === 'orpheus.observation.a').verificationEntries = [];
  assert.ok(diagnose(noProof).some(i => i.code === 'MISSING_VERIFICATION'));

  const badEndings = structuredClone(endings);
  badEndings.cooperative_escape.debriefFactIds = ['missingDebriefFact'];
  assert.ok(diagnose(content, badEndings).some(i => i.code === 'ENDING_DEBRIEF_GAP'));

  const early = structuredClone(content);
  early.terminalEntries.find(entry => entry.id === 'files.mainline').verificationEntries = [{ entryId: 'archive.history_timeline', sourceGroup: 'history_timeline' }];
  assert.ok(diagnose(early).some(i => i.code === 'SUSPICIOUS_EARLY_REVEAL' && i.severity === 'hint'));
});
```

- [ ] **Step 2: Implement human-first diagnostics**

```js
const HUMAN_TITLES = Object.freeze({
  BROKEN_REFERENCE: '這段故事引用了一個不存在的內容',
  UNREACHABLE: '這段故事可能永遠看不到',
  ORPHAN: '這段內容和其他故事節點沒有明確關係',
  AUDIENCE_LEAK: '私人資訊可能被另一方提前知道',
  MISSING_VERIFICATION: 'ECHO 說了一件目前沒有證據支持的事',
  ENDING_DEBRIEF_GAP: '這個結局提到的事實沒有找到可追溯來源',
  SUSPICIOUS_EARLY_REVEAL: '這份資訊可能比預期更早揭露後期真相'
});
function issue(code, severity, message, nodeIds = [], technical = {}) {
  return { id: `${code}:${nodeIds.join('|') || 'graph'}`, code, severity, title: HUMAN_TITLES[code], message, nodeIds, edgeIds: [], technical };
}
```

Rules:

```text
BROKEN_REFERENCE: validate unlockEntryIds, entryOpened/entryOpenedTimes refs, verificationEntries, and privateMission.operationIds/fallback IDs.
UNREACHABLE: positive traversal from initial/default content and roomCreated; negative guards never create reachability.
ORPHAN: visible node has no meaningful collapsed relationship; exclude intentional initial/default content and ending nodes.
AUDIENCE_LEAK: shared node depends directly on A/B-private input without one of the five canonical share actions.
MISSING_VERIFICATION: observation/manipulation dialogue with non-empty text and zero verificationEntries.
ENDING_DEBRIEF_GAP: ending.debriefFactIds missing from contentBundle.debrief by factId.
SUSPICIOUS_EARLY_REVEAL: verification target is >=2 reveal stages later; severity hint only.
```

- [ ] **Step 3: Attach diagnostics to the Story Map**

```js
function attachDiagnostics(storyMap, diagnostics) {
  return { ...storyMap, diagnostics, diagnosticSummary: diagnostics.reduce((sum, item) => { sum[item.severity] = (sum[item.severity] || 0) + 1; return sum; }, {}) };
}
```

Export from `storyGraphPresentation.js`.

- [ ] **Step 4: Run Task 3 and commit**

```bash
node --test test/unit/authorStoryGraphDiagnostics.test.js
npm run test:unit
git add game/authoring/storyGraphDiagnostics.js game/authoring/storyGraphPresentation.js test/unit/authorStoryGraphDiagnostics.test.js
git commit -m "feat: add human story graph diagnostics"
```

Expected: PASS before commit.

---

### Task 4: Expose development/test-only HTML and JSON routes

**Files:**
- Create: `routes/authorRoutes.js`
- Create: `views/author/revealGraph.ejs`
- Create: `test/integration/authorStoryGraphRoutes.test.js`
- Modify: `app.js`

- [ ] **Step 1: Write failing integration tests for normal access, production 404, and graph-build fallback**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const app = require('../../app');
const testServer = require('../helpers/testServer');
const { createAuthorRoutes } = require('../../routes/authorRoutes');

let server;
test.before(async () => { server = await testServer(app); });
test.after(async () => { if (server) await server.close(); });

test('author page/API exist in test environment', async () => {
  const page = await fetch(`${server.baseUrl}/author/reveal-graph`);
  const api = await fetch(`${server.baseUrl}/author/api/reveal-graph`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /ORPHEUS Story Map/);
  assert.equal(api.status, 200);
  assert.ok((await api.json()).nodes.some(node => node.label === '找到 ORPHEUS 完整歷史'));
});

test('production hides both endpoints', async () => {
  const original = app.get('env'); app.set('env', 'production');
  try {
    assert.equal((await fetch(`${server.baseUrl}/author/reveal-graph`)).status, 404);
    assert.equal((await fetch(`${server.baseUrl}/author/api/reveal-graph`)).status, 404);
  } finally { app.set('env', original); }
});

test('build failure returns a usable partial diagnostic model', async () => {
  const probe = express(); probe.set('env', 'test');
  probe.use('/author', createAuthorRoutes({ buildModel() { throw new Error('fixture graph failure'); } }));
  const probeServer = await testServer(probe);
  try {
    const response = await fetch(`${probeServer.baseUrl}/author/api/reveal-graph`);
    const model = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(model.nodes, []);
    assert.ok(model.diagnostics.some(item => item.code === 'GRAPH_BUILD_ERROR'));
  } finally { await probeServer.close(); }
});
```

- [ ] **Step 2: Implement route composition, fallback model, and production guard**

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
  return attachDiagnostics(storyMap, runStoryGraphDiagnostics({ technicalGraph, storyMap, contentBundle: content, endingCatalog: endings }));
}

function failedModel(error) {
  return {
    nodes: [], edges: [], lanes: ['shared','A','B','ECHO'], stats: {},
    stages: [{id:'R0',label:'進入實驗'},{id:'R1',label:'建立合作'},{id:'R2',label:'產生矛盾'},{id:'R3',label:'ECHO 介入'},{id:'R4',label:'身分揭露'},{id:'R5',label:'選擇框架'},{id:'R6',label:'結果'}],
    diagnostics: [{ id:'GRAPH_BUILD_ERROR:graph', code:'GRAPH_BUILD_ERROR', severity:'error', title:'部分故事資料無法解析', message:'部分故事資料無法解析；請查看技術細節確認內容格式。', nodeIds:[], edgeIds:[], technical:{ message:error.message } }]
  };
}

function createAuthorRoutes({ buildModel = defaultBuildModel } = {}) {
  const router = express.Router();
  const authorOnly = (request, response, next) => request.app.get('env') === 'production' ? next('router') : next();
  router.get('/reveal-graph', authorOnly, (request, response) => response.render('author/revealGraph'));
  router.get('/api/reveal-graph', authorOnly, (request, response) => {
    try { response.json(buildModel()); } catch (error) { response.json(failedModel(error)); }
  });
  return router;
}
module.exports = { createAuthorRoutes, defaultBuildModel, failedModel };
```

- [ ] **Step 3: Mount router and create minimal EJS shell**

In `app.js` add:

```js
const { createAuthorRoutes } = require('./routes/authorRoutes');
app.use('/author', createAuthorRoutes());
```

before generic page/404 routing.

Create `views/author/revealGraph.ejs`:

```html
<!doctype html><html lang="zh-Hant"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ORPHEUS Story Map</title><link rel="stylesheet" href="/css/authorRevealGraph.css">
</head><body data-author-story-map><main>
<header><h1>ORPHEUS Story Map</h1><p>玩家現在知道什麼、為什麼知道、誰知道，以及接下來可能發生什麼。</p></header>
<section data-story-map-status aria-live="polite">載入故事地圖…</section><section data-story-map-root></section>
</main><script src="/public/js/authorRevealGraph.js" defer></script></body></html>
```

- [ ] **Step 4: Run Task 4 and commit**

```bash
node --test test/integration/authorStoryGraphRoutes.test.js
npm test
git add routes/authorRoutes.js views/author/revealGraph.ejs app.js test/integration/authorStoryGraphRoutes.test.js
git commit -m "feat: expose development author story map"
```

Expected: PASS before commit.

---

### Task 5: Render deterministic SVG story swimlanes

**Files:**
- Create: `public/js/authorRevealGraph.js`
- Create: `public/css/authorRevealGraph.css`
- Modify: `views/author/revealGraph.ejs`
- Create: `test/e2e/authorRevealGraph.spec.js`

- [ ] **Step 1: Write failing E2E for human-readable map and empty-model fallback**

```js
const { test, expect } = require('@playwright/test');

test('Story Map loads human stages and story nodes', async ({ page }) => {
  await page.goto('/author/reveal-graph');
  await expect(page.getByRole('heading', { name: 'ORPHEUS Story Map' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A 視角' })).toBeVisible();
  await expect(page.getByText('找到 ORPHEUS 完整歷史')).toBeVisible();
  await expect(page.getByText('依完整紀錄判定結局')).toBeVisible();
});

test('empty graph keeps the page usable', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({nodes:[],edges:[],stages:[],lanes:['shared','A','B','ECHO'],diagnostics:[],stats:{}}) }));
  await page.goto('/author/reveal-graph');
  await expect(page.getByText('這個篩選條件下沒有故事節點。')).toBeVisible();
});
```

- [ ] **Step 2: Add accessible controls/canvas/inspector/diagnostics regions**

```html
<section class="story-map-toolbar" aria-label="Story Map 篩選器">
<fieldset><legend>視角</legend>
<button type="button" data-viewpoint="all" aria-pressed="true">全部</button><button type="button" data-viewpoint="A">A 視角</button><button type="button" data-viewpoint="B">B 視角</button><button type="button" data-viewpoint="shared">共同資訊</button><button type="button" data-viewpoint="ECHO">ECHO</button>
</fieldset>
<label>故事階段<select data-stage-filter><option value="all">全部</option><option value="R0">進入實驗</option><option value="R1">建立合作</option><option value="R2">產生矛盾</option><option value="R3">ECHO 介入</option><option value="R4">身分揭露</option><option value="R5">選擇框架</option><option value="R6">結果</option></select></label>
<label>類型<select data-story-type-filter><option value="all">全部</option><option value="DISCOVERY">發現</option><option value="ECHO">ECHO</option><option value="ACTION">行動</option><option value="TRUTH">真相</option><option value="ENDING">結局</option></select></label>
<label><input type="checkbox" data-diagnostics-only> 只看需要注意的地方</label>
</section>
<section class="story-map-workspace"><div class="story-map-canvas" data-story-map-root></div><aside class="story-map-inspector" data-story-map-inspector aria-live="polite"><h2>選擇一段故事</h2></aside></section>
<footer data-story-map-diagnostics></footer>
```

- [ ] **Step 3: Implement resilient loading, filtering, deterministic layout, and SVG rendering**

```js
const LANE_ORDER = ['shared','A','B','ECHO'];
const STAGE_ORDER = ['R0','R1','R2','R3','R4','R5','R6'];
function filterModel(model, filters = {}) {
  const diagnosticIds = new Set((model.diagnostics || []).flatMap(item => item.nodeIds || []));
  const nodes = (model.nodes || []).filter(node => (!filters.viewpoint || filters.viewpoint === 'all' || node.lane === filters.viewpoint) && (!filters.stage || filters.stage === 'all' || node.stage === filters.stage) && (!filters.storyType || filters.storyType === 'all' || node.storyType === filters.storyType) && (!filters.diagnosticsOnly || diagnosticIds.has(node.id)));
  const ids = new Set(nodes.map(node => node.id));
  return { ...model, nodes, edges:(model.edges || []).filter(edge => ids.has(edge.from) && ids.has(edge.to)) };
}
function layoutNodes(model) {
  const counters = new Map();
  return (model.nodes || []).map(node => { const s=Math.max(0,STAGE_ORDER.indexOf(node.stage)); const l=Math.max(0,LANE_ORDER.indexOf(node.lane)); const key=`${node.stage}:${node.lane}`; const o=counters.get(key)||0; counters.set(key,o+1); return {...node,x:160+s*290,y:110+l*190+o*76}; });
}
```

Render 220px-wide SVG cards with `data-node-id`, `data-story-node`, `data-lane`, `data-stage`, keyboard focus, escaped text, and curved edges. If `nodes.length === 0`, render `這個篩選條件下沒有故事節點。`. If fetch/JSON parsing fails, keep the shell and set status text to `部分故事資料無法解析。`.

- [ ] **Step 4: Add readable CSS and run E2E**

```css
:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color-scheme: dark; }
body { margin:0; background:#0d1016; color:#f4f6fb; }
.story-map-toolbar { display:flex; flex-wrap:wrap; gap:16px; padding:16px 20px; align-items:end; }
.story-map-workspace { display:grid; grid-template-columns:minmax(0,1fr) 340px; min-height:70vh; }
.story-map-canvas { overflow:auto; border-block:1px solid rgba(255,255,255,.12); }
.story-map-inspector { padding:20px; border-left:1px solid rgba(255,255,255,.12); }
.story-map-svg { width:max(100%,1700px); min-height:760px; }
.story-node rect { fill:#171c27; stroke:rgba(255,255,255,.24); }
.story-node:focus rect,.story-node:hover rect,.story-node.is-selected rect { stroke-width:2; stroke:currentColor; }
.story-node text { fill:currentColor; font-size:12px; pointer-events:none; }
.story-edge { fill:none; stroke:rgba(255,255,255,.28); stroke-width:1.5; }
@media (max-width:900px) { .story-map-workspace { grid-template-columns:1fr; } .story-map-inspector { border-left:0; border-top:1px solid rgba(255,255,255,.12); } }
```

Run:

```bash
npx playwright test test/e2e/authorRevealGraph.spec.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add public/js/authorRevealGraph.js public/css/authorRevealGraph.css views/author/revealGraph.ejs test/e2e/authorRevealGraph.spec.js
git commit -m "feat: render author story map swimlanes"
```

---

### Task 6: Add story-first inspector, filters, diagnostic focus, and technical drill-down

**Files:**
- Modify: `public/js/authorRevealGraph.js`
- Modify: `public/css/authorRevealGraph.css`
- Modify: `test/e2e/authorRevealGraph.spec.js`
- Modify only if an asserted core label is missing: `game/authoring/storyGraphMetadata.js`

- [ ] **Step 1: Add failing E2E for filters and story-first inspector**

```js
test('filters preserve story language', async ({ page }) => {
  await page.goto('/author/reveal-graph');
  await page.getByRole('button', { name:'A 視角' }).click();
  await expect(page.locator('[data-lane="B"]')).toHaveCount(0);
  await page.locator('[data-stage-filter]').selectOption('R4');
  await page.locator('[data-story-type-filter]').selectOption('TRUTH');
  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toBeVisible();
});

test('inspector explains story before technical detail and supports keyboard', async ({ page }) => {
  await page.goto('/author/reveal-graph');
  const node = page.locator('[data-story-node="archive.history_timeline"]');
  await node.focus(); await node.press('Enter');
  const inspector = page.locator('[data-story-map-inspector]');
  await expect(inspector.getByRole('heading',{name:'這是什麼？'})).toBeVisible();
  await expect(inspector.getByText(/ORPHEUS|Unit 17/)).toBeVisible();
  await inspector.getByRole('button',{name:'顯示技術細節'}).click();
  await expect(inspector.getByText('archive.history_timeline')).toBeVisible();
  await expect(inspector.getByText(/main5Completed/)).toBeVisible();
});
```

- [ ] **Step 2: Implement local state, filters, node selection, and four-part inspector**

```js
const state = { model:null, filters:{viewpoint:'all',stage:'all',storyType:'all',diagnosticsOnly:false}, selectedNodeId:null };
function section(titleText, bodyText) { const s=document.createElement('section'); const h=document.createElement('h3'); const p=document.createElement('p'); h.textContent=titleText; p.textContent=bodyText; s.append(h,p); return s; }
function renderInspector(node, model, diagnostic = null) {
  const inspector=document.querySelector('[data-story-map-inspector]');
  const incoming=model.edges.filter(e=>e.to===node.id); const outgoing=model.edges.filter(e=>e.from===node.id);
  const later=outgoing.map(e=>model.nodes.find(n=>n.id===e.to)).filter(Boolean).slice(0,4);
  inspector.replaceChildren(); if (diagnostic) inspector.append(section(diagnostic.title,diagnostic.message));
  inspector.append(section('這是什麼？',node.summary||'這是一個故事流程中的關鍵節點。'), section('玩家怎麼看到？',incoming.map(e=>e.label||'前置故事條件').join('、')||'從目前故事階段即可看到。'), section('這會改變什麼？',outgoing.map(e=>e.label||'影響後續流程').join('、')||'主要提供理解，不直接改變下一步。'), section('後面可能發生？',later.map(n=>n.label).join('、')||'目前沒有更後面的可見故事節點。'));
  const button=document.createElement('button'); const details=document.createElement('pre'); button.type='button'; button.textContent='顯示技術細節'; details.hidden=true; details.textContent=JSON.stringify({id:node.refId,source:node.source,stage:node.stage,lane:node.lane,technical:node.technical,incoming:incoming.map(e=>e.technicalPath||e.kind),outgoing:outgoing.map(e=>e.technicalPath||e.kind)},null,2); button.addEventListener('click',()=>{details.hidden=!details.hidden;button.textContent=details.hidden?'顯示技術細節':'隱藏技術細節';}); inspector.append(button,details);
}
```

Bind click + Enter/Space on `[data-node-id]`. Bind viewpoint/stage/type/diagnostics-only controls to `filterModel()` + rerender.

- [ ] **Step 3: Add failing E2E for diagnostic focus**

```js
test('diagnostic selection explains and focuses affected story node', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', async route => {
    const response=await route.fetch(); const model=await response.json();
    model.diagnostics=[{id:'UNREACHABLE:file:archive.history_timeline',code:'UNREACHABLE',severity:'warning',title:'這段故事可能永遠看不到',message:'目前沒有找到可以抵達這段故事的路徑。',nodeIds:['file:archive.history_timeline'],edgeIds:[],technical:{}}];
    await route.fulfill({response,json:model});
  });
  await page.goto('/author/reveal-graph');
  await page.getByRole('button',{name:/這段故事可能永遠看不到/}).click();
  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toHaveClass(/is-selected/);
  await expect(page.locator('[data-story-map-inspector]')).toContainText('目前沒有找到可以抵達這段故事的路徑');
});
```

- [ ] **Step 4: Implement diagnostic buttons/focus**

```js
function focusDiagnostic(issue) {
  state.filters={viewpoint:'all',stage:'all',storyType:'all',diagnosticsOnly:false};
  state.selectedNodeId=issue.nodeIds?.[0]||null; renderCurrentView();
  const node=state.model.nodes.find(item=>item.id===state.selectedNodeId); if (!node) return;
  document.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`)?.classList.add('is-selected');
  renderInspector(node,state.model,issue);
}
```

Render each diagnostic as a button whose accessible name starts with human `title`; show technical `code` as secondary text. Diagnostics-only mode retains nodes named by diagnostics plus direct edges between retained nodes.

- [ ] **Step 5: Run full verification and second-source scan**

```bash
npx playwright test test/e2e/authorRevealGraph.spec.js
npm run validate:content
npm test
npm run test:e2e
npm run check
grep -R "verifiedDifferences\|aSolo =\|bSolo =\|cooperativeFacts" game/authoring routes public/js/authorRevealGraph.js || true
grep -R "cytoscape\|d3\|mermaid\|graphviz" package.json package-lock.json game/authoring public/js public/css || true
```

Expected: all test commands PASS; grep shows no copied ending-resolution implementation and no added graph library.

- [ ] **Step 6: Commit Task 6**

```bash
git add public/js/authorRevealGraph.js public/css/authorRevealGraph.css test/e2e/authorRevealGraph.spec.js game/authoring/storyGraphMetadata.js
git commit -m "feat: add story map filters inspector and diagnostics"
```

---

## Completion Criteria

```text
[ ] Default map is understandable without canonical IDs.
[ ] A/B/shared/ECHO information asymmetry is visible through swimlanes.
[ ] Private mission choices come from privateMissions.js rather than prose inference.
[ ] Human stage names run from 進入實驗 through 結果.
[ ] Core reveal spine has authored human labels; missing metadata has readable fallback labels.
[ ] Canonical IDs, source files, hidden predicates, mission links, and technical paths remain inspectable on demand.
[ ] ALL/ANY/NOT semantics and reaction guards are preserved internally.
[ ] Facts/gates/missions/completion nodes are hidden from simple mode.
[ ] Runtime ending-resolution hub connects finale to all five endings without copied conditions.
[ ] All seven structural diagnostics exist with human-first messages.
[ ] Explicit sharing actions do not create false audience-leak warnings.
[ ] Both author endpoints return 404 in production.
[ ] Build failure and empty graph data keep the page usable.
[ ] Graph generation does not mutate canonical content or gameplay state.
[ ] No new graph dependency is introduced.
[ ] npm run check passes.
```
