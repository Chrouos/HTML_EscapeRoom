const { validateAudience } = require('./audience');

function contentId(item) {
  return item && (item.contentId ?? item.id);
}

function appendMessage(room, message, pendingEvents = []) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new TypeError('Story event must be an object');
  }
  validateAudience(message.audience);
  const id = contentId(message);
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Story event requires an id');
  if (typeof message.text !== 'string') throw new TypeError('Story event requires text');

  const existingMessages = Array.isArray(room.messages) ? room.messages : [];
  if (existingMessages.some(item => contentId(item) === id)
    || pendingEvents.some(item => contentId(item) === id)) return null;

  const event = {
    id,
    type: message.type || 'system',
    text: message.text,
    audience: structuredClone(message.audience)
  };
  if (message.payload !== undefined) event.payload = structuredClone(message.payload);
  pendingEvents.push(event);
  return event;
}

function appendStoryEvents(room, events, pendingEvents = []) {
  return (Array.isArray(events) ? events : [])
    .map(event => appendMessage(room, event, pendingEvents))
    .filter(Boolean);
}

function appendEvents(room, events, pendingEvents) {
  return appendStoryEvents(room, events, pendingEvents);
}

function appendDialogueEvents(room, trigger, pendingEvents = []) {
  // Lazy require avoids coupling the low-level story append helper to the
  // dialogue selector during module initialisation.
  const { triggerDialogue } = require('./privateEventEngine');
  const generated = [];
  triggerDialogue(room, trigger, generated);
  return appendStoryEvents(room, generated, pendingEvents);
}

module.exports = { appendMessage, appendStoryEvents, appendEvents, appendDialogueEvents };
