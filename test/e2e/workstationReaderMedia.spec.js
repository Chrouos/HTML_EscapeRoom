const { test, expect } = require('@playwright/test');

test('reader renders authored media and Terminal suggests mutation commands', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(async () => {
    const { createWorkstation } = await import('/js/workstation.js');
    const host = document.createElement('section');
    host.dataset.workstation = '';
    document.body.append(host);

    const workstation = createWorkstation(host, { onOperation() {} });
    workstation.render({
      apps: [
        { id: 'files', label: 'Files' },
        { id: 'terminal', label: 'Terminal' }
      ],
      files: {
        rootId: 'root',
        entries: [
          { id: 'root', name: 'FILES', kind: 'folder', parentId: null },
          { id: 'briefs', name: 'BRIEFS', kind: 'folder', parentId: 'root' },
          {
            id: 'incident',
            name: 'incident.log',
            kind: 'file',
            parentId: 'briefs',
            content: '02:17 — signal loss',
            imageUrl: '/images/story/control-room-clock.png',
            imageAlt: 'Independent clock in the control room.',
            imageCaption: 'The clock is not corrected by the console.',
            imageRole: 'clue'
          }
        ]
      }
    });
  });

  const workspace = page.locator('[data-workstation]').last();
  await workspace.getByRole('button', { name: 'BRIEFS', exact: true }).click();
  await workspace.getByRole('button', { name: 'incident.log', exact: true }).click();

  const media = workspace.locator('[data-workstation-document-media]');
  await expect(media.locator('img')).toHaveAttribute('src', /control-room-clock\.png$/);
  await expect(media.locator('img')).toHaveAttribute('alt', 'Independent clock in the control room.');
  await expect(media.locator('figcaption')).toHaveText('The clock is not corrected by the console.');

  await workspace.getByRole('button', { name: 'Terminal', exact: true }).click();
  const input = workspace.locator('[data-terminal-input]');
  await input.fill('/');
  const suggestions = workspace.locator('[data-terminal-suggestions]');
  await expect(suggestions).toContainText('UNLOCK <filename>');
  await expect(suggestions).toContainText('DELETE <filename>');
  await expect(suggestions).toContainText('ADD <filename>');
  await expect(suggestions).toContainText('RESTORE <filename>');
});
