const express = require('express');

const { forPlayer } = require('../game/safeState');
const { RoomError, roomErrors } = require('../game/roomErrors');
const { parseCookieHeader, roomTokenCookieName, serializeCookie } = require('../utils/cookies');

const INVALID_ROOM_CODE = 'INVALID_ROOM_CODE';

function isRoomCode(value) {
  return /^\d{6}$/.test(String(value || '').trim());
}

function invalidRoomCode() {
  return new RoomError(INVALID_ROOM_CODE, '房號必須是六位數字');
}

const ERROR_MESSAGES = Object.freeze({
  [INVALID_ROOM_CODE]: '房號必須是六位數字',
  [roomErrors.ROOM_NOT_FOUND]: '找不到這個房間',
  [roomErrors.ROOM_EXPIRED]: '這個房間已經過期',
  [roomErrors.ROOM_FULL]: '這個房間已經額滿',
  [roomErrors.INVALID_TOKEN]: '無法驗證你的房間身分',
  [roomErrors.TOKEN_CONFLICT]: '這個瀏覽器已連線到此房間'
});

function userMessageForError(error) {
  return ERROR_MESSAGES[error && error.code] || '伺服器發生錯誤，請稍後再試';
}

function statusForError(error) {
  if (error.code === INVALID_ROOM_CODE) {
    return 400;
  }
  if (error.code === roomErrors.ROOM_NOT_FOUND || error.code === roomErrors.ROOM_EXPIRED) {
    return 404;
  }
  if ([roomErrors.ROOM_FULL, roomErrors.INVALID_TOKEN, roomErrors.TOKEN_CONFLICT].includes(error.code)) {
    return 409;
  }
  return 500;
}

function jsonError(response, error) {
  const status = statusForError(error);
  return response.status(status).json({
    success: false,
    code: error.code || 'INTERNAL_ERROR',
    message: userMessageForError(error)
  });
}

function roomCodeFromBody(request) {
  const roomCode = String(request.body && request.body.roomCode || '').trim();
  if (!isRoomCode(roomCode)) {
    throw invalidRoomCode();
  }
  return roomCode;
}

function tokenForRequest(request, roomCode) {
  return parseCookieHeader(request.headers.cookie)[roomTokenCookieName(roomCode)];
}

function setRoomToken(response, roomCode, token) {
  response.setHeader('Set-Cookie', serializeCookie(
    roomTokenCookieName(roomCode),
    token,
    { path: '/', httpOnly: true, sameSite: 'Lax', secure: false }
  ));
}

function queueLifecycleAnnouncements(store, roomCode, operations) {
  store.updateRoom(roomCode, room => {
    room.publicFacts ??= [];
    for (const fact of operations.includes('create_room') || operations.includes('host_join')
      ? ['roomCreated', 'hostJoined'] : ['guestJoined']) {
      if (!room.publicFacts.includes(fact)) room.publicFacts.push(fact);
    }
    room.lifecycleOperations ??= [];
    for (const operationId of operations) {
      if (!room.lifecycleOperations.includes(operationId)) room.lifecycleOperations.push(operationId);
    }
  });
}

function createRoomRoutes(store) {
  if (!store) {
    throw new TypeError('Room store is required');
  }

  const router = express.Router();

  router.post('/rooms', (request, response) => {
    try {
      const created = store.createRoom();
      // The host is assigned during creation. Queue the first two public
      // announcements on the authoritative route; the first ready-state
      // transaction flushes them atomically to both actor streams.
      queueLifecycleAnnouncements(store, created.room.roomCode, ['create_room', 'host_join']);
      setRoomToken(response, created.room.roomCode, created.player.token);
      response.redirect(303, `/rooms/${created.room.roomCode}`);
    } catch (error) {
      jsonError(response, error);
    }
  });

  router.post('/rooms/join', (request, response) => {
    try {
      const roomCode = roomCodeFromBody(request);
      const existingToken = tokenForRequest(request, roomCode);

      // Resolve first so a valid token in this browser wins over ROOM_FULL.
      store.getRoom(roomCode);
      if (existingToken) {
        try {
          store.resolvePlayer(roomCode, existingToken);
          throw new RoomError(roomErrors.TOKEN_CONFLICT, ERROR_MESSAGES[roomErrors.TOKEN_CONFLICT]);
        } catch (error) {
          if (error.code !== roomErrors.INVALID_TOKEN) {
            throw error;
          }
        }
      }

      const joined = store.joinRoom(roomCode);
      // Guest join completes the opening cadence. It is queued so the next
      // ready-state transaction can deliver all three public lines together.
      queueLifecycleAnnouncements(store, roomCode, ['guest_join']);
      setRoomToken(response, roomCode, joined.player.token);
      response.redirect(303, `/rooms/${roomCode}`);
    } catch (error) {
      jsonError(response, error);
    }
  });

  router.get('/rooms/:roomCode', (request, response) => {
    const roomCode = String(request.params.roomCode).trim();
    if (!isRoomCode(roomCode)) {
      response.status(400).render('waitingRoom', {
        roomCode,
        state: null,
        canJoin: false,
        error: { code: INVALID_ROOM_CODE, message: ERROR_MESSAGES[INVALID_ROOM_CODE] }
      });
      return;
    }

    try {
      const room = store.getRoom(roomCode);
      const token = tokenForRequest(request, roomCode);
      if (!token) {
        response.render('waitingRoom', {
          roomCode,
          state: {
            roomCode,
            occupancy: {
              A: Boolean(room.players.A),
              B: Boolean(room.players.B),
              count: Number(Boolean(room.players.A)) + Number(Boolean(room.players.B)),
              capacity: 2,
              ready: Boolean(room.players.A && room.players.B)
            }
          },
          canJoin: !room.players.B,
          error: null
        });
        return;
      }

      const player = store.resolvePlayer(roomCode, token);
      response.render('waitingRoom', {
        roomCode,
        state: forPlayer(player.room, player),
        canJoin: false,
        error: null
      });
    } catch (error) {
      response.status(statusForError(error)).render('waitingRoom', {
        roomCode,
        state: null,
        canJoin: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: userMessageForError(error)
        }
      });
    }
  });

  return router;
}

module.exports = {
  createRoomRoutes,
  isRoomCode,
  statusForError,
  userMessageForError
};
