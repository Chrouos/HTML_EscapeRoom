const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const { resolveRecipients } = require('./audience');
const { projectForPlayer } = require('./safeState');

function actorIdentity(room, role) {
  const player = room.players && room.players[role];
  return player ? { role, playerId: player.playerId } : null;
}

function readOnlyView(value, seen = new WeakMap()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  const view = new Proxy(value, {
    get(target, property) {
      if (target instanceof Set) {
        if (['add', 'clear', 'delete'].includes(property)) {
          return () => { throw new TypeError('Resolver view is read-only'); };
        }
        const member = Reflect.get(target, property, target);
        return typeof member === 'function' ? member.bind(target) : member;
      }
      return readOnlyView(Reflect.get(target, property, target), seen);
    },
    set() { throw new TypeError('Resolver view is read-only'); },
    deleteProperty() { throw new TypeError('Resolver view is read-only'); },
    defineProperty() { throw new TypeError('Resolver view is read-only'); },
    setPrototypeOf() { throw new TypeError('Resolver view is read-only'); }
  });
  seen.set(value, view);
  return view;
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

  const resolverDraft = readOnlyView(draft);
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
    envelopes[role] = envelope;
  }

  return envelopes;
}

module.exports = { dispatchProjectionChanges };
