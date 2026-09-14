/**
 * Render the actor's explorable workstation projection.
 *
 * The server owns the projection. This module deliberately renders only the
 * entries and terminal operations it receives; it never tries to infer files
 * that are not present in the projection.
 */
export function createWorkstation(root, { onOperation } = {}) {
  const host = root?.matches?.('[data-workstation]')
    ? root
    : root?.querySelector?.('[data-workstation]') || root;
  if (!host) throw new TypeError('Workstation root is required');
  if (typeof onOperation !== 'function' && onOperation !== undefined) {
    throw new TypeError('onOperation must be a function');
  }

  let currentView = {};
  let activeApp = 'files';
  let folderPath = [];
  let lastFocusId = '';
  let pendingScroll = 0;

  const id = value => typeof value === 'string' ? value : '';
  const label = value => typeof value === 'string' && value ? value : 'UNTITLED';
  const randomId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  function appsFor(view) {
    const declared = Array.isArray(view.apps) ? view.apps : null;
    if (declared) return declared.filter(app => app && id(app.id));
    return [
      { id: 'files', label: 'Files' },
      { id: 'terminal', label: 'Terminal' },
      { id: 'logs', label: 'Logs' }
    ];
  }

  function filesFor(view) {
    const files = view.files;
    const entries = Array.isArray(files)
      ? files
      : Array.isArray(files?.entries) ? files.entries
        : Array.isArray(view.entries) ? view.entries : [];
    return entries.filter(entry => entry && id(entry.id)
      && entry.locked !== true && entry.available !== false && entry.visible !== false);
  }

  function rootIdFor(view, entries) {
    const candidate = id(view.files?.rootId) || id(view.rootId);
    if (candidate && entries.some(entry => entry.id === candidate)) return candidate;
    return entries.find(entry => entry.kind === 'folder' && entry.parentId == null)?.id
      || entries.find(entry => entry.kind === 'folder')?.id || '';
  }

  function captureViewState() {
    const scroll = host.querySelector('[data-workstation-scroll]');
    if (scroll) pendingScroll = scroll.scrollTop;
    const focused = document.activeElement;
    if (focused && host.contains(focused)) {
      const focusId = focused.dataset.workstationId || focused.dataset.workstationApp;
      if (focusId) lastFocusId = focusId;
    }
  }

  function createButton(text, attributes = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    for (const [name, value] of Object.entries(attributes)) {
      if (value === undefined || value === null) continue;
      button.setAttribute(name, value);
    }
    return button;
  }

  function invokeOperation(operation) {
    if (!operation || !id(operation.operationId) || typeof onOperation !== 'function') return;
    onOperation({
      operationId: operation.operationId,
      value: typeof operation.value === 'string' ? operation.value : undefined,
      actionId: randomId()
    });
  }

  function renderApps(container, apps) {
    const nav = document.createElement('nav');
    nav.className = 'workstation-apps';
    nav.setAttribute('aria-label', 'Applications');
    for (const app of apps) {
      const button = createButton(label(app.label || app.name || app.id), { 'data-workstation-app': app.id });
      button.dataset.workstationApp = app.id;
      button.setAttribute('aria-pressed', String(activeApp === app.id));
      button.addEventListener('click', () => {
        captureViewState();
        activeApp = app.id;
        folderPath = [];
        lastFocusId = app.id;
        render(currentView);
      });
      nav.append(button);
    }
    container.append(nav);
  }

  function renderFiles(container, view) {
    const entries = filesFor(view);
    const rootId = rootIdFor(view, entries);
    if (!folderPath.length || !entries.some(entry => entry.id === folderPath[folderPath.length - 1]
      && (entry.kind === 'folder' || entry.type === 'folder'))) folderPath = rootId ? [rootId] : [];
    const folderId = folderPath[folderPath.length - 1] || rootId;
    const folder = entries.find(entry => entry.id === folderId);
    const scroll = document.createElement('div');
    scroll.className = 'workstation-scroll';
    scroll.dataset.workstationScroll = '';
    const heading = document.createElement('h3');
    heading.textContent = label(folder?.name || 'FILES');
    scroll.append(heading);
    if (folderPath.length > 1 || currentView.__openedEntry) {
      const back = createButton('Back', { 'data-workstation-back': '' });
      back.addEventListener('click', () => {
        captureViewState();
        if (currentView.__openedEntry) {
          currentView = { ...currentView };
          delete currentView.__openedEntry;
          lastFocusId = folderId;
        } else {
          folderPath.pop();
          lastFocusId = folderPath[folderPath.length - 1] || '';
        }
        render(currentView);
      });
      scroll.append(back);
    }
    const list = document.createElement('div');
    list.className = 'workstation-entries';
    list.setAttribute('role', 'list');
    for (const entry of entries.filter(item => item.parentId === folderId)) {
      const isFolder = entry.kind === 'folder' || entry.type === 'folder';
      const button = createButton(label(entry.name || entry.title || entry.id), {
        'data-workstation-entry': entry.id,
        'data-workstation-id': entry.id
      });
      button.dataset.workstationEntry = entry.id;
      button.dataset.workstationId = entry.id;
      button.setAttribute('aria-label', label(entry.name || entry.title || entry.id));
      button.addEventListener('click', () => openEntry(entry.id));
      list.append(button);
    }
    scroll.append(list);
    if (currentView.__openedEntry) {
      const opened = entries.find(entry => entry.id === currentView.__openedEntry);
      if (opened && (opened.kind !== 'folder' && opened.type !== 'folder')) {
        const content = document.createElement('pre');
        content.dataset.workstationEntryContent = '';
        content.textContent = typeof opened.content === 'string' ? opened.content
          : typeof opened.text === 'string' ? opened.text : '';
        scroll.append(content);
      }
    }
    container.append(scroll);
  }

  function renderTerminal(container, view) {
    const terminal = view.terminal || {};
    const operations = Array.isArray(terminal.operations) ? terminal.operations
      : Array.isArray(view.operations) ? view.operations : [];
    const panel = document.createElement('div');
    panel.className = 'workstation-terminal';
    panel.dataset.workstationTerminal = '';
    const heading = document.createElement('h3');
    heading.textContent = 'TERMINAL';
    panel.append(heading);
    const form = document.createElement('form');
    form.dataset.workstationTerminalForm = '';
    for (const operation of operations.filter(item => item && id(item.operationId)
      && item.locked !== true && item.available !== false)) {
      const button = createButton(label(operation.label || operation.name || operation.operationId), {
        'data-terminal-operation': operation.operationId,
        'data-operation-id': operation.operationId
      });
      button.dataset.operationId = operation.operationId;
      if (operation.description) button.title = operation.description;
      button.addEventListener('click', () => invokeOperation(operation));
      form.append(button);
    }
    panel.append(form);
    container.append(panel);
  }

  function renderLogs(container, view) {
    const logs = Array.isArray(view.logs) ? view.logs
      : Array.isArray(view.logs?.entries) ? view.logs.entries : [];
    const panel = document.createElement('section');
    panel.dataset.workstationLog = '';
    panel.className = 'workstation-logs';
    const heading = document.createElement('h3');
    heading.textContent = 'LOGS';
    panel.append(heading);
    for (const entry of logs.filter(item => item && item.locked !== true && item.available !== false)) {
      const article = document.createElement('article');
      const title = document.createElement('h4');
      const text = document.createElement('p');
      title.textContent = label(entry.title || entry.name || entry.id);
      text.textContent = typeof entry.text === 'string' ? entry.text : typeof entry.content === 'string' ? entry.content : '';
      article.append(title, text);
      panel.append(article);
    }
    container.append(panel);
  }

  function render(next = {}) {
    captureViewState();
    currentView = next && typeof next === 'object' ? next : {};
    const apps = appsFor(currentView);
    if (!apps.some(app => app.id === activeApp)) activeApp = apps[0]?.id || 'files';
    const layout = document.createElement('section');
    layout.className = 'workstation-ui';
    layout.dataset.workstationView = activeApp;
    renderApps(layout, apps);
    const content = document.createElement('section');
    content.className = 'workstation-content';
    content.setAttribute('aria-live', 'polite');
    if (activeApp === 'terminal') renderTerminal(content, currentView);
    else if (activeApp === 'logs') renderLogs(content, currentView);
    else renderFiles(content, currentView);
    layout.append(content);
    host.replaceChildren(layout);
    const scroll = host.querySelector('[data-workstation-scroll]');
    if (scroll) scroll.scrollTop = pendingScroll;
    restoreFocus();
  }

  function openApp(appId) {
    if (!id(appId)) return;
    const apps = appsFor(currentView);
    if (!apps.some(app => app.id === appId)) return;
    captureViewState();
    activeApp = appId;
    folderPath = [];
    lastFocusId = appId;
    render(currentView);
  }

  function openEntry(entryId) {
    const entries = filesFor(currentView);
    const entry = entries.find(item => item.id === entryId);
    if (!entry) return;
    captureViewState();
    const isFolder = entry.kind === 'folder' || entry.type === 'folder';
    if (isFolder) {
      if (!folderPath.includes(entry.id)) folderPath.push(entry.id);
    } else {
      currentView = { ...currentView, __openedEntry: entry.id };
    }
    lastFocusId = entry.id;
    render(currentView);
  }

  function restoreFocus() {
    if (!lastFocusId) return;
    const target = host.querySelector(`[data-workstation-id="${CSS.escape(lastFocusId)}"], [data-workstation-app="${CSS.escape(lastFocusId)}"]`);
    if (target) target.focus({ preventScroll: true });
  }

  host.addEventListener('keydown', event => {
    if (!host.contains(event.target)) return;
    if (event.key === 'Backspace' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
      && !event.target.isContentEditable) {
      if (activeApp === 'files' && (folderPath.length > 1 || currentView.__openedEntry)) {
        event.preventDefault();
        if (currentView.__openedEntry) {
          currentView = { ...currentView };
          delete currentView.__openedEntry;
        } else folderPath.pop();
        render(currentView);
      } else {
        event.preventDefault();
      }
    }
  });

  return { render, openApp, openEntry, restoreFocus };
}
