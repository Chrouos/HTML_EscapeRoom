const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const testServer = require('../helpers/testServer');
const { createAuthorRoutes } = require('../../routes/authorRoutes');

function appFor(env = 'test', options = {}) {
  const app = express();
  app.set('env', env);
  app.set('views', path.resolve(__dirname, '../../views'));
  app.set('view engine', 'ejs');
  app.use('/author', createAuthorRoutes(options));
  app.use((request, response) => response.status(404).type('text/plain').send('404'));
  return app;
}

async function withServer(app, run, env = 'test') {
  const server = await testServer(app);
  app.set('env', env);
  try {
    await run(server);
  } finally {
    await server.close();
  }
}

test('development/test author page and JSON API expose the Story Map', async () => {
  await withServer(appFor('test'), async server => {
    const page = await fetch(`${server.baseUrl}/author/reveal-graph`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /ORPHEUS Story Map/);
    assert.match(html, /data-author-story-map/);

    const api = await fetch(`${server.baseUrl}/author/api/reveal-graph`);
    const model = await api.json();
    assert.equal(api.status, 200);
    assert.ok(model.nodes.some(node => node.refId === 'archive.history_timeline'));
    assert.ok(model.stages.some(stage => stage.label === '身分揭露'));
    assert.ok(Array.isArray(model.diagnostics));
  });
});

test('production hides both author endpoints behind normal 404 handling', async () => {
  await withServer(appFor('production'), async server => {
    for (const pathname of ['/author/reveal-graph', '/author/api/reveal-graph']) {
      const response = await fetch(`${server.baseUrl}${pathname}`);
      assert.equal(response.status, 404, pathname);
      assert.equal(await response.text(), '404');
    }
  }, 'production');
});

test('a graph build failure returns a usable partial model instead of crashing the author tool', async () => {
  const buildModel = () => {
    throw new Error('synthetic author graph failure');
  };

  await withServer(appFor('test', { buildModel }), async server => {
    const api = await fetch(`${server.baseUrl}/author/api/reveal-graph`);
    const model = await api.json();
    assert.equal(api.status, 200);
    assert.deepEqual(model.nodes, []);
    assert.deepEqual(model.edges, []);
    assert.ok(model.diagnostics.some(item =>
      item.code === 'GRAPH_BUILD_ERROR'
        && item.title === '部分故事資料無法解析'
        && /synthetic author graph failure/.test(item.message)
    ));

    const page = await fetch(`${server.baseUrl}/author/reveal-graph`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /ORPHEUS Story Map/);
  });
});
