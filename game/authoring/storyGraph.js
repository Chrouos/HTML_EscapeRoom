const { isPredicateShapeValid } = require('../content/contentSchema');

const EFFECT_PREFIX = Object.freeze({
  publicFacts: 'fact',
  roleFacts: 'roleFact',
  unlockEntryIds: 'file',
  completeNodeIds: 'completion',
  appendContentIds: 'content'
});

const EFFECT_KIND = Object.freeze({
  publicFacts: 'PRODUCES',
  roleFacts: 'PRODUCES_PRIVATE',
  unlockEntryIds: 'UNLOCKS',
  completeNodeIds: 'COMPLETES',
  appendContentIds: 'APPENDS'
});

const PREFIX_TYPE = Object.freeze({
  fact: 'FACT',
  roleFact: 'ROLE_FACT',
  file: 'FILE',
  action: 'ACTION',
  echo: 'ECHO',
  mission: 'MISSION',
  gate: 'GATE',
  completion: 'COMPLETION',
  content: 'CONTENT',
  ending: 'ENDING',
  endingResolution: 'ENDING_RESOLUTION',
  reaction: 'REACTION',
  idle: 'IDLE',
  chapter: 'CHAPTER'
});

function addNode(map, node) {
  if (!map.has(node.id)) map.set(node.id, node);
}

function technicalTypeForId(id = '') {
  const prefix = String(id).split(':', 1)[0];
  return PREFIX_TYPE[prefix] || 'INTERNAL';
}

function addReferencedNode(map, id) {
  if (!id || map.has(id)) return;
  const separator = id.indexOf(':');
  const refId = separator >= 0 ? id.slice(separator + 1) : id;
  addNode(map, {
    id,
    refId,
    technicalType: technicalTypeForId(id)
  });
}

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
  if (!isPredicateShapeValid(predicate)) {
    return {
      gates: [],
      edges: [],
      errors: [{ code: 'INVALID_PREDICATE', ownerId, predicate }]
    };
  }

  if (predicate.not !== undefined) {
    const gate = {
      id: `gate:${ownerId}:${path}.not`,
      operator: 'NOT',
      ownerId
    };
    const child = normalizePredicate(predicate.not, gate.id, `${path}.not.child`);
    return {
      gates: [gate, ...child.gates],
      edges: [
        ...child.edges,
        { from: gate.id, to: ownerId, kind: 'REQUIRES', polarity: 'positive', detail: null }
      ],
      errors: child.errors
    };
  }

  const operator = Array.isArray(predicate.all)
    ? 'ALL'
    : Array.isArray(predicate.any)
      ? 'ANY'
      : null;

  if (operator) {
    const gate = {
      id: `gate:${ownerId}:${path}`,
      operator,
      ownerId
    };
    const gates = [gate];
    const edges = [
      { from: gate.id, to: ownerId, kind: 'REQUIRES', polarity: 'positive', detail: null }
    ];
    const errors = [];
    const items = operator === 'ALL' ? predicate.all : predicate.any;

    items.forEach((item, index) => {
      const child = normalizePredicate(item, gate.id, `${path}.${operator.toLowerCase()}.${index}`);
      gates.push(...child.gates);
      edges.push(...child.edges);
      errors.push(...child.errors);
    });

    return { gates, edges, errors };
  }

  const from = leafNode(predicate);
  if (!from) {
    return {
      gates: [],
      edges: [],
      errors: [{ code: 'UNKNOWN_PREDICATE', ownerId, predicate }]
    };
  }

  const detail = predicate.entryOpenedTimes
    ? { atLeast: predicate.entryOpenedTimes.atLeast }
    : predicate.elapsedSinceMeaningfulAction !== undefined
      ? { milliseconds: predicate.elapsedSinceMeaningfulAction }
      : null;
  const polarity = predicate.reactionFactMissing !== undefined ? 'negative' : 'positive';

  return {
    gates: [],
    edges: [{ from, to: ownerId, kind: 'REQUIRES', polarity, detail }],
    errors: []
  };
}

function attachPredicate(nodeMap, edges, errors, predicate, ownerId, path) {
  if (!predicate) return;
  const normalized = normalizePredicate(predicate, ownerId, path);

  for (const gate of normalized.gates) {
    addNode(nodeMap, {
      ...gate,
      refId: gate.id,
      technicalType: 'GATE'
    });
  }

  for (const edge of normalized.edges) {
    addReferencedNode(nodeMap, edge.from);
    addReferencedNode(nodeMap, edge.to);
    edges.push(edge);
  }

  errors.push(...normalized.errors);
}

function buildTechnicalStoryGraph({ contentBundle, endingCatalog }) {
  const nodeMap = new Map();
  const edges = [];
  const errors = [];
  const entries = contentBundle?.terminalEntries || [];
  const operations = contentBundle?.operations || [];
  const dialogue = contentBundle?.dialogue || [];
  const missions = contentBundle?.privateMissions || [];

  for (const entry of entries) {
    addNode(nodeMap, {
      id: `file:${entry.id}`,
      refId: entry.id,
      technicalType: 'FILE',
      audience: entry.audience,
      source: {
        module: 'game/content/terminalEntries.js',
        contentFile: entry.contentFile || null
      },
      raw: entry
    });
  }

  for (const operation of operations) {
    const actionId = `action:${operation.operationId}`;
    addNode(nodeMap, {
      id: actionId,
      refId: operation.operationId,
      technicalType: 'ACTION',
      source: { module: 'game/content/operations.js' },
      raw: operation
    });

    for (const family of Object.keys(EFFECT_PREFIX)) {
      for (const value of operation.effects?.[family] || []) {
        const id = `${EFFECT_PREFIX[family]}:${value}`;
        addReferencedNode(nodeMap, id);
        edges.push({
          from: actionId,
          to: id,
          kind: EFFECT_KIND[family],
          polarity: 'positive',
          detail: null
        });
      }
    }
  }

  for (const line of dialogue) {
    addNode(nodeMap, {
      id: `echo:${line.id}`,
      refId: line.id,
      technicalType: 'ECHO',
      audience: line.audience,
      source: { module: 'game/content/dialogue.js' },
      raw: line
    });
  }

  for (const mission of missions) {
    const missionId = `mission:${mission.id}`;
    addNode(nodeMap, {
      id: missionId,
      refId: mission.id,
      technicalType: 'MISSION',
      audience: mission.audience,
      source: { module: 'game/content/privateMissions.js' },
      raw: mission
    });

    for (const operationId of mission.operationIds || []) {
      const target = `action:${operationId}`;
      addReferencedNode(nodeMap, target);
      edges.push({ from: missionId, to: target, kind: 'OFFERS', polarity: 'positive', detail: null });
    }
    for (const fallbackId of mission.mainlineFallbackOperationIds || []) {
      const target = `action:${fallbackId}`;
      addReferencedNode(nodeMap, target);
      edges.push({ from: missionId, to: target, kind: 'FALLBACK', polarity: 'positive', detail: null });
    }
  }

  addNode(nodeMap, {
    id: 'endingResolution:runtime',
    refId: 'runtime',
    technicalType: 'ENDING_RESOLUTION',
    source: { module: 'game/endingEngine.js' }
  });

  if (operations.some(operation => operation.operationId === 'commit_finale')) {
    edges.push({
      from: 'action:commit_finale',
      to: 'endingResolution:runtime',
      kind: 'RESOLVES',
      polarity: 'positive',
      detail: null
    });
  }

  for (const ending of Object.values(endingCatalog || {})) {
    const endingId = `ending:${ending.id}`;
    addNode(nodeMap, {
      id: endingId,
      refId: ending.id,
      technicalType: 'ENDING',
      source: { module: 'game/content/endings.js' },
      raw: ending
    });
    edges.push({
      from: 'endingResolution:runtime',
      to: endingId,
      kind: 'MAY_RESOLVE_TO',
      polarity: 'positive',
      detail: null
    });
  }

  for (const entry of entries) {
    attachPredicate(nodeMap, edges, errors, entry.unlockWhen, `file:${entry.id}`, `entry.${entry.id}`);
  }
  for (const operation of operations) {
    attachPredicate(nodeMap, edges, errors, operation.unlockWhen, `action:${operation.operationId}`, `operation.${operation.operationId}`);
  }
  for (const line of dialogue) {
    attachPredicate(nodeMap, edges, errors, line.unlockWhen, `echo:${line.id}`, `dialogue.${line.id}`);
  }
  for (const mission of missions) {
    attachPredicate(nodeMap, edges, errors, mission.unlockWhen, `mission:${mission.id}`, `mission.${mission.id}`);
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
    errors,
    stats: {
      nodes: nodeMap.size,
      edges: edges.length
    }
  };
}

module.exports = {
  buildTechnicalStoryGraph,
  normalizePredicate
};
