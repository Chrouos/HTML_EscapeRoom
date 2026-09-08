function nextSequence(room) {
  return (Array.isArray(room.messages) ? room.messages : []).reduce((highest, message) => {
    const sequence = Number(message && message.sequence);
    return Number.isFinite(sequence) ? Math.max(highest, sequence) : highest;
  }, 0) + 1;
}

function appendMessage(room, message) {
  if (!Array.isArray(room.messages)) {
    room.messages = [];
  }

  const existing = room.messages.find(item => item && item.id === message.id);
  if (existing) {
    return existing;
  }

  const typedMessage = {
    id: String(message.id),
    sequence: message.sequence ?? nextSequence(room),
    type: message.type || 'system',
    text: String(message.text || ''),
    audience: message.audience ?? 'public'
  };
  room.messages.push(typedMessage);
  return typedMessage;
}

function appendStoryEvents(room, events) {
  return (Array.isArray(events) ? events : []).map(event => appendMessage(room, event));
}

function appendEvents(room, events) {
  return appendStoryEvents(room, events);
}

module.exports = { appendMessage, appendStoryEvents, appendEvents };
