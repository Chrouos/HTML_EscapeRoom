const { test, expect } = require('@playwright/test');

const actorAProjection = [
  { id: 'shared-opening', type: 'story', text: 'Proceed together.' },
  { id: 'a-only-instruction', type: 'story', text: 'Do not disclose cabinet seven.' },
  { id: 'player-a-line', type: 'player', text: 'I found a checksum.', payload: { role: 'A' } },
  { id: 'player-b-line', type: 'player', text: 'Read it back to me.', payload: { role: 'B' } }
];

const actorBProjection = [
  { id: 'shared-opening', type: 'story', text: 'Proceed together.' },
  { id: 'player-a-line', type: 'player', text: 'I found a checksum.', payload: { role: 'A' } },
  { id: 'player-b-line', type: 'player', text: 'Read it back to me.', payload: { role: 'B' } }
];

async function mountIntercom(page, name, messages) {
  await page.goto('/');
  await page.evaluate(async ({ name, messages }) => {
    const root = document.createElement('section');
    root.id = `fixture-${name}`;
    root.innerHTML = `
      <div data-intercom-log role="log" aria-label="Transmission log" aria-live="off"></div>
      <div data-intercom-alarm role="alert" hidden></div>
      <p data-intercom-announcer class="visually-hidden" role="status" aria-live="polite" aria-atomic="true"></p>
    `;
    document.body.replaceChildren(root);
    const { createIntercom } = await import('/public/js/intercom.js');
    window.fixtureIntercom = createIntercom(root);
    window.fixtureIntercom.render(messages);
  }, { name, messages });
}

test('labels player messages A or B while every AI line is only ORPHEUS', async ({ page }) => {
  await mountIntercom(page, 'a', actorAProjection);

  const log = page.getByRole('log', { name: 'Transmission log' });
  await expect(log.locator('.message-sender')).toHaveText(['ORPHEUS', 'ORPHEUS', 'A', 'B']);
  await expect(log.locator('.message-orpheus')).toHaveCount(2);
  await expect(log.locator('.message-orpheus').nth(0)).toHaveText(/ORPHEUSProceed together\./);
  await expect(log.locator('.message-orpheus').nth(1)).toHaveText(/ORPHEUSDo not disclose cabinet seven\./);
});

test('separates ECHO styling and keeps containment alarms out of the message log', async ({ page }) => {
  await mountIntercom(page, 'sources', [
    { id: 'official', type: 'story', text: 'ORPHEUS：官方指示。' },
    { id: 'echo', type: 'story', text: 'ECHO：我偷偷接進來幫你們。' },
    { id: 'alarm', type: 'story', text: '警報：隔離倒數歸零。' }
  ]);

  const fixture = page.locator('#fixture-sources');
  await expect(fixture.locator('.message-orpheus')).toHaveCount(1);
  await expect(fixture.locator('.message-echo')).toHaveCount(1);
  await expect(fixture.locator('.message-alarm')).toHaveCount(0);
  await expect(fixture.locator('[data-intercom-alarm]')).toBeVisible();
  await expect(fixture.locator('[data-intercom-alarm]')).toContainText('隔離倒數歸零');
});

test('renders no delivery metadata in text, classes, attributes, or accessibility labels', async ({ page }) => {
  await mountIntercom(page, 'a', actorAProjection);

  const serializedDom = await page.locator('#fixture-a').evaluate(root => {
    const values = [root.textContent];
    for (const element of [root, ...root.querySelectorAll('*')]) {
      values.push(element.className || '');
      for (const attribute of element.attributes) values.push(attribute.name, attribute.value);
    }
    return values.join('\n');
  });

  expect(serializedDom).not.toMatch(/audience|recipient|broadcast|direct|private|public|host|guest|player-?id/i);
});

test('an A-only projected entry leaves no trace in the B intercom', async ({ page }) => {
  await mountIntercom(page, 'b', actorBProjection);

  const fixture = page.locator('#fixture-b');
  const log = page.getByRole('log', { name: 'Transmission log' });
  await expect(log.locator('.message')).toHaveCount(3);
  await expect(fixture).not.toContainText('Do not disclose cabinet seven.');
  await expect(fixture).not.toContainText(/placeholder|missing|gap|unread|delayed|timing/i);
  await expect(fixture.locator('[hidden]:not([data-intercom-alarm]), [data-sequence], [data-unread], time')).toHaveCount(0);
});

test('rejects player entries without a canonical A or B payload role', async ({ page }) => {
  await mountIntercom(page, 'invalid-player', []);

  for (const message of [
    { id: 'missing-payload', type: 'player', text: 'Missing payload' },
    { id: 'null-payload', type: 'player', text: 'Null payload', payload: null },
    { id: 'wrong-role', type: 'player', text: 'Wrong role', payload: { role: 'C' } }
  ]) {
    const result = await page.evaluate(candidate => {
      try {
        window.fixtureIntercom.append(candidate);
        return 'accepted';
      } catch (error) {
        return `${error.name}: ${error.message}`;
      }
    }, message);
    expect(result).toBe('TypeError: Invalid player message');
  }

  await expect(page.getByRole('log', { name: 'Transmission log' }).locator('.message')).toHaveCount(0);
});

test('hydrates history silently and announces later render additions only through one throttled status', async ({ page }) => {
  await mountIntercom(page, 'announcements', actorBProjection);

  const log = page.getByRole('log', { name: 'Transmission log' });
  const announcer = page.getByRole('status');
  await expect(log).toHaveAttribute('aria-live', 'off');
  await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
  await page.waitForTimeout(350);
  await expect(announcer).toBeEmpty();

  await page.evaluate(messages => window.fixtureIntercom.render(messages), [
    ...actorBProjection,
    { id: 'new-one', type: 'story', text: 'First new signal.' },
    { id: 'new-two', type: 'story', text: 'Second new signal.' }
  ]);

  await expect(announcer).toHaveText('ORPHEUS: First new signal. ORPHEUS: Second new signal.');
});

test('keeps a reader position but follows new messages when already near the bottom', async ({ page }) => {
  const messages = Array.from({ length: 16 }, (_, index) => ({
    id: `line-${index}`,
    type: 'story',
    text: `Transmission ${index}`
  }));
  await mountIntercom(page, 'scroll', messages);
  const log = page.getByRole('log', { name: 'Transmission log' });
  await log.evaluate(node => {
    node.style.height = '120px';
    node.style.overflow = 'auto';
    node.scrollTop = 20;
  });
  const readingPosition = await log.evaluate(node => node.scrollTop);

  await page.evaluate(() => window.fixtureIntercom.append({
    id: 'reader-update', type: 'story', text: 'Reader update'
  }));
  expect(await log.evaluate(node => node.scrollTop)).toBe(readingPosition);

  await log.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await page.evaluate(() => window.fixtureIntercom.append({
    id: 'bottom-update', type: 'story', text: 'Bottom update'
  }));
  expect(await log.evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('status')).toContainText('Bottom update');
});
