(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const root = document.querySelector('[data-author-story-map]');
  if (!root) return;

  const canvas = root.querySelector('[data-story-map-canvas]');
  const status = root.querySelector('[data-story-map-status]');
  const summary = root.querySelector('[data-story-summary]');
  const inspector = root.querySelector('[data-story-inspector]');
  const diagnosticList = root.querySelector('[data-diagnostic-list]');
  const diagnosticsOnlyInput = root.querySelector('[data-diagnostics-only]');

  const state = {
    model: null,
    stage: 'ALL',
    viewpoint: 'ALL',
    type: 'ALL',
    diagnosticsOnly: false,
    selectedId: null,
    selectedDiagnostic: null
  };

  function svg(tag, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value !== null && value !== undefined) element.setAttribute(name, String(value));
    }
    return element;
  }

  function clear(element) {
    while (element?.firstChild) element.removeChild(element.firstChild);
  }

  function stageMatches(node) {
    return state.stage === 'ALL' || node.stage === state.stage;
  }

  function viewpointMatches(node) {
    if (state.viewpoint === 'ALL') return true;
    if (state.viewpoint === 'A') return node.lane === 'A' || node.lane === 'shared' || node.lane === 'ECHO';
    if (state.viewpoint === 'B') return node.lane === 'B' || node.lane === 'shared' || node.lane === 'ECHO';
    return node.lane === state.viewpoint;
  }

  function typeMatches(node) {
    return state.type === 'ALL' || node.storyType === state.type;
  }

  function diagnosticNodeIds() {
    const ids = new Set();
    for (const item of state.model?.diagnostics || []) {
      if (item.nodeId) ids.add(item.nodeId);
      for (const id of item.relatedNodeIds || []) ids.add(id);
      for (const id of item.nodeIds || []) ids.add(id);
    }
    return ids;
  }

  function filteredNodes() {
    const diagnosticIds = state.diagnosticsOnly ? diagnosticNodeIds() : null;
    return (state.model?.nodes || []).filter(node =>
      stageMatches(node)
      && viewpointMatches(node)
      && typeMatches(node)
      && (!diagnosticIds || diagnosticIds.has(node.id))
    );
  }

  function wrapText(text, limit = 13) {
    const value = String(text || '');
    const lines = [];
    let current = '';
    for (const char of value) {
      current += char;
      if (current.length >= limit) {
        lines.push(current);
        current = '';
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
  }

  function activeButton(groupSelector, attribute, value) {
    for (const button of root.querySelectorAll(`${groupSelector} [${attribute}]`)) {
      const active = button.getAttribute(attribute) === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  function syncFilterControls() {
    activeButton('[data-stage-filters]', 'data-filter-stage', state.stage);
    activeButton('[data-viewpoint-filters]', 'data-filter-viewpoint', state.viewpoint);
    activeButton('[data-type-filters]', 'data-filter-type', state.type);
    if (diagnosticsOnlyInput) diagnosticsOnlyInput.checked = state.diagnosticsOnly;
  }

  function bindFilters() {
    root.querySelector('[data-stage-filters]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter-stage]');
      if (!button) return;
      state.stage = button.dataset.filterStage;
      state.selectedDiagnostic = null;
      syncFilterControls();
      render();
    });

    root.querySelector('[data-viewpoint-filters]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter-viewpoint]');
      if (!button) return;
      state.viewpoint = button.dataset.filterViewpoint;
      state.selectedDiagnostic = null;
      syncFilterControls();
      render();
    });

    root.querySelector('[data-type-filters]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter-type]');
      if (!button) return;
      state.type = button.dataset.filterType;
      state.selectedDiagnostic = null;
      syncFilterControls();
      render();
    });

    diagnosticsOnlyInput?.addEventListener('change', () => {
      state.diagnosticsOnly = diagnosticsOnlyInput.checked;
      state.selectedDiagnostic = null;
      render();
    });
  }

  function renderDefinitions() {
    const defs = svg('defs');
    const marker = svg('marker', {
      id: 'story-map-arrow',
      markerWidth: 8,
      markerHeight: 8,
      refX: 7,
      refY: 4,
      orient: 'auto',
      markerUnits: 'strokeWidth'
    });
    marker.appendChild(svg('path', { d: 'M0,0 L8,4 L0,8 z', class: 'story-edge-arrow' }));
    defs.appendChild(marker);
    canvas.appendChild(defs);
  }

  function renderGrid(stages, lanes, dimensions) {
    const { left, top, columnWidth, laneHeight, width, height } = dimensions;
    const background = svg('g', { class: 'story-grid' });

    lanes.forEach((lane, laneIndex) => {
      const y = top + laneIndex * laneHeight;
      const group = svg('g', {
        'data-story-lane': lane.id,
        class: `story-lane story-lane-${lane.id}`
      });
      group.appendChild(svg('rect', {
        x: 0, y, width, height: laneHeight, class: 'story-lane-bg'
      }));
      const label = svg('text', { x: 18, y: y + 34, class: 'story-lane-label' });
      label.textContent = lane.label;
      group.appendChild(label);
      background.appendChild(group);
    });

    stages.forEach((stage, stageIndex) => {
      const x = left + stageIndex * columnWidth;
      background.appendChild(svg('line', {
        x1: x, y1: top - 12, x2: x, y2: height, class: 'story-stage-line'
      }));
      const stageLabel = svg('text', { x: x + 16, y: 30, class: 'story-stage-label' });
      stageLabel.textContent = stage.label;
      background.appendChild(stageLabel);
      const stageId = svg('text', { x: x + 16, y: 49, class: 'story-stage-id' });
      stageId.textContent = stage.id;
      background.appendChild(stageId);
    });

    canvas.appendChild(background);
  }

  function computeLayout(nodes, stages, lanes) {
    const stageIndex = new Map(stages.map((stage, index) => [stage.id, index]));
    const laneIndex = new Map(lanes.map((lane, index) => [lane.id, index]));
    const buckets = new Map();

    for (const node of nodes) {
      const key = `${node.stage}:${node.lane}`;
      const bucket = buckets.get(key) || [];
      bucket.push(node);
      buckets.set(key, bucket);
    }

    let largestBucket = 1;
    for (const bucket of buckets.values()) largestBucket = Math.max(largestBucket, bucket.length);

    const left = 154;
    const top = 72;
    const columnWidth = 298;
    const nodeWidth = 220;
    const nodeHeight = 70;
    const nodeGap = 16;
    const laneHeight = Math.max(210, 76 + largestBucket * (nodeHeight + nodeGap));
    const width = left + stages.length * columnWidth + 50;
    const height = top + lanes.length * laneHeight + 30;
    const positions = new Map();

    for (const [key, bucket] of buckets.entries()) {
      const [stageId, laneId] = key.split(':');
      const sx = stageIndex.get(stageId) ?? 0;
      const ly = laneIndex.get(laneId) ?? 0;
      bucket.forEach((node, index) => {
        positions.set(node.id, {
          x: left + sx * columnWidth + 18,
          y: top + ly * laneHeight + 58 + index * (nodeHeight + nodeGap),
          width: nodeWidth,
          height: nodeHeight
        });
      });
    }

    return {
      positions,
      dimensions: { left, top, columnWidth, laneHeight, width, height, nodeWidth, nodeHeight }
    };
  }

  function renderEdges(nodes, positions) {
    const visibleIds = new Set(nodes.map(node => node.id));
    const group = svg('g', { class: 'story-edges', 'aria-hidden': 'true' });

    for (const edge of state.model?.edges || []) {
      if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) continue;
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) continue;
      const startX = from.x + from.width;
      const startY = from.y + from.height / 2;
      const endX = to.x;
      const endY = to.y + to.height / 2;
      const bend = Math.max(36, Math.abs(endX - startX) / 2);
      group.appendChild(svg('path', {
        d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
        class: 'story-edge',
        'marker-end': 'url(#story-map-arrow)'
      }));
    }

    canvas.appendChild(group);
  }

  function nodeClass(node) {
    return `story-node story-node-${String(node.storyType || 'discovery').toLowerCase()}`;
  }

  function renderNodes(nodes, positions) {
    const group = svg('g', { class: 'story-nodes' });
    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const card = svg('g', {
        class: `${nodeClass(node)}${state.selectedId === node.id ? ' is-selected' : ''}`,
        transform: `translate(${pos.x} ${pos.y})`,
        role: 'button',
        tabindex: 0,
        'aria-label': node.label,
        'data-story-node': node.refId,
        'data-node-id': node.id,
        'data-lane': node.lane,
        'data-stage': node.stage,
        'data-story-type': node.storyType
      });
      card.appendChild(svg('rect', {
        width: pos.width, height: pos.height, rx: 10, class: 'story-node-card'
      }));

      const type = svg('text', { x: 14, y: 19, class: 'story-node-type' });
      type.textContent = ({ DISCOVERY: '發現', ECHO: 'ECHO', ACTION: '行動', TRUTH: '真相', ENDING: '結局' })[node.storyType] || node.storyType;
      card.appendChild(type);

      wrapText(node.label).forEach((line, index) => {
        const label = svg('text', { x: 14, y: 40 + index * 17, class: 'story-node-label' });
        label.textContent = line;
        card.appendChild(label);
      });

      card.addEventListener('click', () => selectNode(node.id));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectNode(node.id);
        }
      });
      group.appendChild(card);
    }
    canvas.appendChild(group);
  }

  function section(titleText, bodyText) {
    const wrapper = document.createElement('section');
    wrapper.className = 'inspector-section';
    const title = document.createElement('h3');
    title.textContent = titleText;
    const body = document.createElement('p');
    body.textContent = bodyText;
    wrapper.append(title, body);
    return wrapper;
  }

  function renderInspector(node, diagnostic = null) {
    clear(inspector);
    const kicker = document.createElement('p');
    kicker.className = 'panel-kicker';
    kicker.textContent = node ? `${node.stage} · ${node.lane}` : '節點說明';
    inspector.appendChild(kicker);

    if (!node) {
      const heading = document.createElement('h2');
      heading.textContent = '選一段故事';
      const body = document.createElement('p');
      body.textContent = '點擊地圖上的節點，查看玩家如何看到它，以及它可能影響什麼。';
      inspector.append(heading, body);
      return;
    }

    if (diagnostic) {
      const alert = document.createElement('section');
      alert.className = `inspector-diagnostic diagnostic-${diagnostic.severity || 'hint'}`;
      const title = document.createElement('h2');
      title.textContent = diagnostic.title || diagnostic.code || '故事結構提醒';
      const message = document.createElement('p');
      message.textContent = diagnostic.message || '';
      alert.append(title, message);
      inspector.appendChild(alert);
    }

    const incoming = (state.model?.edges || []).filter(edge => edge.to === node.id);
    const outgoing = (state.model?.edges || []).filter(edge => edge.from === node.id);
    const nodeById = new Map((state.model?.nodes || []).map(item => [item.id, item]));
    const later = outgoing.map(edge => nodeById.get(edge.to)).filter(Boolean).slice(0, 4);

    inspector.append(
      section('這是什麼？', node.summary || '這是一個故事流程中的關鍵節點。'),
      section('玩家怎麼看到？', incoming.map(edge => edge.label || '前置故事條件').join('、') || '從目前故事階段即可看到。'),
      section('這會改變什麼？', outgoing.map(edge => edge.label || '影響後續流程').join('、') || '主要提供理解，不直接改變下一步。'),
      section('後面可能發生？', later.map(item => item.label).join('、') || '目前沒有更後面的可見故事節點。')
    );

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'technical-toggle';
    toggle.textContent = '顯示技術細節';
    toggle.setAttribute('aria-expanded', 'false');

    const details = document.createElement('pre');
    details.className = 'technical-details';
    details.hidden = true;
    details.textContent = JSON.stringify({
      id: node.refId,
      canonicalId: node.id,
      stage: node.stage,
      lane: node.lane,
      storyType: node.storyType,
      technical: node.technical || {},
      incoming: incoming.map(edge => ({ from: edge.from, kind: edge.kind, technicalKinds: edge.technicalKinds })),
      outgoing: outgoing.map(edge => ({ to: edge.to, kind: edge.kind, technicalKinds: edge.technicalKinds }))
    }, null, 2);

    toggle.addEventListener('click', () => {
      details.hidden = !details.hidden;
      toggle.textContent = details.hidden ? '顯示技術細節' : '隱藏技術細節';
      toggle.setAttribute('aria-expanded', String(!details.hidden));
    });
    inspector.append(toggle, details);
  }

  function selectNode(nodeId, diagnostic = null) {
    state.selectedId = nodeId;
    state.selectedDiagnostic = diagnostic;
    renderCanvas();
    const node = state.model?.nodes?.find(item => item.id === nodeId) || null;
    renderInspector(node, diagnostic);
  }

  function focusDiagnostic(item) {
    const targetId = item.nodeId || item.nodeIds?.[0] || item.relatedNodeIds?.[0] || null;
    state.stage = 'ALL';
    state.viewpoint = 'ALL';
    state.type = 'ALL';
    state.diagnosticsOnly = false;
    state.selectedId = targetId;
    state.selectedDiagnostic = item;
    syncFilterControls();
    renderCanvas();
    const node = state.model?.nodes?.find(candidate => candidate.id === targetId) || null;
    renderInspector(node, item);
    if (targetId) {
      root.querySelector(`[data-node-id="${CSS.escape(targetId)}"]`)?.focus();
    }
  }

  function renderDiagnostics() {
    clear(diagnosticList);
    const diagnostics = state.model?.diagnostics || [];
    if (!diagnostics.length) {
      const ok = document.createElement('p');
      ok.className = 'diagnostic-empty';
      ok.textContent = '目前沒有需要注意的結構問題。';
      diagnosticList.appendChild(ok);
      return;
    }

    for (const item of diagnostics) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `diagnostic-card diagnostic-${item.severity || 'hint'}`;
      button.dataset.diagnosticCode = item.code || '';
      const title = document.createElement('strong');
      title.textContent = item.title || item.code || '故事結構提醒';
      const message = document.createElement('span');
      message.textContent = item.message || '';
      const code = document.createElement('small');
      code.textContent = item.code || '';
      button.append(title, message, code);
      button.addEventListener('click', () => focusDiagnostic(item));
      diagnosticList.appendChild(button);
    }
  }

  function renderCanvas() {
    clear(canvas);
    const stages = state.model?.stages || [];
    const lanes = state.model?.lanes || [];
    const nodes = filteredNodes();
    const { positions, dimensions } = computeLayout(nodes, stages, lanes);

    canvas.setAttribute('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
    canvas.setAttribute('width', dimensions.width);
    canvas.setAttribute('height', dimensions.height);
    renderDefinitions();
    renderGrid(stages, lanes, dimensions);
    renderEdges(nodes, positions);
    renderNodes(nodes, positions);

    if (!nodes.length) status.textContent = '這個篩選條件下沒有故事節點。';
    else status.textContent = `目前顯示 ${nodes.length} 段故事。點擊節點可查看詳細說明。`;
    summary.textContent = `${nodes.length} / ${state.model?.nodes?.length || 0} 個故事節點`;
  }

  function render() {
    if (!state.model) return;
    renderCanvas();
    renderDiagnostics();
    const selected = state.model.nodes?.find(node => node.id === state.selectedId) || null;
    renderInspector(selected, state.selectedDiagnostic);
  }

  async function load() {
    try {
      const response = await fetch('/author/api/reveal-graph', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Story Map API returned ${response.status}`);
      state.model = await response.json();
      render();
    } catch (error) {
      state.model = {
        nodes: [], edges: [], stages: [], lanes: [], diagnostics: [{
          code: 'GRAPH_LOAD_ERROR', severity: 'error', nodeId: null,
          title: '部分故事資料無法解析',
          message: error instanceof Error ? error.message : String(error),
          relatedNodeIds: []
        }]
      };
      status.textContent = '部分故事資料無法解析。';
      render();
    }
  }

  bindFilters();
  syncFilterControls();
  load();
})();
