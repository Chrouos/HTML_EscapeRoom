const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const { resolveRecipients } = require('./audience');
const { projectForPlayer } = require('./safeState');

const STREAM_RETENTION_LIMIT = 256;

function actorIdentity(room, role) {
  const player = room.players && room.players[role];
  return player ? { role, playerId: player.playerId } : null;
}

function resolverContext(draft) {
  return Object.freeze({
    roomCode: draft.roomCode,
    chapter: draft.chapter
  });
}

function resolveContentEvent(draft, resolverDraft, event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError('Content event must be an object');
  }

  const recipients = resolveRecipients(draft, event.audience);
  const contentId = event.contentId ?? event.id;
  if (typeof contentId !== 'string' || contentId.trim() === '') {
    throw new TypeError('Content event requires a contentId');
  }

  const resolvedText = typeof event.text === 'function'
    ? event.text(resolverDraft)
    : event.text;
  if (typeof resolvedText !== 'string') {
    throw new TypeError('Content event text must resolve to a string');
  }

  const item = {
    eventId: randomUUID(),
    contentId,
    type: typeof event.type === 'string' && event.type ? event.type : 'system',
    text: resolvedText,
    payload: structuredClone(event.payload ?? null)
  };

  return { audience: structuredClone(event.audience), recipients, item };
}

function appendResolvedContent(draft, resolved) {
  if (!Array.isArray(draft.messages)) {
    draft.messages = [];
  }
  draft.messages.push({
    id: resolved.item.eventId,
    ...structuredClone(resolved.item),
    audience: resolved.audience
  });
}

function dispatchProjectionChanges({ before, draft, events = [] }) {
  if (!before || !draft || !Array.isArray(events)) {
    throw new TypeError('dispatchProjectionChanges requires before, draft, and an events array');
  }

  const beforeProjections = {};
  for (const role of ['A', 'B']) {
    const identity = actorIdentity(before, role);
    if (identity) {
      beforeProjections[role] = projectForPlayer(before, identity);
    }
  }

  const resolverDraft = resolverContext(draft);
  const resolvedEvents = events.map(event => resolveContentEvent(draft, resolverDraft, event));
  for (const resolved of resolvedEvents) {
    appendResolvedContent(draft, resolved);
  }

  const envelopes = {};
  for (const role of ['A', 'B']) {
    const identity = actorIdentity(draft, role);
    if (!identity) continue;

    const state = projectForPlayer(draft, identity);
    if (isDeepStrictEqual(beforeProjections[role], state)) continue;

    const stream = draft.streams && draft.streams[role];
    if (!stream || !Number.isSafeInteger(stream.cursor) || !Array.isArray(stream.events)) {
      throw new TypeError(`Invalid ${role} event stream`);
    }
    const envelope = {
      cursor: stream.cursor + 1,
      state,
      events: resolvedEvents
        .filter(event => event.recipients.includes(role))
        .map(event => structuredClone(event.item))
    };
    stream.cursor = envelope.cursor;
    stream.events.push(envelope);
    if (stream.events.length > STREAM_RETENTION_LIMIT) {
      stream.events.splice(0, stream.events.length - STREAM_RETENTION_LIMIT);
    }
    envelopes[role] = envelope;
  }

  return envelopes;
}

module.exports = { dispatchProjectionChanges };
