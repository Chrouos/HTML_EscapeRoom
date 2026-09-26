const { buildTechnicalStoryGraph } = require('./storyGraph');
const { buildStoryMapModel } = require('./storyGraphPresentation');
const { storyGraphMetadata } = require('./storyGraphMetadata');

const DIAGNOSTIC_TITLES = Object.freeze({
  BROKEN_REFERENCE: '這段故事引用了一個不存在的內容',
  UNREACHABLE: '這段故事可能永遠看不到',
  ORPHAN: '這段內容和其他故事節點沒有明確關係',
  AUDIENCE_LEAK: '私人資訊可能被另一方提前知道',
  MISSING_VERIFICATION: 'ECHO 說了一件目前沒有證據支持的事',
  ENDING_DEBRIEF_GAP: '這個結局提到的事實沒有找到可追溯來源',
  SUSPICIOUS_EARLY_REVEAL: '這份資訊可能比預期更早揭露後期真相'
});

const SHARE_ACTIONS = new Set([
  'share_roster',
  'share_mirror_first',
  'warn_partner_first',
  'request_pair_validation',
  'disclose_report'
]);

const STAGE_RANK = Object.freeze({
  R0: 0,
  R1: 1,
  R2: 2,
  R3: 3,
  R4: 4,
  R5: 5,
  R6: 6
});

function diagnostic(code, severity, nodeId, message, relatedNodeIds = []) {
  return {
    code,
    severity,
    nodeId: nodeId || null,
    title: DIAGNOSTIC_TITLES[code] || code,
    message,
    relatedNodeIds: [...new Set(relatedNodeIds.filter(Boolean))]
  };
}

function collectPredicateLeaves(predicate, result = []) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) return result;
  if (Array.isArray(predicate.all)) {
    for (const item of predicate.all) collectPredicateLeaves(item, result);
    return result;
  }
  if (Array.isArray(predicate.any)) {
    for (const item of predicate.any) collectPredicateLeaves(item, result);
    return result;
  }
  if (predicate.not !== undefined) {
    collectPredicateLeaves(predicate.not, result);
    return result;
  }
  result.push(predicate);
  return result;
}

function ownerNodeId(kind, item) {
  if (kind === 'entry') return `file:${item.id}`;
  if (kind === 'operation') return `action:${item.operationId}`;
  if (kind === 'dialogue') return `echo:${item.id}`;
  if (kind === 'mission') return `mission:${item.id}`;
  return null;
}

function predicateOwners(contentBundle = {}) {
  return [
    ...(contentBundle.terminalEntries || []).map(item => ({ kind: 'entry', item, predicate: item.unlockWhen })),
    ...(contentBundle.operations || []).map(item => ({ kind: 'operation', item, predicate: item.unlockWhen })),
    ...(contentBundle.dialogue || []).map(item => ({ kind: 'dialogue', item, predicate: item.unlockWhen })),
    ...(contentBundle.privateMissions || []).map(item => ({ kind: 'mission', item, predicate: item.unlockWhen }))
  ];
}

function hasEntryBackedPredicate(predicate) {
  return collectPredicateLeaves(predicate, []).some(leaf =>
    leaf.entryOpened !== undefined || leaf.entryOpenedTimes !== undefined
  );
}

function brokenReferenceDiagnostics(contentBundle = {}) {
  const result = [];
  const entries = new Set((contentBundle.terminalEntries || []).map(item => item.id));
  const operations = new Set((contentBundle.operations || []).map(item => item.operationId));

  for (const operation of contentBundle.operations || []) {
    for (const entryId of operation.effects?.unlockEntryIds || []) {
      if (!entries.has(entryId)) {
        result.push(diagnostic(
          'BROKEN_REFERENCE',
          'error',
          `action:${operation.operationId}`,
          `操作 ${operation.operationId} 嘗試解鎖不存在的內容 ${entryId}。`,
          [`file:${entryId}`]
        ));
      }
    }
  }

  for (const mission of contentBundle.privateMissions || []) {
    for (const operationId of mission.operationIds || []) {
      if (!operations.has(operationId)) {
        result.push(diagnostic(
          'BROKEN_REFERENCE',
          'error',
          `mission:${mission.id}`,
          `私人任務 ${mission.id} 指向不存在的行動 ${operationId}。`,
          [`action:${operationId}`]
        ));
      }
    }
    for (const operationId of mission.mainlineFallbackOperationIds || []) {
      if (!operations.has(operationId)) {
        result.push(diagnostic(
          'BROKEN_REFERENCE',
          'error',
          `mission:${mission.id}`,
          `私人任務 ${mission.id} 的共同路徑回退行動 ${operationId} 不存在。`,
          [`action:${operationId}`]
        ));
      }
    }
  }

  for (const owner of predicateOwners(contentBundle)) {
    for (const leaf of collectPredicateLeaves(owner.predicate, [])) {
      const entryId = leaf.entryOpened !== undefined
        ? leaf.entryOpened
        : leaf.entryOpenedTimes?.entryId;
      if (entryId && !entries.has(entryId)) {
        result.push(diagnostic(
          'BROKEN_REFERENCE',
          'error',
          ownerNodeId(owner.kind, owner.item),
          `解鎖條件引用不存在的內容 ${entryId}。`,
          [`file:${entryId}`]
        ));
      }
    }
  }

  const verifiableOwners = [
    ...(contentBundle.terminalEntries || []).map(item => ({ prefix: 'file', item })),
    ...(contentBundle.dialogue || []).map(item => ({ prefix: 'echo', item }))
  ];
  for (const owner of verifiableOwners) {
    for (const verification of owner.item.verificationEntries || []) {
      if (!entries.has(verification.entryId)) {
        result.push(diagnostic(
          'BROKEN_REFERENCE',
          'error',
          `${owner.prefix}:${owner.item.id}`,
          `驗證來源 ${verification.entryId} 不存在。`,
          [`file:${verification.entryId}`]
        ));
      }
    }
  }

  return result;
}

function unreachableDiagnostics(contentBundle = {}) {
  const result = [];
  const producedPublicFacts = new Set();
  for (const operation of contentBundle.operations || []) {
    for (const fact of operation.effects?.publicFacts || []) producedPublicFacts.add(fact);
  }

  for (const owner of predicateOwners(contentBundle)) {
    const missingFacts = collectPredicateLeaves(owner.predicate, [])
      .map(leaf => leaf.publicFact)
      .filter(Boolean)
      .filter(fact => !producedPublicFacts.has(fact));

    if (!missingFacts.length) continue;
    const nodeId = ownerNodeId(owner.kind, owner.item);
    result.push(diagnostic(
      'UNREACHABLE',
      'warning',
      nodeId,
      `找不到能產生 ${[...new Set(missingFacts)].join('、')} 的已知故事路徑。`,
      [...new Set(missingFacts)].map(fact => `fact:${fact}`)
    ));
  }

  return result;
}

function orphanDiagnostics(storyMap = {}) {
  const result = [];
  const connected = new Set();
  for (const edge of storyMap.edges || []) {
    connected.add(edge.from);
    connected.add(edge.to);
  }

  for (const node of storyMap.nodes || []) {
    if (node.storyType === 'ENDING' || node.stage === 'R0') continue;
    if (connected.has(node.id)) continue;
    result.push(diagnostic(
      'ORPHAN',
      'hint',
      node.id,
      `${node.label || node.refId || node.id} 沒有和其他可見故事節點形成明確關係。`
    ));
  }
  return result;
}

function audienceLeakDiagnostics(storyMap = {}) {
  const result = [];
  const byId = new Map((storyMap.nodes || []).map(node => [node.id, node]));
  for (const edge of storyMap.edges || []) {
    const source = byId.get(edge.from);
    const target = byId.get(edge.to);
    if (!source || !target) continue;
    if (!['A', 'B'].includes(source.lane) || target.lane !== 'shared') continue;
    if (source.storyType === 'ACTION' && SHARE_ACTIONS.has(source.refId)) continue;

    result.push(diagnostic(
      'AUDIENCE_LEAK',
      'warning',
      target.id,
      `${source.lane} 的私人資訊「${source.label || source.refId}」直接連到共同資訊「${target.label || target.refId}」，但沒有找到明確的分享行動。`,
      [source.id, target.id]
    ));
  }
  return result;
}

function missingVerificationDiagnostics(contentBundle = {}) {
  const result = [];
  for (const line of contentBundle.dialogue || []) {
    if (!['observation', 'manipulation'].includes(line.intent)) continue;
    if ((line.verificationEntries || []).length > 0) continue;
    if (hasEntryBackedPredicate(line.unlockWhen)) continue;

    result.push(diagnostic(
      'MISSING_VERIFICATION',
      'hint',
      `echo:${line.id}`,
      `ECHO 的「${line.id}」沒有連到可見的驗證來源；請確認這是行為觀察而不是需要證據支持的事實宣稱。`
    ));
  }
  return result;
}

function endingDebriefDiagnostics(contentBundle = {}, endingCatalog = {}) {
  const result = [];
  const debriefFacts = new Set((contentBundle.debrief || []).map(item => item.factId));
  for (const ending of Object.values(endingCatalog || {})) {
    for (const factId of ending.debriefFactIds || []) {
      if (debriefFacts.has(factId)) continue;
      result.push(diagnostic(
        'ENDING_DEBRIEF_GAP',
        'warning',
        `ending:${ending.id}`,
        `結局「${ending.title || ending.id}」引用的 debrief fact ${factId} 不存在。`,
        [`debrief:${factId}`]
      ));
    }
  }
  return result;
}

function earlyRevealDiagnostics(contentBundle = {}, storyMap = {}) {
  const result = [];
  const byRef = new Map((storyMap.nodes || []).map(node => [node.refId, node]));
  const owners = [
    ...(contentBundle.terminalEntries || []).map(item => ({ node: byRef.get(item.id), item })),
    ...(contentBundle.dialogue || []).map(item => ({ node: byRef.get(item.id), item }))
  ];

  for (const owner of owners) {
    if (!owner.node) continue;
    const sourceRank = STAGE_RANK[owner.node.stage];
    if (!Number.isInteger(sourceRank)) continue;
    for (const verification of owner.item.verificationEntries || []) {
      const evidence = byRef.get(verification.entryId);
      if (!evidence) continue;
      const evidenceRank = STAGE_RANK[evidence.stage];
      if (!Number.isInteger(evidenceRank) || evidenceRank - sourceRank < 2) continue;
      result.push(diagnostic(
        'SUSPICIOUS_EARLY_REVEAL',
        'hint',
        owner.node.id,
        `「${owner.node.label || owner.node.refId}」在 ${owner.node.stage} 就能指向 ${evidence.stage} 的「${evidence.label || evidence.refId}」。請確認這個提前揭露是刻意設計。`,
        [owner.node.id, evidence.id]
      ));
    }
  }
  return result;
}

function diagnoseStoryGraph({
  contentBundle = {},
  endingCatalog = {},
  technicalGraph = null,
  storyMap = null
} = {}) {
  const technical = technicalGraph || buildTechnicalStoryGraph({ contentBundle, endingCatalog });
  const presentation = storyMap || buildStoryMapModel(technical, storyGraphMetadata);

  return [
    ...brokenReferenceDiagnostics(contentBundle),
    ...unreachableDiagnostics(contentBundle),
    ...orphanDiagnostics(presentation),
    ...audienceLeakDiagnostics(presentation),
    ...missingVerificationDiagnostics(contentBundle),
    ...endingDebriefDiagnostics(contentBundle, endingCatalog),
    ...earlyRevealDiagnostics(contentBundle, presentation)
  ];
}

module.exports = {
  DIAGNOSTIC_TITLES,
  diagnoseStoryGraph
};
