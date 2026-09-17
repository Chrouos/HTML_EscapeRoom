const BOTTOM_THRESHOLD = 48;
const ANNOUNCEMENT_DELAY = 250;

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function messageProfile(message) {
  if (message.type !== 'player') {
    const text = message.text.trim();
    const declared = message.payload && typeof message.payload === 'object' && !Array.isArray(message.payload)
      ? message.payload.speaker : '';
    if (declared === 'alarm' || /^警報[:：]/.test(text)) {
      return { label: 'CONTAINMENT', className: 'message-alarm', icon: '!' };
    }
    if (declared === 'echo' || /^(?:ECHO|AI)[:：]/.test(text)) {
      return { label: 'ECHO', className: 'message-echo', icon: '◇' };
    }
    return { label: 'ORPHEUS', className: 'message-orpheus', icon: '◆' };
  }
  if (!message.payload || typeof message.payload !== 'object' || Array.isArray(message.payload)
    || (message.payload.role !== 'A' && message.payload.role !== 'B')) {
    throw new TypeError('Invalid player message');
  }
  return { label: message.payload.role, className: 'message-player', icon: '◈' };
}

export function createIntercom(root) {
  const log = root.querySelector('[data-intercom-log]');
  const announcer = root.querySelector('[data-intercom-announcer]');
  if (!log || !announcer) throw new TypeError('Intercom root is incomplete');

  const renderedIds = new Set();
  const announcementQueue = [];
  let announcementTimer;
  let hydrated = false;

  function showAlarm(message) {
    const alarm = root.querySelector('[data-intercom-alarm]');
    if (!alarm) return;
    alarm.hidden = false;
    alarm.replaceChildren();
    const label = document.createElement('span');
    label.className = 'intercom-alarm-label';
    label.textContent = 'CONTAINMENT ALERT';
    const body = document.createElement('strong');
    body.textContent = message.text.replace(/^警報[:：]\s*/, '');
    alarm.append(label, body);
    alarm.classList.remove('is-visible');
    void alarm.offsetWidth;
    alarm.classList.add('is-visible');
    window.setTimeout(() => {
      alarm.hidden = true;
      alarm.classList.remove('is-visible');
    }, 4200);
  }

  function announce(sender, message) {
    announcementQueue.push(`${sender}: ${message.text}`);
    if (announcementTimer) return;
    announcementTimer = window.setTimeout(() => {
      announcer.textContent = announcementQueue.splice(0).join(' ');
      announcementTimer = undefined;
    }, ANNOUNCEMENT_DELAY);
  }

  function insert(message, shouldAnnounce) {
    if (!message || typeof message.id !== 'string' || typeof message.text !== 'string'
      || renderedIds.has(message.id)) return false;

    const followLatest = log.scrollHeight - log.scrollTop - log.clientHeight < BOTTOM_THRESHOLD;
    const profile = messageProfile(message);
    if (profile.className === 'message-alarm') {
      renderedIds.add(message.id);
      showAlarm(message);
      return true;
    }
    const entry = document.createElement('article');
    entry.className = `message ${profile.className}`;
    if (!prefersReducedMotion()) entry.classList.add('message-reveal');
    const sender = document.createElement('span');
    sender.className = 'message-sender';
    sender.textContent = profile.label;
    const body = document.createElement('p');
    body.textContent = message.text;
    entry.append(sender, body);
    log.append(entry);
    renderedIds.add(message.id);
    if (followLatest) log.scrollTop = log.scrollHeight;
    if (shouldAnnounce) announce(profile.label, message);
    return true;
  }

  function append(message) {
    return insert(message, true);
  }

  function render(messages) {
    const shouldAnnounce = hydrated;
    for (const message of messages || []) insert(message, shouldAnnounce);
    hydrated = true;
  }

  return { render, append };
}
