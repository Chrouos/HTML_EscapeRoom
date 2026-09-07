const express = require('express');

const { forPlayer } = require('../game/safeState');
const { roomErrors } = require('../game/roomErrors');
const { parseCookieHeader, roomTokenCookieName } = require('../utils/cookies');
const { isRoomCode, statusForError, userMessageForError } = require('./roomRoutes');

function createApiRoutes(store) {
  if (!store) {
    throw new TypeError('Room store is required');
  }

  const router = express.Router();

  router.get('/rooms/:roomCode/state', (request, response) => {
    const roomCode = String(request.params.roomCode).trim();
    if (!isRoomCode(roomCode)) {
      response.status(400).json({
        success: false,
        code: 'INVALID_ROOM_CODE',
        message: userMessageForError({ code: 'INVALID_ROOM_CODE' })
      });
      return;
    }

    try {
      // Resolve room existence before checking credentials so missing rooms stay 404.
      store.getRoom(roomCode);
      const cookies = parseCookieHeader(request.headers.cookie);
      const token = cookies[roomTokenCookieName(roomCode)];
      if (!token) {
        const error = {
          code: roomErrors.INVALID_TOKEN,
          message: userMessageForError({ code: roomErrors.INVALID_TOKEN })
        };
        response.status(409).json({ success: false, ...error });
        return;
      }

      const player = store.resolvePlayer(roomCode, token);
      response.json({
        success: true,
        state: forPlayer(player.room, player)
      });
    } catch (error) {
      const status = statusForError(error);
      response.status(status).json({
        success: false,
        code: error.code || 'INTERNAL_ERROR',
        message: userMessageForError(error)
      });
    }
  });

  return router;
}

module.exports = { createApiRoutes };
