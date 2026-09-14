(() => {
  const root = document.querySelector('[data-game-room]');
  if (!root) return;
  const endpoint = '/api/rooms/' + root.dataset.gameRoom;
  const form = root.querySelector('[data-action-form]');
  const connection = root.querySelector('[data-connection]');
  const chatForm = root.querySelector('[data-chat-form]');
  const pending = new WeakMap();
  const busy = new WeakSet();
  const investigations = new Map();
  let state;
  let intercom;
  let workstation;
  let liveTransport;
  let latestCountdown;

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

  function renderSide(view) {
    const container = root.querySelector('[data-sides]');
    if (!container) return;
    let section = investigations.get(view.puzzleId);
    if (!section) {
      section = document.createElement('article');
      section.className = 'investigation';
      const heading = document.createElement('h3');
      const hook = document.createElement('p');
      const clue = document.createElement('pre');
      const actionForm = document.createElement('form');
      const prompt = document.createElement('p');
      const label = document.createElement('label');
      const input = document.createElement('input');
      const button = document.createElement('button');
      const feedback = document.createElement('p');
      input.id = view.puzzleId + '-answer';
      input.name = 'value';
      input.maxLength = 1000;
      label.htmlFor = input.id;
      label.textContent = '調查答案';
      button.type = 'submit';
      feedback.setAttribute('role', 'status');
      actionForm.append(prompt, label, input, button, feedback);
      section.append(heading, hook, clue, actionForm);
      section.ui = { heading, hook, clue, actionForm, prompt, label, input, button, feedback };
      actionForm.addEventListener('submit', event => {
        event.preventDefault();
        sendAction(actionForm, { puzzleId: section.view.puzzleId,
          stepId: section.view.opened ? section.view.stepId : 'inspect',
          value: section.view.opened ? input.value : '' }, feedback);
      });
      investigations.set(view.puzzleId, section);
      container.append(section);
    }
    if (section.view && section.view.stepId !== view.stepId) {
      section.ui.actionForm.reset();
      section.ui.feedback.textContent = '';
      pending.delete(section.ui.actionForm);
    }
    section.view = view;
    section.dataset.step = view.stepId || '';
    const ui = section.ui;
    ui.heading.textContent = view.title;
    ui.hook.textContent = view.hook;
    ui.prompt.textContent = view.prompt || '';
    const clue = state.clues.sideClues?.find(item => item.puzzleId === view.puzzleId);
    ui.clue.textContent = clue?.text || '';
    ui.label.hidden = ui.input.hidden = !view.opened || view.complete;
    ui.input.required = view.opened && !view.complete;
    ui.button.textContent = view.complete ? '已歸檔' : view.opened ? '核對紀錄' : '查看異常紀錄';
    ui.button.disabled = view.complete || Boolean(state.ending) || busy.has(ui.actionForm);
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
    connection.textContent = next.occupancy.ready ? '兩位受試者已連線' : '等待另一位受試者';
    text('[data-occupancy]', next.occupancy.ready ? '房間狀態：兩位玩家已就緒' : '房間狀態：等待另一位玩家加入');
    const progress = next.publicProgress;
    root.dataset.step = `${progress.puzzleId || ''}:${progress.stepId || ''}`;
    text('[data-prompt]', progress.prompt || (next.ending ? '實驗已結束。' : '等待設施指示'));
    text('[data-clues]', next.clues.text || '');
    const audioContainer = root.querySelector('[data-audio]');
    if (audioContainer && audioContainer.dataset.source !== (next.clues.audioUrl || '')) {
      audioContainer.replaceChildren();
      audioContainer.dataset.source = next.clues.audioUrl || '';
      if (next.clues.audioUrl) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = next.clues.audioUrl;
        audio.setAttribute('aria-label', '緊急電力訊號；文字轉錄見下方線索');
        audio.style.maxWidth = '100%';
        audioContainer.append(audio);
      }
    }
    text('[data-stage]', progress.title || '出口協定');
    countdown(next.countdown);
    intercom.render(next.intercom || []);
    if (workstation) workstation.render(next.workstation || {});
    form.querySelector('button').disabled = busy.has(form) || !next.occupancy.ready || !progress.stepId || Boolean(next.ending);
    for (const side of progress.sidePuzzles || []) renderSide(side);
    const evidence = root.querySelector('[data-evidence]');
    if (evidence) {
      evidence.replaceChildren();
      if (!next.discoveredEvidence.length) evidence.textContent = '尚未取得證據。留意紀錄之間的差異。';
      for (const item of next.discoveredEvidence) {
        const record = document.createElement('article');
        const title = document.createElement('h3');
        const summary = document.createElement('p');
        title.textContent = item.title;
        summary.textContent = item.summary;
        record.append(title, summary);
        evidence.append(record);
      }
    }
    const ending = root.querySelector('[data-ending]');
    if (ending) {
      ending.hidden = !next.ending;
      if (next.ending) {
        ending.replaceChildren();
        const title = document.createElement('h2');
        const body = document.createElement('p');
        const back = document.createElement('a');
        title.textContent = next.ending.title;
        body.textContent = next.ending.text;
        back.href = '/';
        back.textContent = '回到大廳，開始新的實驗';
        ending.append(title, body, back);
      }
    }
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
    if (status === 'lost') {
      connection.textContent = 'SIGNAL LOST';
      return;
    }
    if (state) {
      connection.textContent = state.occupancy.ready ? '兩位受試者已連線' : '等待另一位受試者';
    }
  }

  Promise.all([
    import('/public/js/intercom.js'),
    import('/public/js/workstation.js'),
    import('/public/js/live.js')
  ]).then(([{ createIntercom }, { createWorkstation }, { createLiveTransport }]) => {
    intercom = createIntercom(root);
    workstation = createWorkstation(root, { onOperation: sendWorkstationOperation });
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
