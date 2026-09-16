const { randomUUID } = require('node:crypto');
const { WebSocket, WebSocketServer } = require('ws');

const { parseCookieHeader, roomTokenCookieName } = require('../utils/cookies');

const RETENTION_LIMIT = 256;

function rejectUpgrade(socket, statusCode, statusText) {
  const response = `HTTP/1.1 ${statusCode} ${statusText}\r\n`
    + 'Connection: close\r\n'
    + 'Content-Length: 0\r\n'
    + '\r\n';
  socket.write(response, () => socket.destroy());
}

function actorKey(roomCode, playerId) {
  return `${roomCode}:${playerId}`;
}

function liveEntry(envelope, eventId = randomUUID()) {
  return {
    cursor: envelope.cursor,
    event: {
      eventId,
      kind: 'state',
      payload: {
        state: envelope.state,
        countdown: envelope.countdown,
        events: envelope.events
      }
    }
  };
}

function send(socket, frame) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(frame));
  }
}

function createLiveHub({ server, roomStore, allowedOrigins }) {
  if (!server || typeof server.on !== 'function') {
    throw new TypeError('HTTP server is required');
  }
  if (!roomStore || typeof roomStore.resolvePlayer !== 'function'
      || typeof roomStore.subscribe !== 'function'
      || typeof roomStore.acknowledge !== 'function') {
    throw new TypeError('Room store with player resolution, acknowledgement, and subscriptions is required');
  }
  if (!Array.isArray(allowedOrigins) && !(allowedOrigins instanceof Set)) {
    throw new TypeError('allowedOrigins must be an array or Set');
  }

  const originAllowlist = new Set(allowedOrigins);
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const actors = new Map();
  const roomSubscriptions = new Map();
  const sockets = new Set();
  const pendingSockets = new Set();
  let closed = false;

  function appendEntry(actor, envelope, eventId) {
    const entry = liveEntry(envelope, eventId);
    actor.entries.push(entry);
    if (actor.entries.length > RETENTION_LIMIT) {
      actor.entries.splice(0, actor.entries.length - RETENTION_LIMIT);
    }
    actor.latestCursor = entry.cursor;

    for (const connection of actor.connections) {
      if (!connection.resumed || connection.lastSentCursor !== entry.cursor - 1) continue;
      send(connection.socket, { type: 'event', ...entry });
      connection.lastSentCursor = entry.cursor;
    }
  }

  function ensureRoomSubscription(roomCode) {
    if (roomSubscriptions.has(roomCode)) return;
    const unsubscribe = roomStore.subscribe(roomCode, notification => {
      const eventId = randomUUID();
      for (const [role, envelope] of Object.entries(notification.envelopes)) {
        for (const actor of actors.values()) {
          if (actor.roomCode === roomCode && actor.role === role) {
            appendEntry(actor, envelope, eventId);
          }
        }
      }
    });
    roomSubscriptions.set(roomCode, unsubscribe);
  }

  function ensureActor(roomCode, player) {
    const key = actorKey(roomCode, player.playerId);
    let actor = actors.get(key);
    if (actor) return actor;

    const stream = player.room.streams[player.role];
    actor = {
      roomCode,
      role: player.role,
      playerId: player.playerId,
      latestCursor: stream.cursor,
      acknowledgedCursor: stream.acknowledgedCursor,
      entries: stream.events.slice(-RETENTION_LIMIT).map(envelope => liveEntry(envelope)),
      connections: new Set()
    };
    actors.set(key, actor);
    ensureRoomSubscription(roomCode);
    return actor;
  }

  function replay(connection, cursor) {
    const { actor } = connection;
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > actor.latestCursor) {
      connection.resumed = false;
      send(connection.socket, { type: 'snapshot_required', reason: 'invalid_cursor' });
      return;
    }

    const effectiveCursor = Math.max(cursor, actor.acknowledgedCursor);
    const pending = actor.entries.filter(entry => entry.cursor > effectiveCursor);
    const hasGap = effectiveCursor < actor.latestCursor && (
      pending.length === 0
      || pending[0].cursor !== effectiveCursor + 1
      || pending.at(-1).cursor !== actor.latestCursor
      || pending.some((entry, index) => index > 0
        && entry.cursor !== pending[index - 1].cursor + 1)
    );
    if (hasGap) {
      connection.resumed = false;
      send(connection.socket, { type: 'snapshot_required', reason: 'retention_gap' });
      return;
    }

    connection.resumed = false;
    connection.lastSentCursor = effectiveCursor;
    for (const entry of pending) {
      send(connection.socket, { type: 'event', ...entry });
      connection.lastSentCursor = entry.cursor;
    }
    connection.resumed = true;
  }

  webSocketServer.on('connection', (socket, _request, actor) => {
    const connection = {
      socket,
      actor,
      resumed: false,
      lastSentCursor: null
    };
    sockets.add(socket);
    actor.connections.add(connection);

    socket.on('message', data => {
      let frame;
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return;
      const keys = Object.keys(frame);
      if (keys.length !== 2 || !keys.includes('type') || !keys.includes('cursor')) return;

      if (frame.type === 'resume') {
        replay(connection, frame.cursor);
        return;
      }
      if (frame.type === 'ack'
          && Number.isSafeInteger(frame.cursor)
          && frame.cursor >= actor.acknowledgedCursor
          && frame.cursor <= actor.latestCursor
          && frame.cursor <= connection.lastSentCursor) {
        try {
          actor.acknowledgedCursor = roomStore.acknowledge(actor.roomCode, {
            role: actor.role,
            playerId: actor.playerId
          }, frame.cursor);
        } catch {
          socket.close(1008);
        }
      }
    });

    socket.once('close', () => {
      sockets.delete(socket);
      actor.connections.delete(connection);
      if (actor.connections.size === 0) {
        actors.delete(actorKey(actor.roomCode, actor.playerId));
        const roomStillConnected = [...actors.values()]
          .some(candidate => candidate.roomCode === actor.roomCode);
        if (!roomStillConnected) {
          const unsubscribe = roomSubscriptions.get(actor.roomCode);
          if (unsubscribe) unsubscribe();
          roomSubscriptions.delete(actor.roomCode);
        }
      }
    });
  });

  function handleUpgrade(request, socket, head) {
    pendingSockets.add(socket);
    socket.once('close', () => pendingSockets.delete(socket));
    if (closed) {
      rejectUpgrade(socket, 503, 'Service Unavailable');
      return;
    }

    const urlMatch = /^\/live\?roomCode=(\d{6})$/.exec(request.url || '');
    if (!urlMatch) {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }
    const roomCode = urlMatch[1];
    if (!originAllowlist.has(request.headers.origin)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    const token = parseCookieHeader(request.headers.cookie)[roomTokenCookieName(roomCode)];
    let player;
    try {
      if (!token) throw new Error('Missing room token');
      player = roomStore.resolvePlayer(roomCode, token);
    } catch {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    const actor = ensureActor(roomCode, player);
    webSocketServer.handleUpgrade(request, socket, head, upgradedSocket => {
      pendingSockets.delete(socket);
      webSocketServer.emit('connection', upgradedSocket, request, actor);
    });
  }

  server.on('upgrade', handleUpgrade);

  return {
    close() {
      if (closed) return Promise.resolve();
      closed = true;
      server.removeListener('upgrade', handleUpgrade);
      for (const unsubscribe of roomSubscriptions.values()) unsubscribe();
      roomSubscriptions.clear();
      for (const socket of sockets) socket.terminate();
      for (const socket of pendingSockets) socket.destroy();
      sockets.clear();
      pendingSockets.clear();
      actors.clear();
      return new Promise(resolve => webSocketServer.close(() => resolve()));
    }
  };
}

module.exports = { createLiveHub };
