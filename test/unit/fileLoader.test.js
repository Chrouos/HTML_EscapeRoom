const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createFileLoader } = require('../../game/content/fileLoader');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'orpheus-files-'));
}

test('reads UTF-8 Markdown content from the configured root', () => {
  const rootDir = tempRoot();
  fs.mkdirSync(path.join(rootDir, 'public'));
  fs.writeFileSync(path.join(rootDir, 'public', 'notice.md'), '第一版內容', 'utf8');

  const loader = createFileLoader({ rootDir });

  assert.equal(loader.read('public/notice.md'), '第一版內容');
});

test('reloads changed content without recreating the loader', async () => {
  const rootDir = tempRoot();
  const file = path.join(rootDir, 'notice.md');
  fs.writeFileSync(file, '第一版內容', 'utf8');
  const loader = createFileLoader({ rootDir });

  assert.equal(loader.read('notice.md'), '第一版內容');
  await new Promise(resolve => setTimeout(resolve, 10));
  fs.writeFileSync(file, '第二版內容', 'utf8');

  assert.equal(loader.read('notice.md'), '第二版內容');
});

test('rejects traversal and absolute paths', () => {
  const loader = createFileLoader({ rootDir: tempRoot() });

  assert.throws(() => loader.read('../secret.md'), /invalid content path/i);
  assert.throws(() => loader.read('C:\\secret.md'), /invalid content path/i);
});

test('reports missing content without exposing the local root to callers', () => {
  const rootDir = tempRoot();
  const loader = createFileLoader({ rootDir });

  const result = loader.validate('missing.md');

  assert.equal(result.ok, false);
  assert.equal(result.path, 'missing.md');
  assert.match(result.error, /missing/i);
  assert.doesNotMatch(result.error, new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
