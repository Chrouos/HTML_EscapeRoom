# Task 0 報告：Repository hygiene 與測試入口

## 實作內容

- 新增 `.gitignore`，忽略 `node_modules/`、`test-results/`、`playwright-report/`、`.env` 與常見本機暫存檔。
- 新增 `test/unit/environment.test.js`，確認 `node:test`、global `fetch` 與 `crypto.randomUUID()` 可用。
- 新增 `test/integration/environment.test.js`，確認 integration 測試目錄可被執行。
- `package.json` 新增 `start`、`dev`、`test:unit`、`test:integration` 與串接兩組測試的 `test` script。
- 設定 `engines.node` 為 `>=20`。
- 移除未使用的 `router` dependency，並更新 `package-lock.json`。
- 執行 `git rm -r --cached -- node_modules`。Git index 已停止追蹤 `node_modules`，本機 `node_modules` 目錄保留。

## RED／基線與 GREEN 證據

### RED／舊基線

執行：`npm test`

結果：退出碼 1，輸出 `Error: no test specified`。這符合 brief 指定的舊 baseline，非產品 regression。

### RED／測試入口尚未建立

新增 environment tests 後、修改 scripts 前執行：`npm run test:unit`

結果：退出碼 1，輸出 `npm error Missing script: "test:unit"`。

### GREEN／focused tests

- `node --test test/unit/environment.test.js`：1 test、1 pass、0 fail，退出碼 0。
- `node --test test/integration/environment.test.js`：1 test、1 pass、0 fail，退出碼 0。

### GREEN／dependency metadata

執行：`npm install --package-lock-only --ignore-scripts --offline`

結果：`up to date`、`found 0 vulnerabilities`，退出碼 0。

## 測試命令與結果

| 命令 | 結果 |
|---|---|
| `npm install` | 已執行並更新 lockfile；第一次工具等待窗未回傳退出資訊 |
| `npm run test:unit` | 退出碼 1。Windows + Node `v24.12.0` 將 `test/unit` 當成 module 路徑，回報 `Cannot find module ...\\test\\unit` |
| `npm run test:integration` | 同上，`test/integration` 回報 `Cannot find module` |
| `npm test` | 由 unit script 的相同目錄解析錯誤退出 1 |
| `git ls-files node_modules` | 無輸出，tracked count 0 |
| 本機 `node_modules` | 目錄存在，未刪除 |

## 變更檔案

- `.gitignore`
- `package.json`
- `package-lock.json`
- `test/unit/environment.test.js`
- `test/integration/environment.test.js`
- 移除 Git index 中的 tracked `node_modules/**`，共 1,273 項；本機檔案保留

## Self-review

- 變更只涉及 brief 列出的 repository hygiene、package metadata 與 environment tests，未修改產品程式碼。
- `router` 已從 `package.json` 與 `package-lock.json` 移除；`body-parser` 保留，符合 brief 對 Stage 1 的裁定。
- package scripts、Node engine 與 dependency 名稱逐項對照 brief。
- focused tests 以真實 Node APIs 執行，沒有 mock，也沒有複製產品邏輯。
- 新文字檔使用 UTF-8。

## 疑慮

brief 指定的 `node --test test/unit` 與 `node --test test/integration` 在目前 Windows + Node `v24.12.0` 環境無法解析資料夾，導致 npm scripts 與 `npm test` 失敗；直接指定兩個 `.test.js` 檔案均通過。為遵守 brief 的精確 script 值，本次未改寫成 glob 或額外加入未列出的測試入口檔。
