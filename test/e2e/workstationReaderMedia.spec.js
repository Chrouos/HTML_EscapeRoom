const { test, expect } = require('@playwright/test');

test.setTimeout(60_000);

const workstationFixture = {
  activeApp: 'files',
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
  },
  terminal: { operations: [] },
  logs: []
};

const stateFixture = {
  occupancy: { A: true, B: true, count: 2, capacity: 2, ready: true },
  publicProgress: {
    chapter: 1,
    mainProgress: [],
    puzzleId: 'main1',
    stepId: 'identity',
    title: 'Identity',
    prompt: '',
    hints: [],
    sidePuzzles: []
  },
  intercom: [],
  workstation: workstationFixture,
  privateMissions: [],
  discoveredEvidence: [],
  ending: null
};

async function mount(page) {
  // This test owns the workstation snapshot. Close the real live stream so a
  // room event cannot overwrite the fixture while the Reader assertions run.
  await page.routeWebSocket('**/live*', socket => socket.close());

  await page.goto('/');
  await page.locator('form[action="/rooms"] button').click();
  const roomUrl = page.url();

  const partnerContext = await page.context().browser().newContext();
  const partner = await partnerContext.newPage();
  await partner.goto(roomUrl);
  await partner.locator('form[action="/rooms/join"] button').click();

  await page.route('**/api/rooms/*/state*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('sinceCursor')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          unchanged: true,
          cursor: 1,
          countdown: { status: 'running', remainingMs: 60_000 }
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        unchanged: false,
        cursor: 1,
        state: stateFixture,
        countdown: { status: 'running', remainingMs: 60_000 }
      })
    });
  });

  await page.route('**/api/rooms/*/actions', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        stateChanged: false,
        unchanged: false,
        cursor: 1,
        state: stateFixture,
        publicResult: {},
        countdown: { status: 'running', remainingMs: 60_000 }
      })
    });
  });

  await page.goto(roomUrl);
  await page.locator('[data-workstation]').waitFor({ state: 'attached' });
  await page.waitForFunction(() => typeof document.querySelector('[data-game-room]')?.workstation?.render === 'function');
  return partnerContext;
}

test('reader renders authored media and Terminal suggests mutation commands', async ({ page }) => {
  const partnerContext = await mount(page);
  const workspace = page.locator('[data-workstation]');

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

  await partnerContext.close();
});
