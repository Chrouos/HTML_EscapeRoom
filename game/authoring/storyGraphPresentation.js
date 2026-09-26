const STAGES = Object.freeze([
  { id: 'R0', label: '進入實驗', meaning: '我們被困在 Unit 17，需要理解眼前狀況' },
  { id: 'R1', label: '建立合作', meaning: '兩人資訊不完整，必須交換資訊' },
  { id: 'R2', label: '產生矛盾', meaning: '文件、時間或身份資訊開始互相衝突' },
  { id: 'R3', label: 'ECHO 介入', meaning: 'ECHO 顯示出超出一般助手的觀察與影響能力' },
  { id: 'R4', label: '身分揭露', meaning: 'A / B 與 ORPHEUS 實驗的真正身份逐漸被理解' },
  { id: 'R5', label: '選擇框架', meaning: '合作驗證與個體存續框架產生衝突' },
  { id: 'R6', label: '結果', meaning: '存續、共同覆核與 ECHO 解釋權形成結果' }
]);

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

const HIDDEN_TECHNICAL_TYPES = new Set([
  'FACT', 'ROLE_FACT', 'GATE', 'COMPLETION', 'CONTENT', 'MISSION',
  'ENDING_RESOLUTION', 'REACTION', 'IDLE', 'CHAPTER', 'INTERNAL'
]);

const EDGE_LABELS = Object.freeze({
  UNLOCKS: '解鎖',
  REQUIRES: '因為',
  OFFERS: '可以選擇',
  FALLBACK: '回到共同路徑',
  PRODUCES: '造成',
  PRODUCES_PRIVATE: '私下影響',
  RESOLVES: '進入結果判定',
  MAY_RESOLVE_TO: '可能導向',
  COMPLETES: '完成',
  APPENDS: '加入故事'
});

function fallbackLabel(value = '') {
  const raw = String(value).split(':').pop().replace(/[._-]+/g, ' ').trim();
  return raw ? raw[0].toUpperCase() + raw.slice(1) : 'Untitled';
}

function audienceLane(audience) {
  if (audience?.kind === 'role' && audience.role === 'host') return 'A';
  if (audience?.kind === 'role' && audience.role === 'guest') return 'B';
  return 'shared';
}

function laneFor(node, meta = {}) {
  if (meta.lane) return meta.lane;
  if (node.technicalType === 'ECHO') return 'ECHO';
  return audienceLane(node.audience);
}

function storyTypeFor(node, meta = {}) {
  if (meta.storyType) return meta.storyType;
  if (node.technicalType === 'ECHO') return 'ECHO';
  if (node.technicalType === 'ENDING') return 'ENDING';
  if (node.technicalType === 'ACTION') return 'ACTION';
  return 'DISCOVERY';
}

function isVisible(node, meta = {}) {
  if (meta.hidden === true) return false;
  if (meta.hidden === false || meta.label) return true;
  if (HIDDEN_TECHNICAL_TYPES.has(node.technicalType)) return false;
  if (node.technicalType === 'ENDING' || node.technicalType === 'ECHO') return true;
  if (node.technicalType === 'FILE') {
    if (node.raw?.kind === 'folder' || node.raw?.answerGate) return false;
    return true;
  }
  if (node.technicalType === 'ACTION') {
    return node.raw?.kind === 'private' || node.raw?.kind === 'neutral_finale';
  }
  return false;
}

function stageRank(stageId) {
  const rank = STAGES.findIndex(stage => stage.id === stageId);
  return rank < 0 ? 0 : rank;
}

function milestoneStageForNode(node) {
  if (node.id?.startsWith('fact:')) return MILESTONE_STAGE[node.refId] || null;
  if (node.id?.startsWith('completion:')) return MILESTONE_STAGE[node.refId] || null;
  return null;
}

function collectPrerequisites(graph, targetId) {
  const incoming = new Map();
  for (const edge of graph.edges || []) {
    const list = incoming.get(edge.to) || [];
    list.push(edge);
    incoming.set(edge.to, list);
  }

  const result = new Set();
  const seen = new Set();
  function visit(id) {
    if (seen.has(id)) return;
    seen.add(id);
    for (const edge of incoming.get(id) || []) {
      if (edge.kind !== 'REQUIRES') continue;
      const source = graph.nodes.find(node => node.id === edge.from);
      if (!source) continue;
      if (source.technicalType === 'GATE') visit(source.id);
      else result.add(source.id);
    }
  }
  visit(targetId);
  return [...result];
}

function inferStage(graph, node, meta = {}) {
  if (meta.stage) return meta.stage;
  if (node.technicalType === 'ENDING') return 'R6';
  const direct = milestoneStageForNode(node);
  if (direct) return direct;
  const prerequisites = collectPrerequisites(graph, node.id);
  let stage = 'R0';
  for (const id of prerequisites) {
    const source = graph.nodes.find(item => item.id === id);
    const candidate = source ? milestoneStageForNode(source) : null;
    if (candidate && stageRank(candidate) > stageRank(stage)) stage = candidate;
  }
  return stage;
}

function nodeSummary(node, meta) {
  if (meta.summary) return meta.summary;
  if (node.technicalType === 'ENDING') return node.raw?.text || '最終結果由 runtime ending engine 判定。';
  if (node.technicalType === 'ECHO') return node.raw?.variants?.[0] || 'ECHO 對玩家狀態做出反應。';
  if (node.technicalType === 'FILE') return node.raw?.text || node.raw?.filename || '玩家取得一份故事資料。';
  if (node.technicalType === 'ACTION') return '玩家做出一個會影響後續故事路徑的行動。';
  return '';
}

function technicalDetails(graph, node) {
  const prerequisites = collectPrerequisites(graph, node.id);
  const details = {
    canonicalId: node.id,
    refId: node.refId,
    source: node.source || null,
    audience: node.audience || null,
    prerequisites,
    rawType: node.technicalType
  };
  if (node.technicalType === 'ENDING') details.endingResolution = 'runtime-calculated';
  return details;
}

function collapseEdges(graph, visibleIds) {
  const adjacency = new Map();
  for (const edge of graph.edges || []) {
    const list = adjacency.get(edge.from) || [];
    list.push(edge);
    adjacency.set(edge.from, list);
  }

  const result = new Map();
  for (const sourceId of visibleIds) {
    const queue = (adjacency.get(sourceId) || []).map(edge => ({ edge, firstKind: edge.kind }));
    const seen = new Set();
    while (queue.length) {
      const { edge, firstKind } = queue.shift();
      const key = `${edge.to}:${firstKind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (visibleIds.has(edge.to)) {
        if (edge.to !== sourceId) {
          const id = `${sourceId}->${edge.to}:${firstKind}`;
          result.set(id, {
            id,
            from: sourceId,
            to: edge.to,
            kind: firstKind,
            label: EDGE_LABELS[firstKind] || '相關',
            technicalKinds: [firstKind, edge.kind].filter((item, index, arr) => arr.indexOf(item) === index)
          });
        }
        continue;
      }
      for (const next of adjacency.get(edge.to) || []) {
        queue.push({ edge: next, firstKind });
      }
    }
  }
  return [...result.values()];
}

function buildStoryMapModel(technicalGraph, metadata = {}) {
  const visibleTechnical = (technicalGraph.nodes || []).filter(node => isVisible(node, metadata[node.id] || {}));
  const nodes = visibleTechnical.map(node => {
    const meta = metadata[node.id] || {};
    return {
      id: node.id,
      refId: node.refId,
      technicalType: node.technicalType,
      storyType: storyTypeFor(node, meta),
      label: meta.label || (node.technicalType === 'ENDING' && node.raw?.title) || fallbackLabel(node.refId),
      summary: nodeSummary(node, meta),
      audience: node.audience || null,
      stage: inferStage(technicalGraph, node, meta),
      lane: laneFor(node, meta),
      importance: meta.importance || 'normal',
      technical: technicalDetails(technicalGraph, node)
    };
  });
  const visibleIds = new Set(nodes.map(node => node.id));
  const edges = collapseEdges(technicalGraph, visibleIds);

  return {
    nodes,
    edges,
    stages: STAGES.map(stage => ({ ...stage })),
    lanes: [
      { id: 'shared', label: '共同故事' },
      { id: 'A', label: 'A 視角' },
      { id: 'B', label: 'B 視角' },
      { id: 'ECHO', label: 'ECHO / 系統介入' }
    ],
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      technicalNodes: technicalGraph.nodes?.length || 0
    }
  };
}

module.exports = {
  STAGES,
  buildStoryMapModel,
  fallbackLabel
};
