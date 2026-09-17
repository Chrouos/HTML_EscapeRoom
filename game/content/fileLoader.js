const fs = require('node:fs');
const path = require('node:path');

function invalidPath() {
  return Object.assign(new Error('Invalid content path'), { code: 'INVALID_CONTENT_PATH' });
}

function normalizeRelativePath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) throw invalidPath();
  if (relativePath.includes('\0') || /[\u0000-\u001f\u007f]/.test(relativePath)) throw invalidPath();

  const portable = relativePath.replaceAll('\\', '/');
  if (path.posix.isAbsolute(portable) || path.win32.isAbsolute(relativePath)) throw invalidPath();

  const parts = portable.split('/');
  if (parts.some(part => part === '..')) throw invalidPath();

  const normalized = path.posix.normalize(portable);
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) throw invalidPath();
  return normalized;
}

function createFileLoader({ rootDir } = {}) {
  if (typeof rootDir !== 'string' || !rootDir) throw new TypeError('rootDir is required');
  const absoluteRoot = path.resolve(rootDir);
  const cache = new Map();

  function filePathFor(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    const filePath = path.resolve(absoluteRoot, normalized);
    const rootPrefix = absoluteRoot.endsWith(path.sep) ? absoluteRoot : `${absoluteRoot}${path.sep}`;
    if (filePath !== absoluteRoot && !filePath.startsWith(rootPrefix)) throw invalidPath();
    return { normalized, filePath };
  }

  function read(relativePath) {
    const { normalized, filePath } = filePathFor(relativePath);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error(`Missing content file: ${normalized}`);
      throw new Error(`Unable to read content file: ${normalized}`);
    }
    if (!stat.isFile()) throw new Error(`Content path is not a file: ${normalized}`);

    const cached = cache.get(normalized);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.text;

    let text;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Unable to read content file: ${normalized}`);
    }
    cache.set(normalized, { mtimeMs: stat.mtimeMs, size: stat.size, text });
    return text;
  }

  function validate(relativePath) {
    try {
      const { normalized } = filePathFor(relativePath);
      read(normalized);
      return { ok: true, path: normalized };
    } catch (error) {
      const normalized = typeof relativePath === 'string' ? relativePath.replaceAll('\\', '/') : String(relativePath);
      return { ok: false, path: normalized, error: error.message };
    }
  }

  return Object.freeze({
    read,
    validate,
    clear() {
      cache.clear();
    }
  });
}

module.exports = { createFileLoader, normalizeRelativePath };
