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
