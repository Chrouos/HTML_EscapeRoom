/**
 * Render the actor's explorable workstation projection.
 *
 * The server owns the projection. This module deliberately renders only the
 * entries and terminal operations it receives; it never tries to infer files
 * that are not present in the projection.
 */
export function createWorkstation(root, { onOperation, onPuzzleAction } = {}) {
  const host = root?.matches?.('[data-workstation]')
    ? root
    : root?.querySelector?.('[data-workstation]') || root;
  if (!host) throw new TypeError('Workstation root is required');
  if (!host.hasAttribute('tabindex')) host.tabIndex = -1;
  if (typeof onOperation !== 'function' && onOperation !== undefined) {
    throw new TypeError('onOperation must be a function');
  }
  if (typeof onPuzzleAction !== 'function' && onPuzzleAction !== undefined) {
    throw new TypeError('onPuzzleAction must be a function');
  }

  let currentView = {};
  let activeApp = 'files';
  let folderPath = [];
  let expandedFolders = new Set();
  let lastFocusId = '';
  const scrollPositions = new Map();
  const terminalHistory = [];
  let terminalHistoryIndex = -1;

  const id = value => typeof value === 'string' ? value : '';
  const label = value => typeof value === 'string' && value ? value : 'UNTITLED';
  const randomId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `action-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  function appsFor(view) {
    const declared = Array.isArray(view.apps) ? view.apps : null;
    const apps = declared
      ? declared.filter(app => app && id(app.id))
      : [
      { id: 'files', label: 'Files' },
      { id: 'terminal', label: 'Terminal' },
      { id: 'logs', label: 'Logs' },
      { id: 'request', label: 'Request' }
      ];
    if (!apps.some(app => app.id === 'terminal')) {
      apps.splice(Math.min(1, apps.length), 0, { id: 'terminal', label: 'Terminal' });
    }
    const request = apps.find(app => app.id === 'request');
    if (!request) apps.push({ id: 'request', label: 'Request', ready: view.answerGate?.open === true });
    else request.ready = view.answerGate?.open === true;
    return apps;
  }

  function filesFor(view) {
    const files = view.files;
    const entries = Array.isArray(files)
      ? files
      : Array.isArray(files?.entries) ? files.entries
        : Array.isArray(view.entries) ? view.entries : [];
    const safeEntries = entries.filter(entry => entry && id(entry.id)
      && entry.available !== false && entry.visible !== false
      && entry.app !== 'terminal' && entry.launchApp !== 'terminal'
      && (entry.locked !== true || entry.metadataVisible === true));
    const investigations = Array.isArray(view.sidePuzzles) ? view.sidePuzzles
      .filter(item => item && id(item.puzzleId))
      .map(item => ({
        id: `investigation.${item.puzzleId}`,
        name: `${item.puzzleId}.case`,
        kind: 'document',
        parentId: 'folder.notes',
        text: item.opened && typeof item.prompt === 'string' ? item.prompt : item.hook || item.title || '',
        puzzleId: item.puzzleId,
        stepId: item.stepId || 'inspect',
        opened: item.opened === true,
        complete: item.complete === true
      })) : [];
    const known = new Set(safeEntries.map(entry => entry.id));
    const needsNotesFolder = investigations.length && !known.has('folder.notes');
    const rootId = rootIdHint(view, safeEntries);
    return [
      ...safeEntries,
      ...(needsNotesFolder ? [{ id: 'folder.notes', name: 'NOTES', kind: 'folder', parentId: rootId }] : []),
      ...investigations.filter(entry => !known.has(entry.id))
    ];
  }

  function rootIdHint(view, entries) {
    const candidate = id(view.files?.rootId) || id(view.rootId);
    if (candidate) return candidate;
    return entries.find(entry => (entry.kind === 'folder' || entry.type === 'folder') && entry.parentId == null)?.id || null;
  }

  function projectedEntries(view) {
    const files = filesFor(view);
    const terminal = Array.isArray(view.terminal?.entries) ? view.terminal.entries : [];
    const logs = Array.isArray(view.logs?.entries) ? view.logs.entries : [];
    return [...files, ...terminal, ...logs].filter(entry => entry && id(entry.id));
  }

  function rootIdFor(view, entries) {
    const candidate = id(view.files?.rootId) || id(view.rootId);
    if (candidate && entries.some(entry => entry.id === candidate)) return candidate;
    const isFolder = entry => entry.kind === 'folder' || entry.type === 'folder';
    return entries.find(entry => isFolder(entry) && entry.parentId == null)?.id
      || entries.find(entry => isFolder(entry))?.id || '';
  }

  function captureViewState() {
    const scrollKey = `${activeApp}:${folderPath.join('/')}:${currentView.__openedEntry || ''}`;
    const scrolls = host.querySelectorAll('[data-workstation-tree], [data-workstation-scroll], [data-terminal-history], [data-workstation-log]');
    scrolls.forEach((scroll, index) => scrollPositions.set(`${scrollKey}:${index}`, scroll.scrollTop));
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
      if (app.id === 'request') {
        const ready = app.ready === true;
        button.dataset.workstationRequestState = ready ? 'ready' : 'standby';
        button.setAttribute('aria-label', 'Request');
        if (!ready) button.disabled = true;
        const status = document.createElement('span');
        status.className = 'workstation-request-dot';
        status.setAttribute('aria-hidden', 'true');
        button.append(status);
      }
      button.addEventListener('click', () => {
        captureViewState();
        activeApp = app.id;
        folderPath = [];
        lastFocusId = app.id === 'terminal' ? 'terminal-input' : app.id;
        render(currentView);
        if (app.id === 'terminal') {
          window.queueMicrotask(() => host.querySelector('[data-terminal-input]')?.focus());
        }
      });
      nav.append(button);
    }
    container.append(nav);
  }

  function entryName(entry) {
    return label(entry.name || entry.title || entry.id);
  }

  function entryIcon(entry) {
    const isFolder = entry.kind === 'folder' || entry.type === 'folder';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('workstation-entry-icon', isFolder ? 'is-folder' : 'is-file');
    svg.innerHTML = isFolder
      ? '<path d="M3.5 7.5h6l1.8 2h9.2v9.2H3.5z"/><path d="M3.5 7.5V5.3h6.2l1.7 2.2"/>'
      : '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/>';
    return svg;
  }

  function entryButton(entry, extraAttributes = {}) {
    const isFolder = entry.kind === 'folder' || entry.type === 'folder';
    const name = entryName(entry);
    const button = createButton('', {
      'data-workstation-entry': entry.id,
      'data-workstation-id': entry.id,
      ...extraAttributes
    });
    button.dataset.workstationEntry = entry.id;
    button.dataset.workstationId = entry.id;
    button.dataset.entryKind = isFolder ? 'folder' : 'file';
    button.dataset.entryState = entry.locked === true ? 'locked' : 'available';
    button.setAttribute('aria-label', name);
    const icon = entryIcon(entry);
    if (entry.locked === true) icon.classList.add('is-locked');
    const textNode = document.createElement('span');
    textNode.className = 'workstation-entry-name';
    textNode.textContent = name;
    button.append(icon, textNode);
    if (entry.locked === true) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.addEventListener('click', () => openEntry(entry.id));
    }
    return button;
  }

  function folderPathFor(folderId, entries, rootId) {
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const path = [];
    const seen = new Set();
    let current = folderId;
    while (current && !seen.has(current)) {
      seen.add(current);
      path.unshift(current);
      if (current === rootId) break;
      current = byId.get(current)?.parentId;
    }
    return path[0] === rootId ? path : (rootId ? [rootId] : []);
  }

  function renderFiles(container, view) {
    const entries = filesFor(view);
    const rootId = rootIdFor(view, entries);
    const isFolder = entry => entry.kind === 'folder' || entry.type === 'folder';
    const folders = entries.filter(isFolder);
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const childrenOf = parentId => entries
      .filter(entry => entry.parentId === parentId)
      .sort((a, b) => {
        const folderOrder = Number(isFolder(b)) - Number(isFolder(a));
        return folderOrder || entryName(a).localeCompare(entryName(b), undefined, { numeric: true, sensitivity: 'base' });
      });

    if (!folderPath.length || !byId.has(folderPath[folderPath.length - 1])
      || !isFolder(byId.get(folderPath[folderPath.length - 1]))) folderPath = rootId ? [rootId] : [];
    if (rootId && !expandedFolders.has(rootId)) expandedFolders.add(rootId);
    expandedFolders = new Set([...expandedFolders].filter(folderId => byId.has(folderId) && isFolder(byId.get(folderId))));
    const folderId = folderPath[folderPath.length - 1] || rootId;
    const folder = byId.get(folderId);
    const opened = byId.get(currentView.__openedEntry);

    const filesLayout = document.createElement('div');
    filesLayout.className = 'workstation-files-layout';

    const treePanel = document.createElement('aside');
    treePanel.className = 'workstation-file-tree';
    treePanel.dataset.workstationTree = '';
    treePanel.setAttribute('aria-label', 'Files and folders');
    const treeHeading = document.createElement('h3');
    treeHeading.textContent = 'FILES';
    treePanel.append(treeHeading);
    const tree = document.createElement('div');
    tree.className = 'workstation-folder-tree';
    tree.setAttribute('role', 'tree');

    const renderTreeEntry = (entry, depth = 0) => {
      const folderEntry = isFolder(entry);
      const expanded = expandedFolders.has(entry.id);
      const button = createButton('', {
        'data-workstation-entry': entry.id,
        'data-workstation-id': entry.id,
        'data-entry-kind': folderEntry ? 'folder' : 'file',
        'aria-selected': String(entry.id === folderId || entry.id === opened?.id),
        ...(folderEntry ? { 'aria-expanded': String(expanded) } : {})
      });
      button.className = `workstation-tree-entry ${folderEntry ? 'is-folder' : 'is-file'}`;
      button.style.setProperty('--folder-depth', depth);
      button.setAttribute('aria-label', entryName(entry));
      button.dataset.entryState = entry.locked === true ? 'locked' : 'available';
      const twisty = document.createElement('span');
      twisty.className = `workstation-tree-twisty ${folderEntry ? '' : 'is-hidden'}`;
      twisty.setAttribute('aria-hidden', 'true');
      twisty.textContent = folderEntry ? (expanded ? '▾' : '▸') : '';
      const icon = entryIcon(entry);
      if (entry.locked === true) icon.classList.add('is-locked');
      button.append(twisty, icon, Object.assign(document.createElement('span'), {
        className: 'workstation-entry-name', textContent: entryName(entry)
      }));
      if (entry.locked === true) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      } else if (folderEntry) {
        button.addEventListener('click', () => {
          captureViewState();
          if (expanded) expandedFolders.delete(entry.id);
          else expandedFolders.add(entry.id);
          folderPath = folderPathFor(entry.id, entries, rootId);
          currentView = { ...currentView };
          delete currentView.__openedEntry;
          lastFocusId = entry.id;
          render(currentView);
        });
      } else {
        button.addEventListener('click', () => openEntry(entry.id));
      }
      tree.append(button);
      if (folderEntry && expanded) {
        for (const child of childrenOf(entry.id)) renderTreeEntry(child, depth + 1);
      }
    };

    const rootFolder = folders.find(entry => entry.id === rootId);
    if (rootFolder) renderTreeEntry(rootFolder);
    treePanel.append(tree);

    const directory = document.createElement('section');
    directory.className = 'workstation-directory workstation-scroll';
    directory.dataset.workstationDirectory = '';
    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'workstation-breadcrumb';
    breadcrumb.textContent = folderPath.map(idValue => entryName(byId.get(idValue) || { name: idValue })).join(' / ');
    directory.append(breadcrumb);
    const heading = document.createElement('h3');
    heading.textContent = opened && !isFolder(opened) ? entryName(opened) : entryName(folder || { name: 'FILES' });
    directory.append(heading);

    if (folderPath.length > 1 || opened) {
      const back = createButton(opened ? 'Back to folder' : 'Back', { 'data-workstation-back': '' });
      back.addEventListener('click', () => {
        captureViewState();
        if (opened) {
          currentView = { ...currentView };
          delete currentView.__openedEntry;
          lastFocusId = folderId;
        } else {
          expandedFolders.delete(folderId);
          folderPath.pop();
          lastFocusId = folderPath[folderPath.length - 1] || '';
        }
        render(currentView);
      });
      directory.append(back);
    }

    if (!opened && folderId === rootId && typeof view.text === 'string' && view.text.trim()) {
      const startup = document.createElement('section');
      startup.dataset.startupNote = '';
      startup.className = 'workstation-startup-note';
      const startupLabel = document.createElement('span');
      startupLabel.textContent = 'STARTUP NOTE // README';
      const startupText = document.createElement('p');
      startupText.textContent = view.text;
      startup.append(startupLabel, startupText);
      directory.append(startup);
    }

    if (opened && !isFolder(opened)) {
      const documentPanel = document.createElement('article');
      documentPanel.className = 'workstation-document';
      documentPanel.dataset.workstationDocument = '';
      const documentTitle = document.createElement('h4');
      documentTitle.append(entryIcon(opened), document.createTextNode(entryName(opened)));
      const content = document.createElement('pre');
      content.dataset.workstationEntryContent = '';
      content.textContent = typeof opened.content === 'string' ? opened.content
        : typeof opened.text === 'string' ? opened.text : '';
      documentPanel.append(documentTitle, content);
      if (opened.puzzleId && opened.opened === true && opened.complete !== true && typeof onPuzzleAction === 'function') {
        const puzzleForm = document.createElement('form');
        puzzleForm.dataset.investigationForm = opened.puzzleId;
        const puzzleInput = document.createElement('input');
        puzzleInput.name = 'value';
        puzzleInput.maxLength = 1000;
        puzzleInput.autocomplete = 'off';
        puzzleInput.placeholder = 'enter response';
        const puzzleButton = createButton('SUBMIT NOTE');
        puzzleButton.type = 'submit';
        puzzleForm.append(puzzleInput, puzzleButton);
        puzzleForm.addEventListener('submit', event => {
          event.preventDefault();
          onPuzzleAction({ puzzleId: opened.puzzleId, stepId: opened.stepId || 'inspect', value: puzzleInput.value, actionId: randomId() });
        });
        documentPanel.append(puzzleForm);
      }
      directory.append(documentPanel);
    } else if (!view.text && !opened) {
      const empty = document.createElement('p');
      empty.className = 'workstation-directory-empty';
      empty.textContent = '從左側選取文件以開啟完整內容。';
      directory.append(empty);
    }

    filesLayout.append(treePanel, directory);
    container.append(filesLayout);
  }

  function renderTerminal(container, view) {
    const panel = document.createElement('div');
    panel.className = 'workstation-terminal';
    panel.dataset.workstationTerminal = '';
    const roleMatch = String(host.closest('[data-game-room]')?.className || '').match(/(?:^|\s)role-([ab])(?:\s|$)/i);
    const role = (roleMatch?.[1] || 'a').toUpperCase();
    const prompt = `${role.toLowerCase()}@orpheus:~$`;
    const readout = document.createElement('div');
    readout.className = 'terminal-readout';
    const led = document.createElement('span');
    led.className = 'terminal-readout-led';
    led.setAttribute('aria-hidden', 'true');
    const transport = document.createElement('span');
    transport.textContent = 'SECURE SHELL // TTY-02';
    const pathReadout = document.createElement('span');
    pathReadout.className = 'terminal-readout-path';
    pathReadout.textContent = '/home/orpheus';
    readout.append(led, transport, pathReadout);
    panel.append(readout);
    const heading = document.createElement('h3');
    heading.textContent = 'TERMINAL // COMMAND PROMPT';
    panel.append(heading);
    const history = document.createElement('div');
    history.dataset.terminalHistory = '';
    history.className = 'terminal-history';
    history.setAttribute('role', 'log');
    history.setAttribute('aria-live', 'polite');
    for (const item of terminalHistory) {
      const line = document.createElement('div');
      line.className = 'terminal-history-entry';
      const echo = document.createElement('div');
      echo.className = 'terminal-echo';
      echo.textContent = `${prompt} ${item.command}`;
      line.append(echo);
      if (item.output) {
        const output = document.createElement('pre');
        output.dataset.terminalOutput = '';
        output.className = item.error ? 'terminal-output terminal-output-error' : 'terminal-output';
        output.textContent = item.output;
        line.append(output);
      }
      history.append(line);
    }
    panel.append(history);
    const form = document.createElement('form');
    form.dataset.workstationTerminalForm = '';
    form.className = 'terminal-command-form';
    const labelNode = document.createElement('label');
    labelNode.textContent = 'COMMAND INPUT';
    labelNode.htmlFor = `terminal-command-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    labelNode.className = 'visually-hidden';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = labelNode.htmlFor;
    input.dataset.terminalInput = '';
    input.dataset.workstationId = 'terminal-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'type HELP for available commands';
    input.maxLength = 1000;
    const promptNode = document.createElement('span');
    promptNode.className = 'terminal-prompt';
    promptNode.dataset.terminalPrompt = '';
    promptNode.textContent = prompt;
    const submit = createButton('↵', { 'data-terminal-submit': '', 'aria-label': 'Execute command' });
    submit.type = 'submit';
    const suggestions = document.createElement('div');
    suggestions.className = 'terminal-suggestions';
    suggestions.dataset.terminalSuggestions = '';
    suggestions.hidden = true;
    suggestions.setAttribute('role', 'listbox');
    const suggestionCommands = ['HELP', 'SEARCH <node>', 'SCAN <filename>', 'UNZIP <filename>', 'HINT', 'SEND <text>'];
    const suggestionButtons = suggestionCommands.map(command => {
      const suggestion = createButton(command, { 'data-terminal-suggestion': command });
      suggestion.addEventListener('click', () => {
        input.value = command;
        suggestions.hidden = true;
        input.focus();
      });
      suggestions.append(suggestion);
      return suggestion;
    });
    const updateSuggestions = () => {
      const value = input.value.trimStart();
      const active = value.startsWith('/');
      const query = value.slice(1).trim().toUpperCase();
      suggestionButtons.forEach(button => {
        button.hidden = Boolean(query) && !button.dataset.terminalSuggestion.startsWith(query);
      });
      suggestions.hidden = !active || !suggestionButtons.some(button => !button.hidden);
    };
    input.addEventListener('input', updateSuggestions);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        suggestions.hidden = true;
        return;
      }
    });
    form.append(labelNode, promptNode, input, submit);
    panel.append(suggestions);
    input.addEventListener('keydown', event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      if (!terminalHistory.length) return;
      event.preventDefault();
      if (event.key === 'ArrowUp') {
        terminalHistoryIndex = terminalHistoryIndex < 0
          ? terminalHistory.length - 1 : Math.max(0, terminalHistoryIndex - 1);
      } else {
        terminalHistoryIndex = terminalHistoryIndex < 0
          ? terminalHistory.length : Math.min(terminalHistory.length, terminalHistoryIndex + 1);
      }
      input.value = terminalHistoryIndex >= 0 && terminalHistoryIndex < terminalHistory.length
        ? terminalHistory[terminalHistoryIndex].command : '';
      input.setSelectionRange(input.value.length, input.value.length);
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      suggestions.hidden = true;
      terminalHistory.push({ command: value, output: '' });
      terminalHistoryIndex = -1;
      lastFocusId = 'terminal-input';
      render(currentView);
      invokeOperation({ operationId: 'terminal_command', value });
    });
    panel.append(form);
    container.append(panel);
  }

  function renderRequest(container, view) {
    const panel = document.createElement('section');
    panel.className = 'workstation-request';
    panel.dataset.workstationRequest = '';
    const heading = document.createElement('h3');
    heading.textContent = 'REQUEST // SECURE RESPONSE';
    panel.append(heading);
    const gate = view.answerGate;
    if (!gate?.open) {
      const standby = document.createElement('p');
      standby.className = 'workstation-request-standby';
      standby.textContent = '目前沒有待處理的回應需求。';
      panel.append(standby);
      container.append(panel);
      return;
    }

    const operations = host.closest('[data-operations-workspace]');
    const bridge = operations?.querySelector('[data-action-form]') || document.querySelector('[data-action-form]');
    const prompt = document.createElement('p');
    prompt.className = 'workstation-request-prompt';
    prompt.textContent = bridge?.querySelector('[data-prompt]')?.textContent || '輸入目前階段的解鎖密碼。';
    const format = document.createElement('p');
    format.className = 'workstation-request-format';
    format.textContent = bridge?.querySelector('[data-puzzle-format]')?.textContent || '請先比對兩端資訊，再送出回應。';
    panel.append(prompt, format);

    const form = document.createElement('form');
    form.dataset.workstationAnswerForm = '';
    const labelNode = document.createElement('label');
    labelNode.textContent = 'SECURE RESPONSE / 解鎖密碼';
    const input = document.createElement('input');
    input.name = 'value';
    input.maxLength = 1000;
    input.required = true;
    input.autocomplete = 'off';
    input.placeholder = '輸入解鎖密碼';
    const submit = createButton('VERIFY RESPONSE');
    submit.type = 'submit';
    const feedback = document.createElement('p');
    feedback.dataset.workstationRequestFeedback = '';
    feedback.className = 'workstation-request-feedback';
    feedback.textContent = bridge?.querySelector('[data-feedback]')?.textContent || '';
    form.append(labelNode, input, submit, feedback);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const bridgeInput = bridge?.elements?.value;
      const bridgeButton = bridge?.querySelector('button');
      if (!bridge || !bridgeInput || bridgeButton?.disabled) return;
      bridgeInput.value = input.value;
      bridgeButton.click();
    });
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
    const previousOpened = currentView.__openedEntry;
    const incoming = next && typeof next === 'object' ? next : {};
    // Poll/live snapshots do not carry a client navigation cursor. Keep the
    // note currently open as long as that entry is still in the safe actor
    // projection, so a state update never ejects the player from a document.
    currentView = previousOpened && projectedEntries(incoming).some(entry => entry.id === previousOpened)
      ? { ...incoming, __openedEntry: previousOpened } : incoming;
    const answerForm = host.closest('[data-operations-workspace]')?.querySelector('[data-action-form]')
      || document.querySelector('[data-action-form]');
    const puzzleGate = host.closest('[data-operations-workspace]')?.querySelector('[data-puzzle-gate]');
    if (answerForm) {
      answerForm.hidden = true;
      answerForm.setAttribute('aria-hidden', 'true');
      if (puzzleGate) {
        puzzleGate.hidden = true;
        puzzleGate.setAttribute('aria-hidden', 'true');
      }
    }
    const apps = appsFor(currentView);
    if ((activeApp !== 'terminal' && activeApp !== 'request') || activeApp === 'request') {
      const selected = apps.find(app => app.id === activeApp);
      if (!selected || (activeApp === 'request' && selected.ready !== true)) activeApp = apps[0]?.id || 'files';
    }
    const layout = document.createElement('section');
    layout.className = 'workstation-ui';
    layout.dataset.workstationView = activeApp;
    renderApps(layout, apps);
    const content = document.createElement('section');
    content.className = 'workstation-content';
    content.setAttribute('aria-live', 'polite');
    if (activeApp === 'terminal') renderTerminal(content, currentView);
    else if (activeApp === 'logs') renderLogs(content, currentView);
    else if (activeApp === 'request') renderRequest(content, currentView);
    else renderFiles(content, currentView);
    layout.append(content);
    host.replaceChildren(layout);
    const scrollKey = `${activeApp}:${folderPath.join('/')}:${currentView.__openedEntry || ''}`;
    const scrolls = host.querySelectorAll('[data-workstation-tree], [data-workstation-scroll], [data-terminal-history], [data-workstation-log]');
    scrolls.forEach((scroll, index) => {
      scroll.scrollTop = scrollPositions.get(`${scrollKey}:${index}`) || 0;
    });
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
    if (entry.app === 'terminal' || entry.launchApp === 'terminal') {
      activeApp = 'terminal';
      folderPath = [];
      currentView = { ...currentView };
      delete currentView.__openedEntry;
      lastFocusId = 'terminal-input';
      render(currentView);
      window.queueMicrotask(() => host.querySelector('[data-terminal-input]')?.focus());
      return;
    }
    if (isFolder) {
      if (!folderPath.includes(entry.id)) folderPath.push(entry.id);
    } else {
      currentView = { ...currentView, __openedEntry: entry.id };
    }
    lastFocusId = entry.id;
    render(currentView);
    // Opening a record is a stateful workstation action. Persist it so
    // server-side mission triggers and role-local openedEntryIds stay in sync
    // across refreshes and the other player's projection remains untouched.
    if (entry.puzzleId && typeof onPuzzleAction === 'function' && entry.opened !== true) {
      onPuzzleAction({ puzzleId: entry.puzzleId, stepId: 'inspect', value: '', actionId: randomId() });
    } else if (typeof onOperation === 'function') {
      onOperation({ operationId: 'open_entry', value: entry.id, actionId: randomId() });
    }
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

  function appendTerminalResult(result = {}) {
    const latest = terminalHistory[terminalHistory.length - 1];
    const output = typeof result.output === 'string' ? result.output : '';
    const command = typeof result.command === 'string' ? result.command : '';
    if (!output && !command) return;
    const error = typeof result.error === 'string' ? result.error : '';
    if (latest && !latest.output) {
      latest.output = output || error;
      latest.error = Boolean(error);
    }
    else terminalHistory.push({ command: command || 'SYSTEM', output: output || error, error: Boolean(error) });
    lastFocusId = 'terminal-input';
    render(currentView);
  }

  return { render, openApp, openEntry, restoreFocus, appendTerminalResult };
}
