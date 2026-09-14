const { test, expect } = require('@playwright/test');

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

async function mount(page) {
  await page.goto('/');
  await page.route('**/api/fixture/actions', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
  await page.evaluate(async fixture => {
    const root = document.createElement('section');
    root.innerHTML = '<div data-workstation></div>';
    document.body.replaceChildren(root);
    const { createWorkstation } = await import('/public/js/workstation.js');
    window.fixtureOperations = [];
    window.fixtureWorkstation = createWorkstation(root, {
      async onOperation(operation) {
        window.fixtureOperations.push(operation);
        await fetch('/api/fixture/actions', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(operation)
        });
      }
    });
    window.fixtureWorkstation.render(fixture);
  }, workstationFixture);
}

test('explores Files folders and entries without leaking locked names', async ({ page }) => {
  await mount(page);
  const workspace = page.locator('[data-workstation]');
  await expect(workspace.getByRole('button', { name: 'Files', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await expect(workspace).not.toContainText('blackbox.txt');
  await workspace.getByRole('button', { name: 'incident.log', exact: true }).click();
  await expect(workspace.locator('[data-workstation-entry-content]')).toContainText('02:17');
  await workspace.getByRole('button', { name: /back/i }).click();
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
});

test('renders controlled Terminal operations and sends a fresh action id', async ({ page }) => {
  await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  await workspace.getByRole('button', { name: 'OPEN AUX', exact: true }).click();
  const operations = await page.evaluate(() => window.fixtureOperations);
  expect(operations).toHaveLength(1);
  expect(operations[0].operationId).toBe('open_aux');
  expect(operations[0].actionId).toMatch(/^[a-zA-Z0-9_-]+$/);
  expect(operations[0].actionId).not.toBe(operations[0].operationId);
  await expect(workspace.locator('input')).toHaveCount(0);
});

test('Backspace and keyboard navigation stay inside the workstation', async ({ page }) => {
  await mount(page);
  const before = page.url();
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await workspace.focus();
  await page.keyboard.press('Backspace');
  expect(page.url()).toBe(before);
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
});

test('Logs is explorable and live renders preserve the current folder', async ({ page }) => {
  await mount(page);
  const workspace = page.locator('[data-workstation]');
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await page.evaluate(fixture => window.fixtureWorkstation.render(fixture), {
    ...workstationFixture,
    intercom: [{ id: 'new', text: 'new signal' }]
  });
  await expect(workspace.getByRole('button', { name: 'incident.log', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'Logs', exact: true }).click();
  await expect(workspace.locator('[data-workstation-log]')).toContainText('Console ready.');
});
