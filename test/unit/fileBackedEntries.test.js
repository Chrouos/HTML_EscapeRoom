const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createFileLoader, attachFileContent } = require('../../game/content/fileLoader');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'orpheus-entry-files-'));
}

test('attaches a reloadable text getter to an authored entry', async () => {
  const rootDir = tempRoot();
  const file = path.join(rootDir, 'notice.md');
  fs.writeFileSync(file, '第一版文件', 'utf8');
  const loader = createFileLoader({ rootDir });
  const entry = attachFileContent({ id: 'doc.notice' }, 'notice.md', loader);

  assert.equal(entry.contentFile, 'notice.md');
  assert.equal(entry.text, '第一版文件');

  await new Promise(resolve => setTimeout(resolve, 10));
  fs.writeFileSync(file, '第二版文件', 'utf8');

  assert.equal(entry.text, '第二版文件');
});

test('does not replace the authoring metadata when attaching file content', () => {
  const rootDir = tempRoot();
  fs.writeFileSync(path.join(rootDir, 'notice.md'), '文件', 'utf8');
  const loader = createFileLoader({ rootDir });
  const entry = attachFileContent({ id: 'doc.notice', audience: { kind: 'both' } }, 'notice.md', loader);

  assert.deepEqual(entry.audience, { kind: 'both' });
  assert.equal(entry.text, '文件');
});
