/**
 * Compatibility adapter for the original side-puzzle, evidence, audio, and
 * ending panels. The game coordinator supplies state and action callbacks;
 * this module owns all legacy DOM construction so live rendering stays small.
 */
export function createLegacyPanels(root, { sendAction, isBusy } = {}) {
  if (!root || typeof sendAction !== 'function') throw new TypeError('Legacy panel adapter is incomplete');
  const investigations = new Map();

  function renderSide(view, state) {
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
        sendAction(actionForm, {
          puzzleId: section.view.puzzleId,
          stepId: section.view.opened ? section.view.stepId : 'inspect',
          value: section.view.opened ? input.value : ''
        }, feedback);
      });
      investigations.set(view.puzzleId, section);
      container.append(section);
    }
    if (section.view && section.view.stepId !== view.stepId) {
      section.ui.actionForm.reset();
      section.ui.feedback.textContent = '';
    }
    section.view = view;
    section.dataset.step = view.stepId || '';
    const ui = section.ui;
    ui.heading.textContent = view.title;
    ui.hook.textContent = view.hook;
    ui.prompt.textContent = view.prompt || '';
    const clue = state.clues?.sideClues?.find(item => item.puzzleId === view.puzzleId);
    ui.clue.textContent = clue?.text || '';
    ui.label.hidden = ui.input.hidden = !view.opened || view.complete;
    ui.input.required = view.opened && !view.complete;
    ui.button.textContent = view.complete ? '已歸檔' : view.opened ? '核對紀錄' : '查看異常紀錄';
    ui.button.disabled = view.complete || Boolean(state.ending) || Boolean(isBusy?.(ui.actionForm));
  }

  function render(next) {
    const state = { ...next, clues: next.clues || next.workstation || {} };
    for (const side of state.publicProgress?.sidePuzzles || []) renderSide(side, state);

    const evidence = root.querySelector('[data-evidence]');
    if (evidence) {
      evidence.replaceChildren();
      if (!state.discoveredEvidence?.length) evidence.textContent = '尚未取得證據。留意紀錄之間的差異。';
      for (const item of state.discoveredEvidence || []) {
        const record = document.createElement('article');
        const title = document.createElement('h3');
        const summary = document.createElement('p');
        title.textContent = item.title;
        summary.textContent = item.summary;
        record.append(title, summary);
        evidence.append(record);
      }
    }

    const audioContainer = root.querySelector('[data-audio]');
    if (audioContainer && audioContainer.dataset.source !== (state.clues.audioUrl || '')) {
      audioContainer.replaceChildren();
      audioContainer.dataset.source = state.clues.audioUrl || '';
      if (state.clues.audioUrl) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = state.clues.audioUrl;
        audio.setAttribute('aria-label', '緊急電力訊號；文字轉錄見下方線索');
        audio.style.maxWidth = '100%';
        audioContainer.append(audio);
      }
    }

    const ending = root.querySelector('[data-ending]');
    if (ending) {
      ending.hidden = !state.ending;
      if (state.ending) {
        ending.replaceChildren();
        const title = document.createElement('h2');
        const body = document.createElement('p');
        const debriefList = document.createElement('ol');
        debriefList.dataset.debrief = '';
        const back = document.createElement('a');
        title.textContent = state.ending.title;
        body.textContent = state.ending.text;
        for (const item of Array.isArray(state.debrief) ? state.debrief : []) {
          const record = document.createElement('li');
          const claim = document.createElement('strong');
          const effect = document.createElement('p');
          const sources = document.createElement('small');
          claim.textContent = item.surfaceClaim || item.factId || '';
          effect.textContent = item.actualEffect || '';
          sources.textContent = Array.isArray(item.verificationEntryIds)
            ? item.verificationEntryIds.join(', ') : '';
          record.append(claim, effect, sources);
          debriefList.append(record);
        }
        back.href = '/';
        back.textContent = '回到大廳，開始新的實驗';
        ending.append(title, body, debriefList, back);
      }
    }
  }

  return { render };
}
