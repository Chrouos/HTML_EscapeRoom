const MODES = new Set(['websocket', 'polling', 'resyncing']);
const BASE_DELAY = 1200;
const MAX_DELAY = 10000;

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
  let hasSnapshot = false;
  let stopped = false;

  function setMode(next) {
    if (!MODES.has(next)) throw new TypeError('Invalid live mode');
    mode = next;
  }

  function clearTimer(timer) {
    if (timer) window.clearTimeout(timer);
  }

  function emitSnapshot(response) {
    if (response.cursor < cursor) return false;
    const shouldRender = Boolean(response.state) && (!hasSnapshot || response.cursor > cursor);
    if (shouldRender) {
      onSnapshot(response.state, response.countdown);
      hasSnapshot = true;
    } else if (response.countdown) {
      onCountdown(response.countdown);
    }
    const advanced = response.cursor > cursor;
    cursor = response.cursor;
    return advanced;
  }

  async function readState(sinceCursor) {
    const suffix = sinceCursor === undefined ? '' : `?sinceCursor=${sinceCursor}`;
    const response = await fetch(endpoint + suffix, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    emitSnapshot(result);
    return result;
  }

  function send(frame) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer || socket) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  }

  function schedulePoll(delay = pollDelay) {
    if (stopped || mode !== 'polling' || pollTimer) return;
    pollTimer = window.setTimeout(async () => {
      pollTimer = undefined;
      if (stopped || mode !== 'polling') return;
      try {
        await readState(cursor);
        pollDelay = BASE_DELAY;
      } catch {
        pollDelay = Math.min(pollDelay * 2, MAX_DELAY);
      }
      schedulePoll();
      scheduleReconnect();
    }, delay);
  }

  function enterPolling() {
    if (stopped) return;
    setMode('polling');
    onStatus('lost');
    schedulePoll(0);
    scheduleReconnect();
  }

  function resync() {
    if (resyncPromise) return resyncPromise;
    setMode('resyncing');
    clearTimer(pollTimer);
    pollTimer = undefined;
    resyncPromise = readState().then(() => {
      if (stopped) return;
      if (socket?.readyState === WebSocket.OPEN) {
        send({ type: 'resume', cursor });
        setMode('websocket');
        onStatus('connected');
      } else {
        enterPolling();
      }
    }).catch(() => {
      if (!stopped) enterPolling();
    }).finally(() => {
      resyncPromise = undefined;
    });
    return resyncPromise;
  }

  function applyEvent(frame) {
    if (!Number.isSafeInteger(frame.cursor) || frame.cursor !== cursor + 1
        || !frame.event?.payload?.state) {
      if (Number.isSafeInteger(frame.cursor) && frame.cursor <= cursor) {
        send({ type: 'ack', cursor });
      } else {
        resync();
      }
      return;
    }
    onSnapshot(frame.event.payload.state);
    cursor = frame.cursor;
    send({ type: 'ack', cursor });
  }

  function connect() {
    if (stopped || socket) return;
    const candidate = new WebSocket(liveUrl);
    socket = candidate;
    candidate.addEventListener('open', () => {
      if (candidate !== socket || stopped) return;
      clearTimer(pollTimer);
      clearTimer(reconnectTimer);
      pollTimer = reconnectTimer = undefined;
      pollDelay = reconnectDelay = BASE_DELAY;
      setMode('websocket');
      send({ type: 'resume', cursor });
      onStatus('connected');
    });
    candidate.addEventListener('message', event => {
      if (candidate !== socket || stopped) return;
      let frame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }
      if (frame.type === 'event') applyEvent(frame);
      else if (frame.type === 'snapshot_required') resync();
    });
    candidate.addEventListener('close', () => {
      if (candidate !== socket) return;
      socket = undefined;
      enterPolling();
    });
  }

  return {
    async start() {
      await resync();
      if (!stopped && !socket) connect();
    },
    adopt(response) {
      if (!response || !Number.isSafeInteger(response.cursor)) return;
      if (emitSnapshot(response) && mode === 'websocket') send({ type: 'resume', cursor });
    },
    stop() {
      stopped = true;
      clearTimer(pollTimer);
      clearTimer(reconnectTimer);
      socket?.close();
      socket = undefined;
    }
  };
}
