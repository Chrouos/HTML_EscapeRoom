const express = require('express');

const { stateResponse } = require('../game/safeState');
const { roomErrors } = require('../game/roomErrors');
const { parseCookieHeader, roomTokenCookieName } = require('../utils/cookies');
const { isRoomCode, statusForError, userMessageForError } = require('./roomRoutes');
const { initializeGame, submitAction } = require('../game/gameEngine');
const { appendStoryEvents } = require('../game/storyEngine');

function validateAction(action) {
  if (!action || Array.isArray(action) || typeof action !== 'object'
    || !['actionId', 'puzzleId', 'stepId'].every(key => (
      typeof action[key] === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(action[key])
    )) || typeof action.value !== 'string' || action.value.length > 1000) {
    const error = new Error('請提供有效的操作編號、謎題、步驟與答案');
    error.code = 'INVALID_ACTION';
    error.status = 400;
    throw error;
  }
}

function parseSinceCursor(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
    const error = new Error('sinceCursor must be a non-negative integer');
    error.code = 'INVALID_CURSOR';
    error.status = 400;
    throw error;
  }
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor)) {
    const error = new Error('sinceCursor must be a non-negative integer');
    error.code = 'INVALID_CURSOR';
    error.status = 400;
    throw error;
  }
  return cursor;
}

function needsInitialization(room) {
  return Boolean(room.players?.A && room.players?.B
    && (room.publicProgress === undefined || room.privateClues === undefined));
}

function createApiRoutes(store) {
  if (!store) {
    throw new TypeError('Room store is required');
  }

  const router = express.Router();

  router.get('/rooms/:roomCode/state', (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
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
      const sinceCursor = parseSinceCursor(request.query.sinceCursor);
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
      const announceEmergency = player.room.countdownStatus === 'emergency'
        && !player.room.emergencyAnnounced && !player.room.ending;
      if (needsInitialization(player.room) || announceEmergency) {
        const events = [];
        player.room = store.transact(roomCode, draft => {
          initializeGame(draft, events);
          if (!announceEmergency) return;
          draft.emergencyAnnounced = true;
          appendStoryEvents(draft, [{ id: 'containment-zero', type: 'story',
            audience: { kind: 'both' },
            text: '警報：隔離倒數歸零。門沒有打開，空氣也沒有改變。AI：預估時間僅供行為引導，請繼續完成程序。' }], events);
        }, { events });
      }
      response.json(stateResponse(player.room, player, sinceCursor));
    } catch (error) {
      const status = error.status || statusForError(error);
      response.status(status).json({
        success: false,
        code: error.code || 'INTERNAL_ERROR',
        message: userMessageForError(error)
      });
    }
  });

  router.post('/rooms/:roomCode/actions', (request, response) => {
    try {
      const roomCode = request.params.roomCode;
      if (!isRoomCode(roomCode)) {
        return response.status(400).json({ success: false, code: 'INVALID_ROOM_CODE',
          message: userMessageForError({ code: 'INVALID_ROOM_CODE' }) });
      }
      const token = parseCookieHeader(request.headers.cookie)[roomTokenCookieName(roomCode)];
      const player = store.resolvePlayer(roomCode, token);
      validateAction(request.body);
      const { actionId, puzzleId, stepId, value } = request.body;
      const action = { actionId, puzzleId, stepId, value };
      if (store.hasProcessedAction(roomCode, actionId, player.playerId)) {
        return response.json({ success: true, stateChanged: false,
          publicResult: { duplicate: true }, ...stateResponse(player.room, player) });
      }
      const events = [];
      let result;
      const room = store.transact(roomCode, draft => {
        initializeGame(draft, events);
        result = submitAction(draft, player, action, events);
      }, {
        playerId: player.playerId,
        actionId,
        events,
        shouldRecordAction: () => result.stateChanged
      });
      return response.json({ success: true, stateChanged: result.stateChanged,
        publicResult: result.publicResult, ...stateResponse(room, player) });
    } catch (error) {
      const domainError = [400, 423].includes(error.status);
      return response.status(domainError ? error.status : statusForError(error)).json({
        success: false, code: error.code || 'INTERNAL_ERROR',
        message: domainError ? error.message : userMessageForError(error)
      });
    }
  });

  router.post('/rooms/:roomCode/chat', (request, response) => {
    try {
      const roomCode = request.params.roomCode;
      if (!isRoomCode(roomCode)) {
        return response.status(400).json({ success: false, code: 'INVALID_ROOM_CODE',
          message: userMessageForError({ code: 'INVALID_ROOM_CODE' }) });
      }
      const token = parseCookieHeader(request.headers.cookie)[roomTokenCookieName(roomCode)];
      const player = store.resolvePlayer(roomCode, token);
      const { actionId, text } = request.body || {};
      if (typeof actionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(actionId)
        || typeof text !== 'string' || !text.trim() || text.length > 1000) {
        return response.status(400).json({ success: false, code: 'INVALID_CHAT',
          message: '請輸入 1 到 1000 字的訊息，並提供操作編號' });
      }
      const events = [];
      const room = store.transact(roomCode, draft => {
        initializeGame(draft, events);
        appendStoryEvents(draft, [{ id: `chat-${player.role}-${actionId}`, type: 'player',
          text: text.trim(), payload: { role: player.role }, audience: { kind: 'both' } }], events);
      }, { playerId: player.playerId, actionId, events });
      return response.json(stateResponse(room, player));
    } catch (error) {
      return response.status(statusForError(error)).json({ success: false,
        code: error.code || 'INTERNAL_ERROR', message: userMessageForError(error) });
    }
  });

  return router;
}

module.exports = { createApiRoutes };
