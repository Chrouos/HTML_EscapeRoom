const fs = require('node:fs');

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Expected pattern not found in ${path}: ${from.slice(0, 120)}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Pattern not unique in ${path}: ${from.slice(0, 120)}`);
  fs.writeFileSync(path, source.slice(0, first) + to + source.slice(first + from.length));
}

function insertBefore(path, marker, addition) {
  const source = fs.readFileSync(path, 'utf8');
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Marker not found in ${path}: ${marker.slice(0, 120)}`);
  fs.writeFileSync(path, source.slice(0, index) + addition + source.slice(index));
}

// Idle policy and delivery remain server-authoritative.
replaceOnce(
  'game/privateEventEngine.js',
  "const SOLO_OPERATIONS = new Set(['request_solo_validation']);",
  `const SOLO_OPERATIONS = new Set(['request_solo_validation']);\nconst IDLE_THRESHOLD_MS = 60_000;\nconst IDLE_COOLDOWN_MS = 120_000;\nconst MAX_IDLE_OBSERVATIONS = 2;`
);

insertBefore(
  'game/privateEventEngine.js',
  `// Friendly aliases keep callers decoupled from the cadence name used in the UI.`,
  `function idleReactionIds(room, role, now = Date.now()) {\n  const behavior = ensureNarrativeBehavior(room, now);\n  return behavior.reactionFactIds[role].filter(id => id.startsWith('echo.behavior.idle.'));\n}\n\nfunction shouldTriggerIdleObservation(room, role, now = Date.now()) {\n  const normalized = normalizeRole(role);\n  if (!normalized || room?.ending || !room?.publicFacts?.includes('main1Completed')) return false;\n  if (!Number.isFinite(now) || now < 0) return false;\n  const behavior = ensureNarrativeBehavior(room, now);\n  const lastMeaningful = Number(behavior.lastMeaningfulActionAt[normalized]);\n  if (!Number.isFinite(lastMeaningful) || now - lastMeaningful < IDLE_THRESHOLD_MS) return false;\n  const ids = idleReactionIds(room, normalized, now);\n  if (ids.length >= MAX_IDLE_OBSERVATIONS) return false;\n  if (ids.length > 0) {\n    const lastReaction = Math.max(...ids.map(id => Number(behavior.lastReactionAt[normalized][id] || 0)));\n    if (now - lastReaction < IDLE_COOLDOWN_MS) return false;\n  }\n  return true;\n}\n\nfunction triggerIdleObservation(room, role, now = Date.now(), pendingEvents = []) {\n  const normalized = normalizeRole(role);\n  if (!normalized || !shouldTriggerIdleObservation(room, normalized, now)) return false;\n  ensureDialogueState(room);\n  const count = idleReactionIds(room, normalized, now).length + 1;\n  const id = \`echo.behavior.idle.\${count}.\${normalized.toLowerCase()}\`;\n  const text = count === 1\n    ? 'ECHO：你停了一段時間。沒有操作也是一種選擇；我不會替你填上答案。'\n    : 'ECHO：你又停下來了。這次我仍然只記錄，不替你決定下一步。';\n  const item = { id, intent: 'observation', variants: [text] };\n  return Boolean(emitSelected(room, item, normalized, pendingEvents, now));\n}\n\n`
);

replaceOnce(
  'game/privateEventEngine.js',
  `module.exports = {\n  MISSION_OUTCOMES,`,
  `module.exports = {\n  IDLE_THRESHOLD_MS,\n  IDLE_COOLDOWN_MS,\n  MISSION_OUTCOMES,`
);
replaceOnce(
  'game/privateEventEngine.js',
  `  recordNarrativeBehavior,\n  resolveSeed,`,
  `  recordNarrativeBehavior,\n  shouldTriggerIdleObservation,\n  triggerIdleObservation,\n  resolveSeed,`
);

// Polling fallback: only transact if an idle reaction is due.
replaceOnce(
  'routes/apiRoutes.js',
  `const { recordNarrativeBehavior } = require('../game/privateEventEngine');`,
  `const {\n  recordNarrativeBehavior,\n  shouldTriggerIdleObservation,\n  triggerIdleObservation\n} = require('../game/privateEventEngine');`
);
replaceOnce(
  'routes/apiRoutes.js',
  `      if (needsInitialization(player.room) || announceEmergency) {\n        const events = [];\n        player.room = store.transact(roomCode, draft => {\n          initializeGame(draft, events);\n          if (!announceEmergency) return;\n          draft.emergencyAnnounced = true;\n          appendStoryEvents(draft, [{ id: 'containment-zero', type: 'story',\n            audience: { kind: 'both' },\n            text: '警報：隔離倒數歸零。門沒有打開，空氣也沒有改變。ECHO：預估時間只是行為引導；你們還沒完成程序。' }], events);\n        }, { events });\n      }\n      response.json(stateResponse(player.room, player, sinceCursor));`,
  `      if (needsInitialization(player.room) || announceEmergency) {\n        const events = [];\n        player.room = store.transact(roomCode, draft => {\n          initializeGame(draft, events);\n          if (!announceEmergency) return;\n          draft.emergencyAnnounced = true;\n          appendStoryEvents(draft, [{ id: 'containment-zero', type: 'story',\n            audience: { kind: 'both' },\n            text: '警報：隔離倒數歸零。門沒有打開，空氣也沒有改變。ECHO：預估時間只是行為引導；你們還沒完成程序。' }], events);\n        }, { events });\n      }\n      const idleNow = Date.now();\n      if (shouldTriggerIdleObservation(player.room, player.role, idleNow)) {\n        const events = [];\n        player.room = store.transact(roomCode, draft => {\n          triggerIdleObservation(draft, player.role, idleNow, events);\n        }, { events });\n      }\n      response.json(stateResponse(player.room, player, sinceCursor));`
);

// WebSocket heartbeat uses the authenticated actor, never client-selected content.
replaceOnce(
  'realtime/liveHub.js',
  `const { parseCookieHeader, roomTokenCookieName } = require('../utils/cookies');`,
  `const { parseCookieHeader, roomTokenCookieName } = require('../utils/cookies');\nconst { shouldTriggerIdleObservation, triggerIdleObservation } = require('../game/privateEventEngine');`
);
replaceOnce(
  'realtime/liveHub.js',
  `function createLiveHub({ server, roomStore, allowedOrigins }) {`,
  `function createLiveHub({ server, roomStore, allowedOrigins, now = () => Date.now() }) {`
);
replaceOnce(
  'realtime/liveHub.js',
  `  if (!Array.isArray(allowedOrigins) && !(allowedOrigins instanceof Set)) {\n    throw new TypeError('allowedOrigins must be an array or Set');\n  }`,
  `  if (!Array.isArray(allowedOrigins) && !(allowedOrigins instanceof Set)) {\n    throw new TypeError('allowedOrigins must be an array or Set');\n  }\n  if (typeof now !== 'function') throw new TypeError('now must be a function');`
);
replaceOnce(
  'realtime/liveHub.js',
  `      if (frame.type === 'resume') {\n        replay(connection, frame.cursor);\n        return;\n      }\n      if (frame.type === 'ack'`,
  `      if (frame.type === 'resume') {\n        replay(connection, frame.cursor);\n        return;\n      }\n      if (frame.type === 'heartbeat') {\n        if (!Number.isSafeInteger(frame.cursor) || frame.cursor < 0 || frame.cursor > actor.latestCursor) return;\n        let room;\n        try {\n          room = roomStore.getRoom(actor.roomCode);\n        } catch {\n          socket.close(1008);\n          return;\n        }\n        const currentTime = now();\n        if (!shouldTriggerIdleObservation(room, actor.role, currentTime)) return;\n        const events = [];\n        try {\n          roomStore.transact(actor.roomCode, draft => {\n            triggerIdleObservation(draft, actor.role, currentTime, events);\n          }, { events });\n        } catch {\n          socket.close(1008);\n        }\n        return;\n      }\n      if (frame.type === 'ack'`
);

// Healthy WebSocket clients send a lightweight heartbeat every 15 seconds.
replaceOnce(
  'public/js/live.js',
  `const MAX_DELAY = 10000;`,
  `const MAX_DELAY = 10000;\nconst HEARTBEAT_MS = 15000;`
);
replaceOnce(
  'public/js/live.js',
  `  let reconnectTimer;\n  let pollDelay = BASE_DELAY;`,
  `  let reconnectTimer;\n  let heartbeatTimer;\n  let pollDelay = BASE_DELAY;`
);
insertBefore(
  'public/js/live.js',
  `  function clearPollTimer() {`,
  `  function clearHeartbeatTimer() {\n    if (heartbeatTimer) window.clearInterval(heartbeatTimer);\n    heartbeatTimer = undefined;\n  }\n\n  function startHeartbeat() {\n    clearHeartbeatTimer();\n    if (stopped || mode !== 'websocket' || socket?.readyState !== WebSocket.OPEN) return;\n    heartbeatTimer = window.setInterval(() => {\n      if (!stopped && mode === 'websocket' && socket?.readyState === WebSocket.OPEN) {\n        send({ type: 'heartbeat', cursor });\n      }\n    }, HEARTBEAT_MS);\n  }\n\n`
);
replaceOnce(
  'public/js/live.js',
  `  function discardSocket() {\n    const staleSocket = socket;`,
  `  function discardSocket() {\n    clearHeartbeatTimer();\n    const staleSocket = socket;`
);
replaceOnce(
  'public/js/live.js',
  `  function enterPolling() {\n    if (stopped) return;\n    clearPollTimer();`,
  `  function enterPolling() {\n    if (stopped) return;\n    clearHeartbeatTimer();\n    clearPollTimer();`
);
replaceOnce(
  'public/js/live.js',
  `    setMode('resyncing');\n    clearPollTimer();`,
  `    setMode('resyncing');\n    clearHeartbeatTimer();\n    clearPollTimer();`
);
replaceOnce(
  'public/js/live.js',
  `          send({ type: 'resume', cursor });\n          onStatus('ready');`,
  `          send({ type: 'resume', cursor });\n          startHeartbeat();\n          onStatus('ready');`
);
replaceOnce(
  'public/js/live.js',
  `      send({ type: 'resume', cursor });\n      onStatus('ready');`,
  `      send({ type: 'resume', cursor });\n      startHeartbeat();\n      onStatus('ready');`
);
replaceOnce(
  'public/js/live.js',
  `      clearPollTimer();\n      clearReconnectTimer();\n      stateFlight?.controller.abort();`,
  `      clearHeartbeatTimer();\n      clearPollTimer();\n      clearReconnectTimer();\n      stateFlight?.controller.abort();`
);

// Align stale E2E coverage with the actual contract: optional private
// pressure claims are not guaranteed to unlock on the neutral route.
replaceOnce(
  'test/e2e/privateNarrative.spec.js',
  `  test('each deception has a role-visible claim and a different-source verification entry', async ({ browser }) => {`,
  `  test('role-visible mainline deception claims retain different-source verification entries', async ({ browser }) => {`
);
replaceOnce(
  'test/e2e/privateNarrative.spec.js',
  `      const authored = [\n        ['A', 'doc.a_incident_report'],\n        ['A', 'ai.a2.cleanup_request'],\n        ['A', 'doc.a_solo_protocol'],\n        ['B', 'doc.b_incident_report'],\n        ['B', 'ai.b2.pause_request'],\n        ['B', 'doc.b_solo_protocol']\n      ];`,
  `      const authored = [\n        ['A', 'doc.a_incident_report'],\n        ['A', 'doc.a_solo_protocol'],\n        ['B', 'doc.b_incident_report'],\n        ['B', 'doc.b_solo_protocol']\n      ];`
);

fs.unlinkSync(__filename);
