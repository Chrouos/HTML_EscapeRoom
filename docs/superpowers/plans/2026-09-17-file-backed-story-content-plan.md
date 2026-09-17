# File-Backed Story Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move player-visible FILE document text out of JavaScript and into editable UTF-8 files that the running game reloads when their contents change, while preserving server-side A/B permissions and adding the next ECHO narrative documents.

**Architecture:** Keep gameplay metadata, unlock predicates, audience rules, verification links, and archive manifests in the existing declarative JavaScript structures. Replace authored `text` literals with safe relative `contentFile` paths. A small file loader reads from `game/content/files`, caches by modification time, and returns the latest valid text on the next workstation projection. The browser continues to receive only the role-safe server projection; the local content directory is never served as static assets.

**Tech Stack:** Node.js CommonJS, built-in `fs`/`path`, existing Express/EJS server, Node test runner, current terminal/workstation engine.

**Spec:** `docs/superpowers/specs/2026-09-17-orpheus-echo-story-bible.md`, `docs/superpowers/specs/2026-09-17-orpheus-echo-document-drafts.md`

## Global Constraints

- Content files live under `game/content/files`; do not place private files under `public` or `views`.
- File paths are authored metadata only; clients cannot choose arbitrary filesystem paths.
- A/B audience filtering remains server-side and must happen before file text enters a response.
- UTF-8 Markdown files contain visible document text; JavaScript retains structure and game rules.
- Editing a Markdown file must be visible on the next workstation refresh without restarting the Node process.
- Missing or invalid authored content must fail content validation with a clear file path and entry ID.
- Existing mainline reachability, private mission fallbacks, archive access, and current unrelated worktree changes must remain intact.
- Tests must use real filesystem behavior where possible and must watch the new test fail before implementation.

---

### Task 1: Add the file-backed content loader

**Files:**

- Create: `game/content/fileLoader.js`
- Create: `test/unit/fileLoader.test.js`

**Interfaces:**

- Produces `createFileLoader({ rootDir })`.
- `loader.read(relativePath)` returns the UTF-8 string for a safe path relative to `rootDir`.
- `loader.read(relativePath)` re-reads a file when its `mtimeMs` changes without requiring process restart.
- `loader.validate(relativePath)` returns `{ ok: true, path }` or `{ ok: false, path, error }` without exposing absolute paths to clients.
- `loader.clear()` clears only the loader cache.

- [ ] **Step 1: Write the failing tests**

  Add tests that create a temporary directory and assert:

  ```js
  test('reads UTF-8 Markdown content from the configured root', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orpheus-files-'));
    fs.mkdirSync(path.join(rootDir, 'public'));
    fs.writeFileSync(path.join(rootDir, 'public', 'notice.md'), '第一版內容', 'utf8');

    const loader = createFileLoader({ rootDir });

    assert.equal(loader.read('public/notice.md'), '第一版內容');
  });

  test('reloads changed content without recreating the loader', async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orpheus-files-'));
    const file = path.join(rootDir, 'notice.md');
    fs.writeFileSync(file, '第一版內容', 'utf8');
    const loader = createFileLoader({ rootDir });

    assert.equal(loader.read('notice.md'), '第一版內容');
    await new Promise(resolve => setTimeout(resolve, 10));
    fs.writeFileSync(file, '第二版內容', 'utf8');

    assert.equal(loader.read('notice.md'), '第二版內容');
  });

  test('rejects traversal and absolute paths', () => {
    const loader = createFileLoader({ rootDir: fs.mkdtempSync(path.join(os.tmpdir(), 'orpheus-files-')) });
    assert.throws(() => loader.read('../secret.md'), /invalid content path/i);
    assert.throws(() => loader.read('C:\\secret.md'), /invalid content path/i);
  });
  ```

- [ ] **Step 2: Run the focused tests and verify the expected red state**

  Run: `node --test test/unit/fileLoader.test.js`

  Expected: FAIL because `game/content/fileLoader.js` and `createFileLoader` do not exist.

- [ ] **Step 3: Implement the minimal loader**

  Use `path.posix` normalization for authored relative paths, resolve against `rootDir`, reject absolute paths, reject `..` segments, read with `fs.readFileSync(filePath, 'utf8')`, and cache `{ mtimeMs, text }` by relative path. If the stat or read fails, throw an error containing the entry path but not any client-facing response data.

- [ ] **Step 4: Run the focused tests and verify green**

  Run: `node --test test/unit/fileLoader.test.js`

- [ ] **Step 5: Commit**

  ```sh
  git add game/content/fileLoader.js test/unit/fileLoader.test.js
  git commit -m "feat: add reloadable story file loader"
  ```

### Task 2: Connect authored terminal entries to local files

**Files:**

- Modify: `game/content/terminalEntries.js`
- Modify: `game/terminalEngine.js`
- Modify: `game/content/contentSchema.js`
- Modify: `game/content/validateContent.js`
- Create: `test/unit/fileBackedEntries.test.js`

**Interfaces:**

- `entry(..., { contentFile: 'public/intake_notice.md' })` exposes a lazy `text` property backed by the shared loader.
- `getAuthoredEntries()` returns the current authored entry list with fresh file text.
- Existing callers that read `entry.text`, `projectWorkstation()`, `executeTerminalCommand()`, archive extraction, and content validation continue to work.

- [ ] **Step 1: Write the failing integration tests**

  Add tests proving an entry with `contentFile` displays the file body, a changed file is visible on the next `projectWorkstation()` call, and a role-private file never appears in the other role's projection. Use a temporary content root through the loader configuration rather than changing production files during the test.

- [ ] **Step 2: Run the focused tests and verify red**

  Run: `node --test test/unit/fileBackedEntries.test.js`

  Expected: FAIL because entries do not accept `contentFile` and the terminal engine has no file-backed entry source.

- [ ] **Step 3: Implement the adapter without changing the public projection shape**

  Add `contentFile` metadata to the entry factory. Define the `text` getter against the loader so existing terminal and validator code remains compatible. Update archive-only authored entries through the same helper. Keep legacy inline text support only for entries not yet migrated during the transition; no browser route reads filesystem paths.

- [ ] **Step 4: Update validation**

  Validate every `contentFile` path exists, is under the configured content root, and is unique to one authored entry unless an explicit shared source is declared. Include the entry ID and relative path in errors.

- [ ] **Step 5: Run focused and existing terminal tests**

  Run: `node --test test/unit/fileBackedEntries.test.js test/unit/terminalEngine.test.js test/unit/contentValidation.test.js`

- [ ] **Step 6: Commit**

  ```sh
  git add game/content/terminalEntries.js game/terminalEngine.js game/content/contentSchema.js game/content/validateContent.js test/unit/fileBackedEntries.test.js
  git commit -m "feat: load terminal documents from local files"
  ```

### Task 3: Migrate visible FILE and archive content

**Files:**

- Create: `game/content/files/public/*.md`
- Create: `game/content/files/case/*.md`
- Create: `game/content/files/reports/*.md`
- Create: `game/content/files/logs/*.md`
- Create: `game/content/files/private-a/*.md`
- Create: `game/content/files/private-b/*.md`
- Modify: `game/content/terminalEntries.js`
- Modify: `game/terminalEngine.js`

- [ ] **Step 1: Add the first story batch as editable files**

  Create Markdown files for `doc.public_intake_notice`, `doc.public_release_condition`, `doc.deployment_candidate_notice`, `echo.initial_escape_assistance`, `doc.a_survival_task_01`, and `doc.b_survival_task_01` using the approved drafts in `docs/superpowers/specs/2026-09-17-orpheus-echo-document-drafts.md`.

- [ ] **Step 2: Externalize the existing visible records**

  Move the current visible text for `files.readme`, `files.mainline`, the six answer gates, archive descriptions, incident reports, assignment records, protocol records, audit logs, and current private operation notices into named Markdown files. Preserve every existing entry ID, filename, audience, unlock predicate, verification entry, deception ID, archive ID, and mainline fallback.

- [ ] **Step 3: Add the next narrative batch**

  Add local files for the second A/B secret task, the contradictory incident reports, and ECHO intervention Logs. The second task must keep the deployment hope visible while raising the cost of non-compliance. The reports must conflict in a way that can be checked against raw audio and independent timestamps. The Logs must show ECHO access, file injection, or rule override through evidence rather than a villain monologue.

- [ ] **Step 4: Run content validation**

  Run: `npm run validate:content`

  Expected: every authored entry resolves to an existing file, all deception records retain independent verification, and all private missions retain a mainline fallback.

- [ ] **Step 5: Commit the content pack**

  ```sh
  git add game/content/files game/content/terminalEntries.js game/terminalEngine.js
  git commit -m "content: externalize ORPHEUS FILE records"
  ```

### Task 4: Verify live editing and server-safe delivery

**Files:**

- Modify: `test/integration/chatAndPolling.test.js` or the closest workstation route test
- Modify: `test/e2e/workstationExploration.spec.js`
- Modify: `scripts/validate-content.js` only if the validator entry point needs the file root

- [ ] **Step 1: Add the live-edit regression test**

  Start one room, project a public FILE, edit its Markdown body on disk, request the workstation projection again without restarting the process, and assert the new body appears. Use a test fixture or temporary content root and restore it in `finally`.

- [ ] **Step 2: Add the secrecy regression test**

  Assert that A's private Markdown body is absent from B's JSON projection and from the HTML rendered for B, while A receives it after its unlock predicate becomes true.

- [ ] **Step 3: Add the file validation regression test**

  Remove or rename a referenced file in a temporary content root and assert validation reports the entry ID and relative path rather than silently falling back to stale content.

- [ ] **Step 4: Run the complete verification set**

  Run: `npm run check`

  Then run: `npx playwright test test/e2e/workstationExploration.spec.js test/e2e/privateNarrative.spec.js`

- [ ] **Step 5: Commit verification coverage**

  ```sh
  git add test/integration test/e2e scripts/validate-content.js
  git commit -m "test: verify live story content reload and secrecy"
  ```

## Completion Checks

- [ ] Editing an existing `game/content/files/**/*.md` file changes the next FILE projection without restarting Node.
- [ ] No local story file is reachable through the static `public` directory.
- [ ] A/B private documents remain absent from the other role's state and HTML.
- [ ] `npm run validate:content` rejects missing content files and broken verification links.
- [ ] The first and second narrative batches are present as editable files.
- [ ] Existing mainline, archive, private mission, and ending tests pass.
- [ ] `npm run check` passes before claiming completion.
