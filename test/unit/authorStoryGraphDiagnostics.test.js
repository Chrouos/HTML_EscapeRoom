const test = require('node:test');
const assert = require('node:assert/strict');

const { content } = require('../../game/content/contentSchema');
const { endings } = require('../../game/content/endings');
const { buildTechnicalStoryGraph } = require('../../game/authoring/storyGraph');
const { buildStoryMapModel } = require('../../game/authoring/storyGraphPresentation');
const { storyGraphMetadata } = require('../../game/authoring/storyGraphMetadata');
const {
  diagnoseStoryGraph,
  DIAGNOSTIC_TITLES
} = require('../../game/authoring/storyGraphDiagnostics');

function cloneContent() {
  return structuredClone(content);
}

function codes(result) {
  return new Set(result.map(item => item.code));
}

test('broken authored references are reported in human language', () => {
  const bundle = cloneContent();
  bundle.operations.find(op => op.operationId === 'complete_main1').effects.unlockEntryIds.push('missing.story.entry');
  const result = diagnoseStoryGraph({ contentBundle: bundle, endingCatalog: endings });
  const broken = result.find(item => item.code === 'BROKEN_REFERENCE');
  assert.ok(broken);
  assert.equal(broken.title, '這段故事引用了一個不存在的內容');
  assert.match(broken.message, /missing\.story\.entry/);
});

test('an impossible public fact prerequisite is reported as unreachable', () => {
  const bundle = cloneContent();
  const entry = bundle.terminalEntries.find(item => item.id === 'archive.history_timeline');
  entry.unlockWhen = { publicFact: 'never_produced_fact' };
  const result = diagnoseStoryGraph({ contentBundle: bundle, endingCatalog: endings });
  assert.ok(result.some(item => item.code === 'UNREACHABLE' && item.nodeId === 'file:archive.history_timeline'));
});

test('isolated visible story content is reported without treating endings as orphans', () => {
  const result = diagnoseStoryGraph({
    contentBundle: { terminalEntries: [], operations: [], dialogue: [], privateMissions: [], debrief: [] },
    endingCatalog: {},
    storyMap: {
      nodes: [
        { id: 'file:isolated', refId: 'isolated', storyType: 'DISCOVERY', stage: 'R3', lane: 'shared' },
        { id: 'ending:ok', refId: 'ok', storyType: 'ENDING', stage: 'R6', lane: 'shared' }
      ],
      edges: []
    }
  });
  assert.ok(result.some(item => item.code === 'ORPHAN' && item.nodeId === 'file:isolated'));
  assert.equal(result.some(item => item.code === 'ORPHAN' && item.nodeId === 'ending:ok'), false);
});

test('private-to-shared edges warn unless the source is an explicit sharing action', () => {
  const base = {
    contentBundle: { terminalEntries: [], operations: [], dialogue: [], privateMissions: [], debrief: [] },
    endingCatalog: {}
  };
  const leaking = diagnoseStoryGraph({
    ...base,
    storyMap: {
      nodes: [
        { id: 'file:a.secret', refId: 'a.secret', storyType: 'DISCOVERY', stage: 'R2', lane: 'A' },
        { id: 'file:shared', refId: 'shared', storyType: 'DISCOVERY', stage: 'R2', lane: 'shared' }
      ],
      edges: [{ from: 'file:a.secret', to: 'file:shared', kind: 'REQUIRES' }]
    }
  });
  assert.ok(codes(leaking).has('AUDIENCE_LEAK'));

  const allowed = diagnoseStoryGraph({
    ...base,
    storyMap: {
      nodes: [
        { id: 'action:share_roster', refId: 'share_roster', storyType: 'ACTION', stage: 'R2', lane: 'B' },
        { id: 'file:shared', refId: 'shared', storyType: 'DISCOVERY', stage: 'R2', lane: 'shared' }
      ],
      edges: [{ from: 'action:share_roster', to: 'file:shared', kind: 'PRODUCES_PRIVATE' }]
    }
  });
  assert.equal(codes(allowed).has('AUDIENCE_LEAK'), false);
});

test('unsupported ECHO observations are advisory while entry-backed observations are not', () => {
  const bundle = cloneContent();
  bundle.dialogue.push({
    id: 'echo.test.unsupported',
    channel: 'direct',
    intent: 'observation',
    audience: { kind: 'role', role: 'host' },
    unlockWhen: { publicFact: 'main1Completed' },
    variants: ['ECHO test'],
    verificationEntries: [],
    sourceEntryId: 'echo.test.unsupported'
  });
  const result = diagnoseStoryGraph({ contentBundle: bundle, endingCatalog: endings });
  assert.ok(result.some(item => item.code === 'MISSING_VERIFICATION' && item.nodeId === 'echo:echo.test.unsupported'));

  const protocol = result.find(item => item.nodeId === 'echo:echo.protocol_versions.a' && item.code === 'MISSING_VERIFICATION');
  assert.equal(protocol, undefined);
});

test('ending debrief references must exist in the debrief catalog', () => {
  const badEndings = structuredClone(endings);
  badEndings.cooperative_escape.debriefFactIds.push('missing_fact');
  const result = diagnoseStoryGraph({ contentBundle: cloneContent(), endingCatalog: badEndings });
  assert.ok(result.some(item => item.code === 'ENDING_DEBRIEF_GAP' && item.nodeId === 'ending:cooperative_escape'));
});

test('verification evidence two or more reveal stages later is flagged as a possible early reveal', () => {
  const bundle = cloneContent();
  const source = bundle.terminalEntries.find(item => item.id === 'files.mainline');
  source.verificationEntries = [{ entryId: 'archive.history_timeline', sourceGroup: 'history_timeline' }];
  const technical = buildTechnicalStoryGraph({ contentBundle: bundle, endingCatalog: endings });
  const storyMap = buildStoryMapModel(technical, storyGraphMetadata);
  const result = diagnoseStoryGraph({ contentBundle: bundle, endingCatalog: endings, technicalGraph: technical, storyMap });
  assert.ok(result.some(item => item.code === 'SUSPICIOUS_EARLY_REVEAL' && item.nodeId === 'file:files.mainline'));
});

test('diagnostic catalog keeps the agreed human-first titles', () => {
  assert.deepEqual(DIAGNOSTIC_TITLES, {
    BROKEN_REFERENCE: '這段故事引用了一個不存在的內容',
    UNREACHABLE: '這段故事可能永遠看不到',
    ORPHAN: '這段內容和其他故事節點沒有明確關係',
    AUDIENCE_LEAK: '私人資訊可能被另一方提前知道',
    MISSING_VERIFICATION: 'ECHO 說了一件目前沒有證據支持的事',
    ENDING_DEBRIEF_GAP: '這個結局提到的事實沒有找到可追溯來源',
    SUSPICIOUS_EARLY_REVEAL: '這份資訊可能比預期更早揭露後期真相'
  });
});
