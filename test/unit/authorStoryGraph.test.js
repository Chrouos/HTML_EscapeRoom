const test = require('node:test');
const assert = require('node:assert/strict');

const { content } = require('../../game/content/contentSchema');
const { endings } = require('../../game/content/endings');
const {
  buildTechnicalStoryGraph,
  normalizePredicate
} = require('../../game/authoring/storyGraph');
const {
  buildStoryMapModel,
  fallbackLabel
} = require('../../game/authoring/storyGraphPresentation');
const { storyGraphMetadata } = require('../../game/authoring/storyGraphMetadata');

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

test('ALL and ANY become explicit gates', () => {
  const result = normalizePredicate({
    all: [
      { publicFact: 'main1Completed' },
      { any: [
        { actionAttempted: 'share_roster' },
        { actionAttempted: 'warn_partner_first' }
      ] }
    ]
  }, 'echo:example');
  assert.ok(result.gates.some(gate => gate.operator === 'ALL'));
  assert.ok(result.gates.some(gate => gate.operator === 'ANY'));
});

test('NOT remains an explicit gate around child logic', () => {
  const result = normalizePredicate({
    not: {
      all: [
        { publicFact: 'mainCompleted' },
        { actionAttempted: 'commit_finale' }
      ]
    }
  }, 'echo:example');
  const notGate = result.gates.find(gate => gate.operator === 'NOT');
  const allGate = result.gates.find(gate => gate.operator === 'ALL');
  assert.ok(notGate && allGate);
  assert.ok(result.edges.some(edge => edge.from === allGate.id && edge.to === notGate.id));
});

test('reaction guard is negative and thresholds retain detail', () => {
  assert.equal(
    normalizePredicate({ reactionFactMissing: 'echo.behavior.protocol_recheck' }, 'echo:x').edges[0].polarity,
    'negative'
  );
  assert.deepEqual(
    normalizePredicate({ entryOpenedTimes: { entryId: 'archive.protocol_versions', atLeast: 3 } }, 'echo:x').edges[0].detail,
    { atLeast: 3 }
  );
  assert.deepEqual(
    normalizePredicate({ elapsedSinceMeaningfulAction: 60000 }, 'echo:x').edges[0].detail,
    { milliseconds: 60000 }
  );
});

test('presentation exposes human stages and hides implementation-only nodes', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  assert.deepEqual(story.stages.map(stage => stage.label), [
    '進入實驗', '建立合作', '產生矛盾', 'ECHO 介入', '身分揭露', '選擇框架', '結果'
  ]);
  assert.equal(story.nodes.some(node => ['FACT', 'ROLE_FACT', 'GATE', 'COMPLETION', 'CONTENT'].includes(node.technicalType)), false);
  assert.equal(story.nodes.some(node => node.id.startsWith('fact:')), false);
});

test('important reveals use story language, stages, and A/B/ECHO swimlanes', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  const byRef = new Map(story.nodes.map(node => [node.refId, node]));

  assert.equal(byRef.get('archive.history_timeline').label, '找到 ORPHEUS 完整歷史');
  assert.equal(byRef.get('archive.history_timeline').stage, 'R4');
  assert.equal(byRef.get('archive.history_timeline').storyType, 'TRUTH');
  assert.equal(byRef.get('archive.history_timeline').lane, 'shared');

  assert.equal(byRef.get('doc.a_incident_report').lane, 'A');
  assert.equal(byRef.get('files.experiment_roster').lane, 'B');
  assert.equal(byRef.get('echo.behavior.protocol_recheck').lane, 'ECHO');
  assert.equal(byRef.get('request_solo_validation').label, 'A 選擇個人存續驗證');
});

test('technical prerequisites remain inspectable without becoming visible cards', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  const timeline = story.nodes.find(node => node.refId === 'archive.history_timeline');
  assert.ok(timeline.technical.prerequisites.includes('fact:main5Completed'));
  assert.equal(story.nodes.some(node => node.id === 'fact:main5Completed'), false);
});

test('ending cards stay human-readable and exact resolution remains runtime-calculated', () => {
  const technical = buildTechnicalStoryGraph({ contentBundle: content, endingCatalog: endings });
  const story = buildStoryMapModel(technical, storyGraphMetadata);
  const ending = story.nodes.find(node => node.refId === 'cooperative_escape');
  assert.equal(ending.storyType, 'ENDING');
  assert.equal(ending.stage, 'R6');
  assert.equal(ending.technical.endingResolution, 'runtime-calculated');
  assert.equal(Object.hasOwn(ending.technical, 'condition'), false);
});

test('fallback labels remain readable when presentation metadata is absent', () => {
  assert.equal(fallbackLabel('verify_incident_timestamp'), 'Verify incident timestamp');
  assert.equal(fallbackLabel('archive.history_timeline'), 'Archive history timeline');
});
