const { test, expect } = require('@playwright/test');

test('author Story Map renders human stages, swimlanes, and a late truth node', async ({ page }) => {
  await page.goto('/author/reveal-graph');

  await expect(page.getByRole('heading', { name: 'ORPHEUS Story Map' })).toBeVisible();
  await expect(page.getByRole('button', { name: '身分揭露' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A 視角' })).toBeVisible();
  await expect(page.locator('[data-story-lane="shared"]')).toBeVisible();
  await expect(page.locator('[data-story-lane="A"]')).toBeVisible();
  await expect(page.locator('[data-story-lane="B"]')).toBeVisible();
  await expect(page.locator('[data-story-lane="ECHO"]')).toBeVisible();
  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toContainText('找到 ORPHEUS 完整歷史');
});

test('stage and viewpoint filters keep the map focused on human story concepts', async ({ page }) => {
  await page.goto('/author/reveal-graph');

  await page.getByRole('button', { name: '身分揭露' }).click();
  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toBeVisible();
  await expect(page.locator('[data-story-node="files.mainline"]')).toBeHidden();

  await page.getByRole('button', { name: 'A 視角' }).click();
  await expect(page.locator('[data-story-node][data-lane="B"]')).toHaveCount(0);
});

test('story inspector explains meaning before optional technical details and supports keyboard selection', async ({ page }) => {
  await page.goto('/author/reveal-graph');

  const node = page.locator('[data-story-node="archive.history_timeline"]');
  await node.focus();
  await node.press('Enter');

  const inspector = page.locator('[data-story-inspector]');
  await expect(inspector.getByRole('heading', { name: '這是什麼？' })).toBeVisible();
  await expect(inspector).toContainText(/Unit 17|ORPHEUS/);
  await expect(inspector.getByRole('heading', { name: '玩家怎麼看到？' })).toBeVisible();
  await expect(inspector.getByRole('heading', { name: '這會改變什麼？' })).toBeVisible();
  await expect(inspector.getByRole('heading', { name: '後面可能發生？' })).toBeVisible();

  await inspector.getByRole('button', { name: '顯示技術細節' }).click();
  await expect(inspector).toContainText('archive.history_timeline');
  await expect(inspector).toContainText('main5Completed');
});

test('diagnostic selection focuses the affected story node and explains the issue', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', async route => {
    const response = await route.fetch();
    const model = await response.json();
    model.diagnostics = [{
      code: 'UNREACHABLE',
      severity: 'warning',
      nodeId: 'file:archive.history_timeline',
      title: '這段故事可能永遠看不到',
      message: '目前沒有找到可以抵達這段故事的路徑。',
      relatedNodeIds: []
    }];
    await route.fulfill({ response, json: model });
  });

  await page.goto('/author/reveal-graph');
  await page.getByRole('button', { name: /這段故事可能永遠看不到/ }).click();

  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toHaveClass(/is-selected/);
  await expect(page.locator('[data-story-inspector]')).toContainText('目前沒有找到可以抵達這段故事的路徑。');
});

test('diagnostics-only filter keeps affected nodes without exposing hidden technical cards', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', async route => {
    const response = await route.fetch();
    const model = await response.json();
    model.diagnostics = [{
      code: 'UNREACHABLE',
      severity: 'warning',
      nodeId: 'file:archive.history_timeline',
      title: '這段故事可能永遠看不到',
      message: 'fixture issue',
      relatedNodeIds: []
    }];
    await route.fulfill({ response, json: model });
  });

  await page.goto('/author/reveal-graph');
  await page.getByLabel('只看需要注意的地方').check();

  await expect(page.locator('[data-story-node="archive.history_timeline"]')).toBeVisible();
  await expect(page.locator('[data-story-node="files.mainline"]')).toHaveCount(0);
  await expect(page.locator('[data-node-id^="fact:"]')).toHaveCount(0);
});

test('an empty API response keeps the page usable with a clear empty state', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      nodes: [],
      edges: [],
      stages: [
        { id: 'R0', label: '進入實驗', meaning: '' },
        { id: 'R4', label: '身分揭露', meaning: '' }
      ],
      lanes: [
        { id: 'shared', label: '共同故事' },
        { id: 'A', label: 'A 視角' },
        { id: 'B', label: 'B 視角' },
        { id: 'ECHO', label: 'ECHO / 系統介入' }
      ],
      diagnostics: []
    })
  }));

  await page.goto('/author/reveal-graph');
  await expect(page.getByText('這個篩選條件下沒有故事節點。')).toBeVisible();
});

test('partial graph diagnostics stay visible instead of crashing the viewer', async ({ page }) => {
  await page.route('**/author/api/reveal-graph', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      nodes: [],
      edges: [],
      stages: [],
      lanes: [],
      diagnostics: [{
        code: 'GRAPH_BUILD_ERROR',
        severity: 'error',
        nodeId: null,
        title: '部分故事資料無法解析',
        message: 'synthetic failure',
        relatedNodeIds: []
      }]
    })
  }));

  await page.goto('/author/reveal-graph');
  await expect(page.getByText('部分故事資料無法解析')).toBeVisible();
  await expect(page.getByText('synthetic failure')).toBeVisible();
});
