(() => {
  const root = document.querySelector('[data-game-room]');
  if (!root) return;
  const endpoint = '/api/rooms/' + root.dataset.gameRoom;
  const form = root.querySelector('[data-action-form]');
  const connection = root.querySelector('[data-connection]');
  const chatForm = root.querySelector('[data-chat-form]');
  const pending = new WeakMap();
  const busy = new WeakSet();
  let state;
  let intercom;
  let workstation;
  let legacyPanels;
  let liveTransport;
  let latestCountdown;
  let transportStatus = 'booting';

  // The two monitors share one DOM tree. On narrow screens we only hide the
  // inactive monitor; its form values, scroll position, and focus target stay
  // mounted so switching panes never loses player input.
  function setupPaneController() {
    const selector = root.querySelector('.monitor-selector');
    const tabs = [...root.querySelectorAll('.monitor-tab-input')];
    const monitors = {
      'monitor-intercom': root.querySelector('.intercom-monitor'),
      'monitor-operations': root.querySelector('.operations-monitor')
    };
    if (!selector || tabs.length === 0) return;

    const focusByMonitor = new Map();
    const media = window.matchMedia('(max-width: 759px)');
    let activeId = tabs.find(tab => tab.checked)?.id || tabs[0].id;

    function rememberFocus() {
      const active = document.activeElement;
      for (const [id, monitor] of Object.entries(monitors)) {
        if (monitor?.contains(active)) {
          const key = active.id || active.dataset.workstationId || active.dataset.workstationApp;
          if (key) focusByMonitor.set(id, key);
        }
      }
    }

    function restoreFocus(id) {
      const key = focusByMonitor.get(id);
      if (!key) return;
      const monitor = monitors[id];
      if (!monitor) return;
      const target = monitor.querySelector(`#${CSS.escape(key)}, [data-workstation-id="${CSS.escape(key)}"], [data-workstation-app="${CSS.escape(key)}"]`);
      if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    }

    function apply() {
      const mobile = media.matches;
      for (const tab of tabs) {
        const selected = tab.id === activeId;
        tab.setAttribute('aria-selected', String(selected));
        tab.setAttribute('aria-checked', String(selected));
        const monitor = monitors[tab.id];
        if (monitor && !monitor.id) monitor.id = `${tab.id}-pane`;
        const label = root.querySelector(`label[for="${CSS.escape(tab.id)}"]`);
        if (label) {
          label.setAttribute('role', 'tab');
          label.setAttribute('aria-selected', String(selected));
          if (monitor?.id) label.setAttribute('aria-controls', monitor.id);
        }
        if (!monitor) continue;
        monitor.hidden = mobile && !selected;
        monitor.setAttribute('aria-hidden', String(mobile && !selected));
        monitor.toggleAttribute('inert', mobile && !selected);
      }
      selector.dataset.activeMonitor = activeId;
    }

    for (const tab of tabs) {
      tab.setAttribute('role', 'radio');
      tab.addEventListener('change', () => {
        rememberFocus();
        activeId = tab.id;
        apply();
        window.queueMicrotask(() => restoreFocus(activeId));
      });
    }
    const onResize = () => apply();
    media.addEventListener?.('change', onResize);
    window.addEventListener('resize', onResize);
    apply();
  }

  setupPaneController();

  function text(selector, value) {
    const node = root.querySelector(selector);
    if (node) node.textContent = value;
  }

  function countdown(value) {
    const remaining = value?.remainingMs;
    text('[data-countdown]', remaining == null ? '等待連線' :
      String(Math.floor(remaining / 60000)).padStart(2, '0') + ':' +
      String(Math.floor(remaining / 1000) % 60).padStart(2, '0'));
    root.classList.toggle('emergency', value?.status === 'emergency');
  }

  function render(next, nextCountdown) {
    next = {
      ...next,
      clues: next.clues || next.workstation || {},
      countdown: nextCountdown || next.countdown || latestCountdown
    };
    latestCountdown = next.countdown;
    if (state && (state.publicProgress.puzzleId !== next.publicProgress.puzzleId
      || state.publicProgress.stepId !== next.publicProgress.stepId)) {
      form.reset();
      pending.delete(form);
      text('[data-feedback]', '');
    }
    state = next;
    if (transportStatus !== 'lost' && transportStatus !== 'reconnecting') {
      connection.textContent = next.occupancy.ready ? '兩位受試者已連線' : '等待另一位受試者';
    }
    text('[data-occupancy]', next.occupancy.ready ? '房間狀態：兩位玩家已就緒' : '房間狀態：等待另一位玩家加入');
    const progress = next.publicProgress;
    root.dataset.step = `${progress.puzzleId || ''}:${progress.stepId || ''}`;
    text('[data-prompt]', progress.prompt || (next.ending ? '實驗已結束。' : '等待設施指示'));
    text('[data-clues]', next.clues.text || '');
    text('[data-stage]', progress.title || '出口協定');
    countdown(next.countdown);
    intercom.render(next.intercom || []);
    if (workstation) workstation.render(next.workstation || {});
    if (legacyPanels) legacyPanels.render(next);
    form.querySelector('button').disabled = busy.has(form) || !next.occupancy.ready || !progress.stepId || Boolean(next.ending);
  }

  async function sendAction(target, action, feedback) {
    if (busy.has(target)) return;
    let request = pending.get(target);
    if (!request || request.value !== action.value || request.stepId !== action.stepId) {
      request = { ...action, actionId: crypto.randomUUID() };
      pending.set(target, request);
    }
    busy.add(target);
    target.querySelector('button').disabled = true;
    try {
      const response = await fetch(endpoint + '/actions', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request)
      });
      const result = await response.json();
      if (!response.ok) {
        pending.delete(target);
        throw new Error(result.message);
      }
      pending.delete(target);
      if (target.elements.value.value === request.value) target.reset();
      feedback.textContent = result.publicResult?.message || (result.publicResult?.correct === false ? '資料不符，請查看通訊中的提示。' : '操作已記錄');
      if (liveTransport) liveTransport.adopt(result);
      else render(result.state, result.countdown);
    } catch (error) {
      feedback.textContent = error.message + '；輸入已保留，可重新送出。';
    } finally {
      busy.delete(target);
      if (state) render(state);
    }
  }

  async function sendWorkstationOperation(operation) {
    if (!operation || typeof operation.operationId !== 'string') return;
    const request = {
      actionId: operation.actionId || crypto.randomUUID(),
      operationId: operation.operationId,
      ...(typeof operation.value === 'string' ? { value: operation.value } : {})
    };
    try {
      const response = await fetch(endpoint + '/actions', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Operation failed');
      if (liveTransport && result.state) liveTransport.adopt(result);
      else if (result.state) render(result.state, result.countdown);
    } catch (error) {
      text('[data-feedback]', error.message);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!state || form.querySelector('button').disabled) return;
    sendAction(form, { puzzleId: state.publicProgress.puzzleId,
      stepId: state.publicProgress.stepId, value: form.elements.value.value }, root.querySelector('[data-feedback]'));
  });

  chatForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy.has(chatForm)) return;
    const value = chatForm.elements.text.value;
    let request = pending.get(chatForm);
    if (!request || request.text !== value) {
      request = { actionId: crypto.randomUUID(), text: value };
      pending.set(chatForm, request);
    }
    busy.add(chatForm);
    chatForm.querySelector('button').disabled = true;
    try {
      const response = await fetch(endpoint + '/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request)
      });
      const result = await response.json();
      if (!response.ok) {
        pending.delete(chatForm);
        throw new Error(result.message);
      }
      pending.delete(chatForm);
      if (chatForm.elements.text.value === request.text) chatForm.reset();
      text('[data-chat-feedback]', '');
      if (liveTransport) liveTransport.adopt(result);
      else render(result.state, result.countdown);
    } catch (error) {
      text('[data-chat-feedback]', '訊息未確認送達，請重試：' + error.message);
    } finally {
      busy.delete(chatForm);
      chatForm.querySelector('button').disabled = false;
    }
  });

  function updateConnection(status) {
    transportStatus = status || 'ready';
    const band = root.querySelector('.connection-band');
    const light = root.querySelector('[data-connection-light]') || root.querySelector('.readout-dot');
    const labels = { lost: 'SIGNAL LOST', reconnecting: 'RECONNECTING', ready: 'LINK ACTIVE' };
    const label = labels[status];
    if (label) connection.textContent = label;
    else if (state) connection.textContent = state.occupancy.ready ? '兩位受試者已連線' : '等待另一位受試者';
    if (band) {
      band.dataset.signal = status || 'ready';
      band.classList.toggle('signal-lost', status === 'lost');
      band.classList.toggle('signal-reconnecting', status === 'reconnecting');
      band.classList.toggle('signal-ready', status === 'ready' || !status);
    }
    if (light) {
      light.classList.toggle('readout-dot-lost', status === 'lost');
      light.classList.toggle('readout-dot-reconnecting', status === 'reconnecting');
    }
  }

  Promise.all([
    import('/public/js/intercom.js'),
    import('/public/js/workstation.js'),
    import('/public/js/live.js'),
    import('/public/js/legacyPanels.js')
  ]).then(([{ createIntercom }, { createWorkstation }, { createLiveTransport }, { createLegacyPanels }]) => {
    intercom = createIntercom(root);
    workstation = createWorkstation(root, { onOperation: sendWorkstationOperation });
    legacyPanels = createLegacyPanels(root, { sendAction, isBusy: target => busy.has(target) });
    root.workstation = workstation;
    liveTransport = createLiveTransport({
      roomCode: root.dataset.gameRoom,
      onSnapshot: render,
      onCountdown: countdown,
      onStatus: updateConnection
    });
    return liveTransport.start();
  }).catch(error => {
    connection.textContent = 'SIGNAL LOST';
    text('[data-chat-feedback]', error.message);
  });
})();
