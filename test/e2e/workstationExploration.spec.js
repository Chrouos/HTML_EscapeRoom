const { test, expect } = require('@playwright/test');

test.setTimeout(60_000);

const workstationFixture = {
  activeApp: 'files',
  files: {
    rootId: 'root',
    entries: [
      { id: 'root', name: 'FILES', kind: 'folder', parentId: null },
      { id: 'briefs', name: 'BRIEFS', kind: 'folder', parentId: 'root' },
      { id: 'incident', name: 'incident.log', kind: 'file', parentId: 'briefs', content: '02:17 — signal loss' },
      { id: 'locked', name: 'blackbox.txt', kind: 'file', parentId: 'root', locked: true, content: 'never send this' }
    ]
  },
  terminal: {
    operations: [{ operationId: 'open_aux', label: 'OPEN AUX', description: 'Mount the auxiliary index.', value: 'OPEN AUX' }]
  },
  logs: [{ id: 'boot', title: 'BOOT RECORD', text: 'Console ready.' }]
};

const stateFixture = {
  occupancy: { A: true, B: true, count: 2, capacity: 2, ready: true },
  publicProgress: { chapter: 1, mainProgress: [], puzzleId: 'main1', stepId: 'identity', title: 'Identity', prompt: '', hints: [], sidePuzzles: [] },
  intercom: [],
  workstation: workstationFixture,
  privateMissions: [],
  discoveredEvidence: [],
  ending: null
};

async function mount(page) {
  await page.goto('/');
  await page.locator('form[action="/rooms"] button').click();
  const roomUrl = page.url();
  const partnerContext = await page.context().browser().newContext();
  const partner = await partnerContext.newPage();
  await partner.goto(roomUrl);
  await partner.locator('form[action="/rooms/join"] button').click();
  let operationRequest;
  await page.route('**/api/rooms/*/state*', async route => {
    const url = new URL(route.request().url());
    const sinceCursor = url.searchParams.get('sinceCursor');
    if (sinceCursor !== null) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, unchanged: true, cursor: 1, countdown: { status: 'running', remainingMs: 1000 }
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, unchanged: false, cursor: 1, state: stateFixture,
      countdown: { status: 'running', remainingMs: 1000 }
    }) });
  });
  await page.route('**/api/rooms/*/actions', async route => {
    operationRequest = route.request().postDataJSON();
    const state = operationRequest.operationId === 'terminal_command' && /^HINT$/i.test(operationRequest.value || '')
      ? { ...stateFixture, intercom: [{ id: 'hint', type: 'story', text: 'Shared signal: compare the timestamps.' }], workstation: workstationFixture }
      : stateFixture;
    const publicResult = operationRequest.operationId === 'terminal_command'
      ? { command: String(operationRequest.value || '').split(/\s+/)[0].toUpperCase(), output: 'HELP\nSEARCH <node>\nSCAN <filename>\nUNZIP <filename>\nHINT\nSEND <text>' }
      : { operationId: operationRequest.operationId };
    const cursor = operationRequest.operationId === 'terminal_command' && /^HINT$/i.test(operationRequest.value || '') ? 2 : 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, stateChanged: false, publicResult,
      unchanged: false, cursor, state,
      countdown: { status: 'running', remainingMs: 1000 }
    }) });
  });
  await page.goto(roomUrl);
  return { partnerContext, getOperation: () => operationRequest };
}

test('explores Files folders and entries without leaking locked names', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await expect(workspace).not.toContainText('blackbox.txt');
  await workspace.getByRole('button', { name: 'incident.log', exact: true }).click();
  await expect(workspace.locator('[data-workstation-entry-content]')).toContainText('02:17');
  await expect.poll(room.getOperation).toMatchObject({ operationId: 'open_entry', value: 'incident' });
  await workspace.getByRole('button', { name: /back/i }).click();
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await room.partnerContext.close();
});

test('renders controlled Terminal operations and sends a fresh action id', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  await workspace.getByRole('button', { name: 'OPEN AUX', exact: true }).click();
  await expect.poll(room.getOperation).toBeTruthy();
  expect(room.getOperation().operationId).toBe('open_aux');
  expect(room.getOperation().actionId).toMatch(/^[a-zA-Z0-9_-]+$/);
  expect(room.getOperation().actionId).not.toBe(room.getOperation().operationId);
  await expect(workspace.locator('[data-terminal-input]')).toBeVisible();
  await room.partnerContext.close();
});

test('accepts a real Terminal command and renders echo plus safe output', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  const input = workspace.locator('[data-terminal-input]');
  await expect(input).toBeVisible();
  await input.fill('HELP');
  await input.press('Enter');
  await expect.poll(room.getOperation).toMatchObject({ operationId: 'terminal_command', value: 'HELP' });
  await expect(workspace.locator('[data-terminal-history]')).toContainText('HELP');
  await expect(workspace.locator('[data-terminal-output]')).toContainText('SEARCH <node>');
  await expect(input).toBeFocused();
  await room.partnerContext.close();
});

test('renders public HINT result in the intercom without audience metadata', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  await workspace.locator('[data-terminal-input]').fill('HINT');
  await workspace.locator('[data-terminal-input]').press('Enter');
  await expect(page.locator('[data-intercom-log]')).toContainText('Shared signal: compare the timestamps.');
  const serialized = await page.locator('[data-intercom-log]').evaluate(node => node.outerHTML);
  expect(serialized).not.toMatch(/audience|recipient|broadcast|direct/i);
  await room.partnerContext.close();
});

test('keeps the active puzzle shell hidden until the answer file gate opens', async ({ page }) => {
  const room = await mount(page);
  await expect(page.locator('[data-puzzle-gate]')).toBeHidden();
  const gated = structuredClone(workstationFixture);
  gated.answerGate = { entryId: 'gate', puzzleId: 'main1', open: true };
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), gated);
  await expect(page.locator('[data-puzzle-gate]')).toBeVisible();
  await room.partnerContext.close();
});

test('Backspace and keyboard navigation stay inside the workstation', async ({ page }) => {
  const room = await mount(page);
  const before = page.url();
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await workspace.focus();
  await page.keyboard.press('Backspace');
  expect(page.url()).toBe(before);
  await expect(workspace.getByRole('button', { name: 'BRIEFS', exact: true })).toBeVisible();
  await room.partnerContext.close();
});

test('Logs is explorable and live renders preserve the current folder', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Files', exact: true }).focus();
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), workstationFixture);
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeFocused();
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), workstationFixture);
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'Logs', exact: true }).click();
  await expect(workspace.locator('[data-workstation-log]')).toContainText('Console ready.');
  await room.partnerContext.close();
});

test('accepts type-only folder roots and returns to the parent', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  const typeOnly = structuredClone(workstationFixture);
  delete typeOnly.files.rootId;
  typeOnly.files.entries = typeOnly.files.entries.map(entry => {
    const copy = { ...entry };
    delete copy.kind;
    if (entry.kind === 'folder') copy.type = 'folder';
    return copy;
  });
  await page.evaluate(() => {
    const workstation = document.querySelector('[data-game-room]').workstation;
    workstation.openApp('terminal');
  });
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), typeOnly);
  await page.evaluate(() => document.querySelector('[data-game-room]').workstation.openApp('files'));
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: /back/i }).click();
  await expect(workspace.getByRole('button', { name: 'BRIEFS', exact: true })).toBeVisible();
  await room.partnerContext.close();
});

test('keeps locked metadata visible and gates the answer form behind the opened file', async ({ page }) => {
  const room = await mount(page);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  const gated = structuredClone(workstationFixture);
  gated.answerGate = { entryId: 'gate', puzzleId: 'main1', open: false };
  gated.files.entries.push({ id: 'gate', name: 'answer_main1.lock', kind: 'file', parentId: 'root', locked: false, metadataVisible: true, content: 'sealed' });
  gated.files.entries.push({ id: 'sealed', name: 'sealed.notes', kind: 'file', parentId: 'root', locked: true, metadataVisible: true });
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), gated);
  await expect(workspace.getByRole('button', { name: /sealed\.notes/i })).toBeDisabled();
  await expect(page.locator('[data-action-form]')).toBeHidden();
  gated.answerGate.open = true;
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), gated);
  await expect(page.locator('[data-action-form]')).toBeVisible();
  await room.partnerContext.close();
});

test('fills the desktop viewport and preserves workstation scroll on live renders', async ({ page }) => {
  const room = await mount(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const workspace = page.locator('[data-workstation]');
  const longFixture = structuredClone(workstationFixture);
  longFixture.files.entries.push(...Array.from({ length: 30 }, (_, index) => ({
    id: `log-${index}`,
    name: `record-${index}.log`,
    kind: 'file',
    parentId: 'root',
    content: `record ${index}`
  })));
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), longFixture);
  const shell = page.locator('.game-room-shell');
  const shellWidth = await shell.evaluate(node => node.getBoundingClientRect().width);
  expect(shellWidth).toBeGreaterThan(1300);
  const scroll = workspace.locator('[data-workstation-scroll]');
  const monitorScreen = page.locator('.operations-screen');
  await expect.poll(async () => monitorScreen.evaluate(node => ({
    overflowWidth: node.scrollWidth - node.clientWidth,
    overflowHeight: node.scrollHeight - node.clientHeight
  }))).toEqual({ overflowWidth: 0, overflowHeight: 0 });
  await expect.poll(async () => scroll.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(0);
  await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
  const before = await scroll.evaluate(node => node.scrollTop);
  await page.evaluate(fixture => document.querySelector('[data-game-room]').workstation.render(fixture), longFixture);
  const after = await scroll.evaluate(node => node.scrollTop);
  expect(after).toBeGreaterThanOrEqual(Math.max(0, before - 2));
  await room.partnerContext.close();
});
