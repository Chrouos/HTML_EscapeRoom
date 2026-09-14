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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, stateChanged: false, publicResult: { operationId: operationRequest.operationId },
      unchanged: false, cursor: 1, state: stateFixture,
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
  await expect(workspace.locator('input')).toHaveCount(0);
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
