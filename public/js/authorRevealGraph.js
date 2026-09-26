(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const root = document.querySelector('[data-author-story-map]');
  if (!root) return;

  const canvas = root.querySelector('[data-story-map-canvas]');
  const status = root.querySelector('[data-story-map-status]');
  const summary = root.querySelector('[data-story-summary]');
  const inspector = root.querySelector('[data-story-inspector]');
  const diagnosticList = root.querySelector('[data-diagnostic-list]');

  const state = {
    model: null,
    stage: 'ALL',
    viewpoint: 'ALL',
    type: 'ALL',
    selectedId: null
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

  function filteredNodes() {
    return (state.model?.nodes || []).filter(node =>
      stageMatches(node) && viewpointMatches(node) && typeMatches(node)
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

  function bindFilters() {
    root.querySelector('[data-stage-filters]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter-stage]');
      if (!button) return;
      state.stage = button.dataset.filterStage;
      activeButton('[data-stage-filters]', 'data-filter-stage', state.stage);
      render();
    });

    root.querySelector('[data-viewpoint-filters]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter-viewpoint]');
      if (!button) return;
      state.viewpoint = button.dataset.filterViewpoint;
      activeButton('[data-viewpoint-filters]', 'data-filter-viewpoint', state.viewpoint);
      render();
    });

    root.querySelector('[data-type-filters]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter-type]');
      if (!button) return;
      state.type = button.dataset.filterType;
      activeButton('[data-type-filters]', 'data-filter-type', state.type);
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
        x: 0,
        y,
        width,
        height: laneHeight,
        class: 'story-lane-bg'
      }));
      const label = svg('text', {
        x: 18,
        y: y + 34,
        class: 'story-lane-label'
      });
      label.textContent = lane.label;
      group.appendChild(label);
      background.appendChild(group);
    });

    stages.forEach((stage, stageIndex) => {
      const x = left + stageIndex * columnWidth;
      const line = svg('line', {
        x1: x,
        y1: top - 12,
        x2: x,
        y2: height,
        class: 'story-stage-line'
      });
      background.appendChild(line);

      const stageLabel = svg('text', {
        x: x + 16,
        y: 30,
        class: 'story-stage-label'
      });
      stageLabel.textContent = stage.label;
      background.appendChild(stageLabel);

      const stageId = svg('text', {
        x: x + 16,
        y: 49,
        class: 'story-stage-id'
      });
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
      const path = svg('path', {
        d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
        class: 'story-edge',
        'marker-end': 'url(#story-map-arrow)'
      });
      group.appendChild(path);
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
        width: pos.width,
        height: pos.height,
        rx: 10,
        class: 'story-node-card'
      }));

      const type = svg('text', { x: 14, y: 19, class: 'story-node-type' });
      type.textContent = ({
        DISCOVERY: '發現', ECHO: 'ECHO', ACTION: '行動', TRUTH: '真相', ENDING: '結局'
      })[node.storyType] || node.storyType;
      card.appendChild(type);

      const lines = wrapText(node.label);
      lines.forEach((line, index) => {
        const label = svg('text', {
          x: 14,
          y: 40 + index * 17,
          class: 'story-node-label'
        });
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

  function renderInspector(node) {
    clear(inspector);
    const kicker = document.createElement('p');
    kicker.className = 'panel-kicker';
    kicker.textContent = node ? `${node.stage} · ${node.lane}` : '節點說明';
    inspector.appendChild(kicker);

    const heading = document.createElement('h2');
    heading.textContent = node?.label || '選一段故事';
    inspector.appendChild(heading);

    const body = document.createElement('p');
    body.textContent = node?.summary || '點擊地圖上的節點，查看玩家如何看到它，以及它可能影響什麼。';
    inspector.appendChild(body);
  }

  function selectNode(nodeId) {
    state.selectedId = nodeId;
    const node = state.model?.nodes?.find(item => item.id === nodeId) || null;
    renderInspector(node);
    renderCanvas();
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
      const article = document.createElement('article');
      article.className = `diagnostic-card diagnostic-${item.severity || 'hint'}`;
      article.dataset.diagnosticCode = item.code || '';
      const title = document.createElement('h3');
      title.textContent = item.title || item.code || '故事結構提醒';
      const message = document.createElement('p');
      message.textContent = item.message || '';
      article.append(title, message);
      diagnosticList.appendChild(article);
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

    if (!nodes.length) {
      status.textContent = '這個篩選條件下沒有故事節點。';
    } else {
      status.textContent = `目前顯示 ${nodes.length} 段故事。點擊節點可查看詳細說明。`;
    }
    summary.textContent = `${nodes.length} / ${state.model?.nodes?.length || 0} 個故事節點`;
  }

  function render() {
    if (!state.model) return;
    renderCanvas();
    renderDiagnostics();
    const selected = state.model.nodes?.find(node => node.id === state.selectedId) || null;
    renderInspector(selected);
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
          code: 'GRAPH_LOAD_ERROR',
          severity: 'error',
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
  activeButton('[data-stage-filters]', 'data-filter-stage', state.stage);
  activeButton('[data-viewpoint-filters]', 'data-filter-viewpoint', state.viewpoint);
  activeButton('[data-type-filters]', 'data-filter-type', state.type);
  load();
})();
