const MODES = new Set(['websocket', 'polling', 'resyncing']);
const BASE_DELAY = 1200;
const MAX_DELAY = 10000;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value) {
  return value === undefined || value === null || typeof value === 'string';
}

function isMessage(value) {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.type === undefined || typeof value.type === 'string')
    && typeof value.text === 'string'
    && optionalString(value.role);
}

function isEvidence(value) {
  return isRecord(value)
    && optionalString(value.title)
    && optionalString(value.summary);
}

function isSidePuzzle(value) {
  return isRecord(value)
    && typeof value.puzzleId === 'string'
    && optionalString(value.stepId)
    && optionalString(value.title)
    && optionalString(value.hook)
    && optionalString(value.prompt);
}

function isWorkstation(value) {
  return isRecord(value)
    && optionalString(value.text)
    && optionalString(value.audioUrl)
    && (value.sideClues === undefined || (Array.isArray(value.sideClues)
      && value.sideClues.every(clue => isRecord(clue)
        && typeof clue.puzzleId === 'string'
        && typeof clue.text === 'string')));
}

function isState(value) {
  return isRecord(value)
    && isRecord(value.occupancy)
    && typeof value.occupancy.ready === 'boolean'
    && isRecord(value.publicProgress)
    && optionalString(value.publicProgress.puzzleId)
    && optionalString(value.publicProgress.stepId)
    && optionalString(value.publicProgress.title)
    && optionalString(value.publicProgress.prompt)
    && (value.publicProgress.sidePuzzles === undefined
      || (Array.isArray(value.publicProgress.sidePuzzles)
        && value.publicProgress.sidePuzzles.every(isSidePuzzle)))
    && Array.isArray(value.intercom) && value.intercom.every(isMessage)
    && isWorkstation(value.workstation)
    && Array.isArray(value.privateMissions)
    && Array.isArray(value.discoveredEvidence) && value.discoveredEvidence.every(isEvidence)
    && (value.ending === null || value.ending === undefined || (isRecord(value.ending)
      && optionalString(value.ending.title) && optionalString(value.ending.text)));
}

function validateStateResponse(result, snapshot) {
  if (!isRecord(result) || result.success !== true
      || typeof result.unchanged !== 'boolean'
      || !Number.isSafeInteger(result.cursor) || result.cursor < 0
      || !isRecord(result.countdown)
      || ((snapshot || !result.unchanged) && !isState(result.state))) {
    throw new TypeError('Invalid state response');
  }
  return result;
}

function isEventFrame(frame) {
  return isRecord(frame)
    && frame.type === 'event'
    && Number.isSafeInteger(frame.cursor)
    && frame.cursor >= 0
    && isRecord(frame.event)
    && typeof frame.event.eventId === 'string'
    && frame.event.eventId.length > 0
    && frame.event.kind === 'state'
    && isRecord(frame.event.payload)
    && isState(frame.event.payload.state)
    && Array.isArray(frame.event.payload.events);
}

export function createLiveTransport({ roomCode, onSnapshot, onCountdown, onStatus }) {
  const endpoint = `/api/rooms/${roomCode}/state`;
  const liveUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/live?roomCode=${roomCode}`;
  let mode = 'resyncing';
  let cursor = 0;
  let socket;
  let pollTimer;
  let reconnectTimer;
  let pollDelay = BASE_DELAY;
  let reconnectDelay = BASE_DELAY;
  let resyncPromise;
  let stateFlight;
  let generation = 0;
  let hasSnapshot = false;
  let stopped = false;

  function setMode(next) {
    if (!MODES.has(next)) throw new TypeError('Invalid live mode');
    mode = next;
  }

  function clearPollTimer() {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = undefined;
  }

  function clearReconnectTimer() {
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }

  function emitSnapshot(response) {
    if (response.cursor < cursor) return false;
    const shouldRender = Boolean(response.state) && (!hasSnapshot || response.cursor > cursor);
    if (shouldRender) {
      try {
        onSnapshot(response.state, response.countdown);
      } catch {
        hasSnapshot = false;
        throw new TypeError('Renderer rejected state');
      }
      hasSnapshot = true;
    } else {
      onCountdown(response.countdown);
    }
    const advanced = response.cursor > cursor;
    cursor = response.cursor;
    return advanced;
  }

  function requestState(kind) {
    if (stateFlight) {
      if (stateFlight.kind === kind) return stateFlight.promise;
      if (kind === 'poll' && stateFlight.kind === 'snapshot') return stateFlight.promise;
      if (kind === 'snapshot' && stateFlight.kind === 'poll') {
        stateFlight.controller.abort();
      }
      return stateFlight.promise.catch(() => undefined).then(() => requestState(kind));
    }

    const controller = new AbortController();
    const requestCursor = cursor;
    const flight = { kind, controller };
    flight.promise = (async () => {
      try {
        const suffix = kind === 'poll' ? `?sinceCursor=${requestCursor}` : '';
        const response = await fetch(endpoint + suffix, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        return validateStateResponse(result, kind === 'snapshot');
      } finally {
        if (stateFlight === flight) stateFlight = undefined;
      }
    })();
    stateFlight = flight;
    return flight.promise;
  }

  function send(frame) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
  }

  function discardSocket() {
    const staleSocket = socket;
    socket = undefined;
    generation += 1;
    if (staleSocket && staleSocket.readyState < WebSocket.CLOSING) staleSocket.close();
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer || socket) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  }

  function schedulePoll(token, delay = pollDelay) {
    if (stopped || mode !== 'polling' || pollTimer) return;
    pollTimer = window.setTimeout(() => {
      pollTimer = undefined;
      poll(token);
    }, delay);
  }

  async function poll(token) {
    if (stopped || mode !== 'polling' || token !== generation) return;
    try {
      const response = await requestState('poll');
      if (stopped || mode !== 'polling' || token !== generation) return;
      emitSnapshot(response);
      pollDelay = BASE_DELAY;
    } catch (error) {
      if (stopped || mode !== 'polling' || token !== generation) return;
      if (error.name !== 'AbortError') pollDelay = Math.min(pollDelay * 2, MAX_DELAY);
    }
    schedulePoll(token);
    scheduleReconnect();
  }

  function enterPolling() {
    if (stopped) return;
    clearPollTimer();
    setMode('polling');
    onStatus('lost');
    const token = ++generation;
    schedulePoll(token, 0);
    scheduleReconnect();
  }

  function resync(initial = false) {
    if (resyncPromise) return resyncPromise;
    setMode('resyncing');
    clearPollTimer();
    generation += 1;
    resyncPromise = (async () => {
      try {
        const response = await requestState('snapshot');
        if (stopped) return false;
        emitSnapshot(response);
        if (socket?.readyState === WebSocket.OPEN) {
          clearPollTimer();
          clearReconnectTimer();
          pollDelay = reconnectDelay = BASE_DELAY;
          generation += 1;
          setMode('websocket');
          send({ type: 'resume', cursor });
          onStatus('connected');
        } else if (!initial) {
          enterPolling();
        }
        return true;
      } catch {
        if (stopped) return false;
        discardSocket();
        enterPolling();
        return false;
      } finally {
        resyncPromise = undefined;
      }
    })();
    return resyncPromise;
  }

  function applyEvent(frame) {
    if (!isEventFrame(frame) || frame.cursor !== cursor + 1) {
      resync();
      return;
    }
    try {
      onSnapshot(frame.event.payload.state);
    } catch {
      hasSnapshot = false;
      resync();
      return;
    }
    cursor = frame.cursor;
    hasSnapshot = true;
    send({ type: 'ack', cursor });
  }

  function handleFrame(data) {
    let frame;
    try {
      frame = JSON.parse(data);
    } catch {
      resync();
      return;
    }
    if (!isRecord(frame)) {
      resync();
      return;
    }
    if (frame.type === 'event') {
      applyEvent(frame);
      return;
    }
    if (frame.type === 'snapshot_required' && typeof frame.reason === 'string') {
      resync();
      return;
    }
    resync();
  }

  function connect() {
    if (stopped || socket) return;
    const candidate = new WebSocket(liveUrl);
    socket = candidate;
    candidate.addEventListener('open', () => {
      if (candidate !== socket || stopped) return;
      if (resyncPromise || stateFlight?.kind === 'snapshot') {
        clearPollTimer();
        clearReconnectTimer();
        setMode('resyncing');
        return;
      }
      generation += 1;
      clearPollTimer();
      clearReconnectTimer();
      if (stateFlight?.kind === 'poll') stateFlight.controller.abort();
      pollDelay = reconnectDelay = BASE_DELAY;
      setMode('websocket');
      send({ type: 'resume', cursor });
      onStatus('connected');
    });
    candidate.addEventListener('message', event => {
      if (candidate === socket && !stopped) handleFrame(event.data);
    });
    candidate.addEventListener('close', () => {
      if (candidate !== socket) return;
      socket = undefined;
      enterPolling();
    });
  }

  return {
    async start() {
      const ready = await resync(true);
      if (ready && !stopped && !socket) connect();
    },
    adopt(response) {
      try {
        validateStateResponse(response, false);
      } catch {
        resync();
        return;
      }
      if (emitSnapshot(response) && mode === 'websocket') send({ type: 'resume', cursor });
    },
    stop() {
      stopped = true;
      clearPollTimer();
      clearReconnectTimer();
      stateFlight?.controller.abort();
      discardSocket();
    }
  };
}
