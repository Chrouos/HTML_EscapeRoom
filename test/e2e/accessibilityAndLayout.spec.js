const { test, expect } = require('@playwright/test');

async function openPairedRoom(browser, viewport, reducedMotion = 'no-preference') {
  const playerContext = await browser.newContext({ viewport, reducedMotion });
  const partnerContext = await browser.newContext();
  const player = await playerContext.newPage();
  const partner = await partnerContext.newPage();

  await player.goto('/');
  await player.getByRole('button', { name: '建立房間（玩家 A）' }).click();
  await expect(player).toHaveURL(/\/rooms\/\d{6}$/);
  await partner.goto(player.url());
  await partner.getByRole('button', { name: '加入房間（玩家 B）' }).click();
  await expect(player.locator('[data-clues]')).toContainText('ORPHEUS');

  return { player, partner, playerContext, partnerContext };
}

async function expectUniqueLabelRelationships(page) {
  const labelledRegions = page.locator('[role="region"][aria-labelledby]');
  const labelledRegionCount = await labelledRegions.count();
  const relationships = await labelledRegions.evaluateAll(regions => regions.map(region => {
    const labelId = region.getAttribute('aria-labelledby');
    return {
      labelId,
      matchingLabels: labelId ? document.querySelectorAll(`#${CSS.escape(labelId)}`).length : 0,
      labelText: labelId ? document.getElementById(labelId)?.textContent.trim() : ''
    };
  }));

  expect(labelledRegionCount).toBeGreaterThanOrEqual(3);
  expect(relationships.every(({ labelId, matchingLabels, labelText }) =>
    Boolean(labelId) && matchingLabels === 1 && Boolean(labelText))).toBe(true);
  expect(new Set(relationships.map(({ labelId }) => labelId)).size).toBe(relationships.length);
}

test('desktop renders two accessible monitors without horizontal overflow', async ({ browser }, testInfo) => {
  const room = await openPairedRoom(browser, { width: 1440, height: 900 }, 'reduce');
  try {
    const { player } = room;
    const intercom = player.getByRole('region', { name: 'MONITOR 01 / INTERCOM', exact: true });
    const operations = player.getByRole('region', { name: 'MONITOR 02 / OPERATIONS', exact: true });

    await expect(intercom).toBeVisible();
    await expect(operations).toBeVisible();
    await expect(intercom.getByRole('log')).toHaveCount(1);
    await expect(operations.locator('[data-operations-workspace]')).toHaveCount(1);
    await expect(player.getByRole('radiogroup', { name: 'Monitor selection' })).toBeHidden();
    await expect(player.getByText('02 / PRIVATE CHANNEL', { exact: true })).toHaveCount(0);
    expect(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectUniqueLabelRelationships(player);

    const input = player.getByLabel('提交答案', { exact: true });
    await input.focus();
    expect(await input.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
    await player.locator('[data-game-room]').evaluate(node => node.classList.add('emergency'));
    expect(await player.locator('[data-countdown]').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
    await player.screenshot({ path: testInfo.outputPath('dual-monitor-desktop.png'), fullPage: true });
  } finally {
    await room.playerContext.close();
    await room.partnerContext.close();
  }
});

test('390px viewport exposes keyboard-operated monitor tabs and one active pane', async ({ browser }, testInfo) => {
  const room = await openPairedRoom(browser, { width: 390, height: 844 });
  try {
    const { player } = room;
    const tabs = player.getByRole('radiogroup', { name: 'Monitor selection' });
    const intercomTab = player.getByRole('radio', { name: 'Intercom', exact: true });
    const operationsTab = player.getByRole('radio', { name: 'Operations', exact: true });
    const intercom = player.getByRole('region', { name: 'MONITOR 01 / INTERCOM', exact: true });
    const operations = player.getByRole('region', { name: 'MONITOR 02 / OPERATIONS', exact: true });

    await expect(tabs).toBeVisible();
    await expect(intercomTab).toBeChecked();
    await expect(intercom).toBeVisible();
    await expect(operations).toBeHidden();

    await intercomTab.focus();
    await expect(intercomTab).toBeFocused();
    await player.keyboard.press('Tab');
    await expect(player.getByLabel('傳訊給另一位受試者')).toBeFocused();
    await expect(player.getByLabel('提交答案', { exact: true })).not.toBeFocused();
    await player.keyboard.press('Shift+Tab');
    await expect(intercomTab).toBeFocused();

    await player.keyboard.press('ArrowRight');
    await expect(operationsTab).toBeFocused();
    await expect(operationsTab).toBeChecked();
    await expect(intercom).toBeHidden();
    await expect(operations).toBeVisible();
    await player.keyboard.press('Tab');
    await expect(player.getByLabel('提交答案', { exact: true })).toBeFocused();
    await expect(player.getByLabel('傳訊給另一位受試者')).not.toBeFocused();
    await player.keyboard.press('Shift+Tab');
    await expect(operationsTab).toBeFocused();

    expect(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectUniqueLabelRelationships(player);
    await player.screenshot({ path: testInfo.outputPath('dual-monitor-mobile.png'), fullPage: true });
  } finally {
    await room.playerContext.close();
    await room.partnerContext.close();
  }
});

test('lost chat acknowledgement preserves text and retry does not duplicate', async ({ browser }) => {
  const room = await openPairedRoom(browser, { width: 1440, height: 900 });
  try {
    const { player: a, partner: b } = room;
    await a.route('**/chat', async route => { await route.fetch(); await route.abort(); });
    const input = a.getByLabel('傳訊給另一位受試者');
    await input.fill('回覆遺失測試');
    await a.getByRole('button', { name: '傳送訊息' }).click();
    await expect(a.locator('[data-chat-feedback]')).toContainText('未確認送達');
    await expect(input).toHaveValue('回覆遺失測試');
    await a.unroute('**/chat');
    await a.getByRole('button', { name: '傳送訊息' }).click();
    await expect(input).toHaveValue('');
    await expect(b.getByRole('log').getByText('回覆遺失測試', { exact: true })).toHaveCount(1);
  } finally {
    await room.playerContext.close();
    await room.partnerContext.close();
  }
});
