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
  await expect(player.locator('[data-intercom-log]')).toContainText('ORPHEUS');

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
    const statusMetrics = await player.locator('.status-bar').evaluate(node => {
      const rect = node.getBoundingClientRect();
      const plaque = node.querySelector('.status-plaque')?.getBoundingClientRect();
      const timer = node.querySelector('.status-timer')?.getBoundingClientRect();
      return {
        height: rect.height,
        plaqueLeft: plaque?.left ?? 0,
        timerRight: timer?.right ?? 0,
        viewportRight: innerWidth
      };
    });
    expect(statusMetrics.height).toBeLessThanOrEqual(110);
    expect(statusMetrics.plaqueLeft).toBeGreaterThanOrEqual(0);
    expect(statusMetrics.timerRight).toBeLessThanOrEqual(statusMetrics.viewportRight);
    await expect(intercom.getByRole('log')).toHaveCount(1);
    await expect(operations.locator('[data-operations-workspace]')).toHaveCount(1);
    await expect(player.getByRole('radiogroup', { name: 'Monitor selection' })).toBeHidden();
    await expect(player.getByText('02 / PRIVATE CHANNEL', { exact: true })).toHaveCount(0);
    expect(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectUniqueLabelRelationships(player);

    await operations.locator('[data-workstation-app="terminal"]').click();
    const input = player.locator('[data-terminal-input]');
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

test('desktop keeps room chrome compact so monitors dominate the viewport', async ({ browser }) => {
  const room = await openPairedRoom(browser, { width: 1440, height: 900 }, 'reduce');
  try {
    const { player } = room;
    const metrics = await player.evaluate(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
      const header = rect('.game-site-header');
      const status = rect('.game-room-shell .status-bar');
      const connection = rect('.game-room-shell .connection-band');
      const monitors = rect('.game-room-shell .monitor-selector');
      return {
        headerHeight: header?.height ?? 0,
        statusHeight: status?.height ?? 0,
        connectionHeight: connection?.height ?? 0,
        monitorTop: monitors?.top ?? 0,
        monitorHeight: monitors?.height ?? 0,
        viewportHeight: innerHeight
      };
    });

    expect(metrics.headerHeight).toBeLessThanOrEqual(60);
    expect(metrics.statusHeight).toBeLessThanOrEqual(72);
    expect(metrics.connectionHeight).toBeLessThanOrEqual(32);
    expect(metrics.monitorTop).toBeLessThanOrEqual(188);
    expect(metrics.monitorHeight).toBeGreaterThanOrEqual(metrics.viewportHeight - 245);
  } finally {
    await room.playerContext.close();
    await room.partnerContext.close();
  }
});

test('desktop monitor shells share a bounded viewport height and scroll their own contents', async ({ browser }) => {
  const room = await openPairedRoom(browser, { width: 1440, height: 900 }, 'reduce');
  try {
    const { player } = room;
    const frames = player.locator('.workstation-shell > .monitor-frame');
    await expect(frames).toHaveCount(2);
    const metrics = await frames.evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      const screen = node.querySelector('.monitor-screen');
      const content = node.querySelector('.operations-workspace');
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        viewport: window.innerHeight,
        screenClientHeight: screen?.clientHeight ?? 0,
        screenScrollHeight: screen?.scrollHeight ?? 0,
        contentClientHeight: content?.clientHeight ?? 0,
        contentScrollHeight: content?.scrollHeight ?? 0
      };
    }));
    console.log('bounded metrics', metrics);

    expect(metrics[0].height).toBeGreaterThan(0);
    expect(metrics[1].height).toBeGreaterThan(0);
    expect(Math.abs(metrics[0].height - metrics[1].height)).toBeLessThanOrEqual(2);
    expect(metrics.every(({ top, bottom, viewport }) => top >= 0 && bottom <= viewport + 1)).toBe(true);
    expect(
      metrics[1].screenScrollHeight > metrics[1].screenClientHeight ||
      metrics[1].contentScrollHeight > metrics[1].contentClientHeight
    ).toBe(true);
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
    await player.keyboard.press('Shift+Tab');
    await expect(intercomTab).toBeFocused();

    await player.keyboard.press('ArrowRight');
    await expect(operationsTab).toBeFocused();
    await expect(operationsTab).toBeChecked();
    await expect(intercom).toBeHidden();
    await expect(operations).toBeVisible();
    await player.keyboard.press('Tab');
    await expect(operations.locator('[data-workstation-app="files"]')).toBeFocused();
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

test('CRT atmosphere uses restrained motion when motion is available', async ({ browser }) => {
  const room = await openPairedRoom(browser, { width: 1440, height: 900 }, 'no-preference');
  try {
    const { player } = room;
    const effects = await player.locator('.intercom-monitor .monitor-screen').evaluate(screen => {
      const frame = screen.closest('.monitor-frame');
      const message = screen.querySelector('.message');
      const style = node => node ? getComputedStyle(node) : null;
      const screenStyle = style(screen);
      const frameStyle = style(frame);
      const beforeStyle = getComputedStyle(screen, '::before');
      const afterStyle = getComputedStyle(screen, '::after');
      const messageStyle = style(message);
      return {
        screenAnimation: screenStyle.animationName,
        frameAnimation: frameStyle.animationName,
        scanAnimation: beforeStyle.animationName,
        noiseAnimation: afterStyle.animationName,
        messageAnimation: messageStyle?.animationName,
        messageDuration: messageStyle?.animationDuration
      };
    });

    expect(effects.screenAnimation).toBe('crt-phosphor-bloom');
    expect(effects.frameAnimation).toBe('crt-boot-pulse');
    expect(effects.scanAnimation).toBe('crt-scan-sweep');
    expect(effects.noiseAnimation).toBe('crt-signal-noise');
    expect(effects.messageAnimation).toBe('crt-message-reveal');
    expect(parseFloat(effects.messageDuration)).toBeGreaterThan(0);
  } finally {
    await room.playerContext.close();
    await room.partnerContext.close();
  }
});

test('reduced motion removes CRT effects and keeps intercom content and controls available', async ({ browser }) => {
  const room = await openPairedRoom(browser, { width: 1440, height: 900 }, 'reduce');
  try {
    const { player } = room;
    const effects = await player.locator('.intercom-monitor .monitor-screen').evaluate(screen => {
      const frame = screen.closest('.monitor-frame');
      const message = screen.querySelector('.message');
      const style = node => node ? getComputedStyle(node) : null;
      const screenStyle = style(screen);
      const frameStyle = style(frame);
      const beforeStyle = getComputedStyle(screen, '::before');
      const afterStyle = getComputedStyle(screen, '::after');
      const messageStyle = style(message);
      return {
        screenAnimation: screenStyle.animationName,
        frameAnimation: frameStyle.animationName,
        scanAnimation: beforeStyle.animationName,
        noiseAnimation: afterStyle.animationName,
        messageAnimation: messageStyle?.animationName,
        animationDuration: messageStyle?.animationDuration,
        transitionDuration: messageStyle?.transitionDuration,
        animationDelay: messageStyle?.animationDelay,
        transform: messageStyle?.transform
      };
    });

    expect(effects.screenAnimation).toBe('none');
    expect(effects.frameAnimation).toBe('none');
    expect(effects.scanAnimation).toBe('none');
    expect(effects.noiseAnimation).toBe('none');
    expect(effects.messageAnimation).toBe('none');
    expect(effects.animationDuration).toBe('0s');
    expect(effects.transitionDuration).toBe('0s');
    expect(effects.animationDelay).toBe('0s');
    expect(effects.transform).toBe('none');
    await expect(player.getByRole('log')).toContainText('ORPHEUS');
    await expect(player.locator('[data-chat-form] input')).toBeVisible();
    await expect(player.locator('[data-chat-form] button[type="submit"]')).toBeVisible();
  } finally {
    await room.playerContext.close();
    await room.partnerContext.close();
  }
});
