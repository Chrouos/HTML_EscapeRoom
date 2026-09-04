# Escape Room v2 實作計畫

## 目標與範圍

在 `new_open` branch 上，把舊版雙人密室更新成可實際遊玩的 v2：保留 Express、EJS、原生 JavaScript、房號、A/B 分工與聊天室，加入 6 個主線謎題、4 個隱藏支線、3 種結局、AI 操控玩家的主線，以及完整的研究所終端機視覺。

一般主線目標遊玩時間為 30–45 分鐘；完成全部支線為 45–60 分鐘。房間狀態先維持記憶體儲存，server restart 後不保留。

最小 coherent slice 是：建立房間、第二位玩家加入、server 綁定 A/B token、兩個 browser 看到各自線索、聊天室同步、共同完成主線謎題 1。完成這個 slice 後，才大量加入其餘謎題與視覺內容。

## 技術基線

- Runtime：本機 Node `v24.12.0`，專案使用 CommonJS。
- Server：Express `4.17.2`、EJS `3.1.6`、Morgan；`app.js` 目前直接啟動 HTTP server，無法獨立測試 app。
- State：所有房間、聊天與玩家資料目前混在 `app.locals.entries`。
- API：`apiroutes.js` 與 `EscapeRoom_Controller.js` 會讀寫全域 entries，沒有房間或角色隔離。
- Views：`views/A.ejs`、`views/B.ejs` 各自包含謎題答案、inline script、inline style 與 `alert`。
- Client：`public/enter2.js` 依賴 jQuery 2.1.1，每 100ms 抓回全部 entries，沒有 revision、retry backoff 或 action 去重。
- CSS：`public/css/styles.css` 是 Bootstrap/Grayscale bundle 加少量專案樣式；`.toppart`、`.bottompart` 使用 absolute/relative positioning，不適合新 layout。
- Tests：`npm test` 固定失敗，專案沒有自有 automated tests。
- Repository：沒有 `.gitignore`；`node_modules` 有 1,273 個 tracked files。
- Encoding：多個舊版繁體中文字串已呈現亂碼；新版文案與 source file 必須統一 UTF-8。

## 執行與審查方式

Sol/medium 主控負責需求、架構、stage 邊界、整合、驗證與最終決策。每個可分離 stage 優先交給 `luna_high` 執行；一次只給明確 write scope。Luna-high 回傳後，主控必須檢查 diff、執行該 stage 的 verification command，再決定是否進入下一階段。

寫入範圍重疊時不得平行派工。視覺與 server state 可以在介面契約固定後分開工作，但最後由主控完成整合驗證。

## Task 0：Repository hygiene 與測試入口

### Test-first／驗證基線

先執行目前的 `npm test`，記錄它因預設失敗 script 而失敗；這是舊基線，不視為產品 regression。

### 修改檔案

- 新增 `.gitignore`
- 新增 `test/unit/environment.test.js`
- 新增 `test/integration/environment.test.js`
- 修改 `package.json`
- 更新 `package-lock.json`
- 將 tracked `node_modules/**` 從 Git index 移除，但不刪除本機安裝目錄

### 實作內容

1. `.gitignore` 加入 `node_modules/`、`test-results/`、`playwright-report/`、`.env` 與常見本機暫存檔。
2. 執行 `git rm -r --cached -- node_modules`，只停止追蹤 dependency artifacts。
3. `package.json` 新增：
   - `start`: `node server.js`
   - `dev`: `nodemon server.js`
   - `test:unit`: `node --test test/unit`
   - `test:integration`: `node --test test/integration`
   - `test`: unit 後接 integration
4. 設定 `engines.node` 為 `>=20`，確保 `node:test`、global `fetch` 與 `crypto.randomUUID()` 可用。
5. 移除未使用的 `router` package；`body-parser` 等到 Stage 1 改用 Express built-in parser 後移除。
6. `environment.test.js` 只確認 test runner、必要 Node APIs 與目錄分組能執行；不複製產品邏輯。

### 驗證

```powershell
npm install
npm run test:unit
npm run test:integration
git ls-files node_modules
```

兩個 environment test 在本 stage 建立測試基線；`git ls-files node_modules` 必須沒有輸出。

## Task 1：建立可測試的 Express app seam

### Test-first

新增 `test/integration/app.test.js`，先驗證：

- `GET /` 回傳 `200` 與 UTF-8 HTML。
- 不存在的頁面回傳 `404`，且只送出一次 response。
- JSON route 的未知端點回傳一致 JSON error shape。

測試使用 Node `http.createServer(app)` 綁定 ephemeral port，再以 global `fetch` 呼叫，不加入 Supertest。

### 新增檔案

- `server.js`
- `routes/pageRoutes.js`
- `middleware/errorHandler.js`
- `test/helpers/testServer.js`
- `test/integration/app.test.js`

### 修改檔案

- `app.js`
- `package.json`
- `package-lock.json`

### 實作內容

1. `app.js` 建立並 export Express app；被 tests import 時不 listen。使用者直接執行 `node app.js` 時則呼叫 `server.js` 的 `startServer(app)`，保留舊 README 的啟動相容性。
2. `server.js` export `startServer(app)`，負責 `http.createServer(app)`、讀取 `PORT`（預設 `3000`）與啟動 log；直接執行 `node server.js` 也能啟動。
3. 使用 `express.json()`、`express.urlencoded({ extended: false })`，移除 `body-parser` dependency。
4. 集中 static path、view engine、Morgan、page routes、API routes、404 與 error middleware 的順序。
5. `errorHandler` 對 HTML 與 JSON request 回傳一致狀態碼；每個 handler 只允許一次 `send`、`json`、`render` 或 `redirect`。
6. 暫時保留舊 routes，直到新 room lifecycle 通過測試，避免 Stage 1 就破壞可啟動性。

### 重要介面

```js
const app = require('./app');
module.exports = app;
```

`testServer(app)` 回傳 `{ baseUrl, close }`，所有 integration tests 必須在 `after` 關閉 server。

### 驗證

```powershell
node --test test/integration/app.test.js
npm start
```

手動確認 `http://localhost:3000/` 與未知路徑都只有一個 response。

## Task 2：RoomStore、角色 token 與倒數狀態

### Test-first

新增 `test/unit/roomStore.test.js`，先覆蓋：

- 產生唯一的六位數 room code。
- 建立者取得 A 與不重複的 join token。
- 第二位玩家取得 B；第三次加入回傳 `ROOM_FULL`。
- join token 才能解析出角色；client 自稱 A/B 沒有效力。
- 兩人加入後才建立 `countdownStartedAt`。
- refresh/reload 能用同一 token 取得相同 role 與 room state。
- revision 單調遞增；同一 action ID 只能處理一次。
- 過期或不存在的 room 有可辨識結果。

### 新增檔案

- `game/roomStore.js`
- `game/createRoomState.js`
- `game/roomErrors.js`
- `test/unit/roomStore.test.js`

### 實作內容

1. `createRoomState()` 建立 plain object：`roomCode`、`createdAt`、`players`、`chapter`、`mainProgress`、`sideEvidence`、`attempts`、`hints`、`messages`、`pendingChoices`、`countdownStartedAt`、`ending`、`processedActionIds`、`revision`。
2. `roomStore` 封裝 `Map`，公開 `createRoom()`、`joinRoom()`、`getRoom()`、`resolvePlayer()`、`updateRoom()`、`hasProcessedAction()`。
3. 使用 `node:crypto` 產生 room code 與 opaque join token，不使用前端時間或 `Math.random()`。
4. 每次有效 mutation 都由 store 統一增加 revision。
5. 倒數歸零只改變 derived status，不刪除進度或鎖住 ending。

### 驗證

```powershell
node --test test/unit/roomStore.test.js
```

## Task 3：建立／加入／恢復房間的 vertical slice

### Test-first

新增 `test/integration/roomRoutes.test.js`，先驗證：

- `POST /rooms` 建立 room、設定 A token cookie、redirect 到 room。
- `POST /rooms/join` 讓第二個 cookie jar 取得 B。
- 無 token、錯 token、滿房、錯誤 code 分別得到穩定 response。
- legacy `/createRoom`、`/inputRoomNo`、`/v2/:roomCode` 只能導向新流程，不能透過 `/A` 或 `/B` 自選角色。
- `GET /api/rooms/:roomCode/state` 只回傳該 token 可見的 safe state。

### 新增檔案

- `routes/roomRoutes.js`
- `routes/apiRoutes.js`
- `game/safeState.js`
- `utils/cookies.js`
- `views/waitingRoom.ejs`
- `test/helpers/cookieJar.js`
- `test/unit/safeState.test.js`
- `test/integration/roomRoutes.test.js`

### 修改檔案

- `app.js`
- `routes/pageRoutes.js`
- `views/index.ejs`
- `views/404.ejs`

### 實作內容

1. 建立者固定為 A，第二位加入者固定為 B。
2. Server 以每個 room code 獨立命名的 HttpOnly、SameSite=Lax cookie 保存 room token；API 只接受 token，不接受 client role 欄位。本機 HTTP 不設 `Secure`，未來 HTTPS deployment 才開啟。
3. `GET /rooms/:roomCode` 依 token render waiting room 或 game shell。
4. 定義 JSON error shape：`{ success: false, code, message }`。
5. 固定狀態碼：輸入錯誤 `400`、room 不存在 `404`、room full/token conflict `409`、未解鎖 action `423`。
6. safe state 只包含當前角色可見 clues、公開 progress、messages、evidence summary、countdown status 與 revision。
7. `cookieJar` test helper 保存各 browser session 的 `Set-Cookie`，因 Node global `fetch` 不會自動維護 cookie jar。
8. `safeState.forPlayer(room, player)` 是唯一把 server room 轉成 API/view payload 的入口；unit test 明確證明 answers、未發現 evidence 與另一角色 private clues 不會外洩。

### 驗證

```powershell
node --test test/unit/safeState.test.js
node --test test/integration/roomRoutes.test.js
```

手動用一般視窗與無痕視窗建立／加入同一房間，refresh 後兩邊角色不可互換。

## Task 4：GameEngine 契約與主線謎題 1

### Test-first

新增 `test/unit/gameEngine.test.js` 與 `test/integration/mainPuzzleOne.test.js`，先驗證：

- locked chapter 不能提前提交。
- A/B 各自只收到自己的 identity clue。
- startup sequence 需要兩邊資訊才能推導。
- harmless whitespace 與非刻意區分的大小寫會正規化。
- 錯誤嘗試只增加對應 step 的 attempt；達門檻後逐級解鎖 hint。
- 正確提交只前進一次並建立 story/chat events。
- duplicate `actionId` 不會重複前進或重複訊息。

### 新增檔案

- `game/gameEngine.js`
- `game/storyEngine.js`
- `game/content/mainPuzzles.js`
- `game/content/story.js`
- `game/answerUtils.js`
- `test/unit/gameEngine.test.js`
- `test/integration/mainPuzzleOne.test.js`

### 修改檔案

- `game/createRoomState.js`
- `routes/apiRoutes.js`

### 實作內容

1. 定義 action contract：`{ actionId, puzzleId, stepId, value }`。
2. `gameEngine.submitAction(room, player, action)` 回傳 `{ stateChanged, events, publicResult }`，不直接操作 Express response。
3. `mainPuzzles.js` 保存 server-only answers、step 順序、unlock 條件、role clues 與 hint thresholds。
4. `storyEngine` 將 domain events 轉成 typed messages：`player`、`system`、`story`、`clue`、`error`。
5. 完成 Main 1 後 chapter 才能前進到 emergency power。

### 驗證

```powershell
node --test test/unit/gameEngine.test.js
node --test test/integration/mainPuzzleOne.test.js
```

此 stage 結束時，必須能以兩個 browser 完成第一個合作謎題；這是後續內容擴充的 architecture gate。

## Task 5：完成六個主線謎題與主線聊天室故事

### Test-first

在 `test/unit/mainPuzzles.test.js` 為 Main 2–6 逐題先寫 failing cases。每題至少驗證：

- step 順序與 unlock 條件。
- A/B private clue 不洩漏。
- 正確答案、可接受的正規化、錯誤答案與 progressive hint。
- 成功後產生正確 story event 與下一題狀態。
- AI 的錯誤指示不會造成 permanent fail state。

### 新增檔案

- `test/unit/mainPuzzles.test.js`
- `public/audio/emergency-morse.wav`（沿用並整理舊音訊）

### 修改檔案

- `game/content/mainPuzzles.js`
- `game/content/story.js`
- `game/gameEngine.js`
- `game/storyEngine.js`
- `routes/apiRoutes.js`

### 實作內容

1. Main 2：摩斯解碼後再完成 circuit routing；提供文字 transcript/visual path。
2. Main 3：重建 sample timeline，主解答推進，細查矛盾則只開啟 Side 1 hook。
3. Main 4：credential reconstruction 與 authorization choice 都能推進；記錄 compliance choice。
4. Main 5：archive fragments、missing text、edit proof 三步完成後確認 AI 竄改紀錄。
5. Main 6：只在前五題完成後開啟；本 stage 建立兩位玩家 final confirmation 與 decision gate，不接受單人直接結算。三種 ending 判定在 Stage 6 接上。
6. 完整撰寫自然台灣繁體中文聊天室主線；AI 保持冷靜正式，玩家吐槽不破壞懸疑。
7. 所有答案與 unrevealed content 留在 server-side content modules。

### 驗證

```powershell
node --test test/unit/mainPuzzles.test.js
npm run test:integration
```

手動完成一次不碰支線的主線，確認可在 30–45 分鐘內抵達結局選擇。

## Task 6：四個隱藏支線與三種結局

### Test-first

新增 `test/unit/sidePuzzles.test.js`、`test/unit/endingEngine.test.js`，先驗證：

- 每個支線只能由可見矛盾或互動 hook 開啟，不依賴 DOM 隱藏字串或 DevTools。
- evidence 重複提交仍只記錄一次。
- 0–1 evidence 只能走 Compliance。
- 至少 2 evidence 且雙方確認可走 Resistance。
- 4 evidence 且雙方確認 hidden protocol 才能走 Truth。
- A/B 選擇衝突時維持 pending，不自動選邊，也不永久鎖死。

### 新增檔案

- `game/endingEngine.js`
- `game/content/sidePuzzles.js`
- `game/content/endings.js`
- `test/unit/sidePuzzles.test.js`
- `test/unit/endingEngine.test.js`

### 修改檔案

- `game/gameEngine.js`
- `game/storyEngine.js`
- `game/content/story.js`
- `routes/apiRoutes.js`

### 實作內容

1. Side 1：比對監控 timestamp，證明影片來自不同日期。
2. Side 2：從可見的系統訊息 pattern 還原研究員警告。
3. Side 3：以音訊 transcript 與 terminal metadata 還原 AI 刪除訊息。
4. Side 4：交叉比對 identity 與 archive，揭露受試者關係。
5. Evidence 以 stable ID 儲存；聊天可依已發現 evidence 改變 AI 回覆。
6. `endingEngine.evaluate(room)` 只做 deterministic 判定；ending 文案由 `endings.js` 提供。

### 驗證

```powershell
node --test test/unit/sidePuzzles.test.js test/unit/endingEngine.test.js
npm run test:integration
```

## Task 7：聊天室、revision polling 與 browser client

### Test-first

新增 `test/integration/chatAndPolling.test.js`，先驗證：

- `POST /api/rooms/:roomCode/chat` 只接受已綁定玩家。
- `GET .../state?sinceRevision=N` 在沒有更新時回傳 compact unchanged result。
- 新訊息依 server sequence 排序。
- duplicate action/chat request 不會建立兩份內容。
- 暫時斷線後以舊 revision 重連能補齊缺少事件。

### 新增檔案

- `public/js/lobby.js`
- `public/js/game.js`
- `test/integration/chatAndPolling.test.js`

### 修改檔案

- `routes/apiRoutes.js`
- `views/index.ejs`
- `views/waitingRoom.ejs`

### 實作內容

1. 移除 jQuery client path，改用 `fetch` 與 DOM APIs。
2. Client 以目前 revision 查詢更新；正常 polling 間隔約 1–1.5 秒。
3. 失敗後採 capped backoff，顯示 reconnecting 狀態；成功後恢復正常頻率。
4. 送出 action 使用 `crypto.randomUUID()`；pending request 時避免重複按鈕提交。
5. Chat submit 失敗時保留輸入文字；成功後才清空。
6. New message 自動捲動只在使用者原本位於底部時發生，避免閱讀舊訊息被強制拉走。

### 驗證

```powershell
node --test test/integration/chatAndPolling.test.js
```

手動關閉其中一個 browser 的 network，恢復後確認訊息、進度與輸入沒有重複或遺失。

## Task 8：EJS 元件化與研究所終端機視覺

### Test-first／視覺驗收先行

新增 Playwright 測試，先鎖定必要 DOM roles 與 layout 行為，而不是鎖死每個 pixel：

- Lobby 能建立與加入房間。
- Game page 有 status、chat、puzzle action、evidence 四個區域。
- Keyboard 可完成表單與 puzzle submit。
- Mobile viewport 不產生水平 overflow。
- `prefers-reduced-motion` 下 alarm 不閃爍。
- A/B 標示除了顏色外也有文字。

### 新增檔案

- `views/game.ejs`
- `views/partials/head.ejs`
- `views/partials/statusBar.ejs`
- `views/partials/chatPanel.ejs`
- `views/partials/puzzlePanel.ejs`
- `views/partials/evidencePanel.ejs`
- `views/partials/endingPanel.ejs`
- `views/partials/footer.ejs`
- `playwright.config.js`
- `test/e2e/roomFlow.spec.js`
- `test/e2e/accessibilityAndLayout.spec.js`

### 修改檔案

- `views/index.ejs`
- `views/waitingRoom.ejs`
- `views/404.ejs`
- `public/css/styles.css`
- `public/js/lobby.js`
- `public/js/game.js`
- `routes/roomRoutes.js`
- `package.json`
- `package-lock.json`

### 實作內容

1. 以 EJS partial 組成單一 `game.ejs`，A/B 差異全部來自 server-filtered safe state，不再維護兩份頁面。
2. 重寫 `styles.css` 為專案設計系統：near-black/desaturated blue surface、cyan/green normal、amber suspicious、red alarm、A/B role tokens、spacing、type scale、focus ring 與 responsive breakpoints。
3. Desktop 採 chat 主欄＋evidence/action 輔欄；mobile 依序 stack status、chat、action、evidence。
4. 使用 semantic `<button>`、visible `<label>`、清楚 heading hierarchy 與 visible focus。
5. Chat timeline 使用適當 `aria-live`，但避免每次 polling 重念全部歷史訊息。
6. Success、error、hint、AI interference 全部顯示為 typed timeline event，不使用 browser `alert`。
7. 45 分鐘歸零只切換 emergency visual state 與 AI 對話；不清除進度。
8. `prefers-reduced-motion` 關閉 scanline motion、flash 與非必要 transition。
9. 使用 system/monospace font stack，移除 Font Awesome、Google Fonts 與 jQuery CDN 依賴，使本機斷網仍能遊玩。
10. 加入 `@playwright/test` dev dependency，以及 `test:e2e`、`check` scripts；執行 `npx playwright install chromium` 安裝測試 browser。

### 驗證

```powershell
npx playwright install chromium
npm run test:e2e -- test/e2e/accessibilityAndLayout.spec.js
```

額外以 1440×900、768×1024、390×844 三種 viewport 手動查看 lobby、waiting、game、evidence、alarm、三種 ending 狀態。

## Task 9：完整雙人 E2E、legacy 移除與最後驗收

### Test-first

擴充 `test/e2e/roomFlow.spec.js`，用兩個獨立 browser context 代表 A/B，覆蓋：

- 建立、加入、refresh recovery。
- 六個主線的完整通關。
- 四個支線與 Truth ending。
- 只完成兩個支線的 Resistance ending。
- 不完成支線的 Compliance ending。
- A/B final choice conflict 與重新確認。
- 倒數歸零後仍能完成遊戲。

### 移除 legacy 檔案

確認新 routes 與 E2E 通過後，刪除：

- `EscapeRoom_Controller.js`
- `apiroutes.js`
- `v2routes.js`
- `public/enter2.js`
- `views/A.ejs`
- `views/B.ejs`
- `views/createRoom.ejs`
- `views/createRoom2.ejs`
- `views/enterRoom.ejs`
- `views/enterRoom2.ejs`
- `views/inputRoomNo.ejs`
- `views/test.ejs`
- `views/header.ejs`
- `views/footer.ejs`
- `views/js/scripts.js`

保留 `answer.txt`、`雙人密室逃脫完整版解答.mkv` 與未使用舊素材，除非另行確認要整理歷史內容；它們不會由 Express static route 對外提供。

### 修改檔案

- `README.md`
- `package.json`
- `package-lock.json`
- `app.js`
- `test/e2e/roomFlow.spec.js`

### 實作內容

1. 移除 legacy route imports、dead dependency 與註解掉的大段舊程式。
2. README 以繁體中文說明安裝、啟動、雙人測試方式、記憶體 room 限制與測試 commands。
3. 確認所有新版 source 與文案為 UTF-8，browser 不顯示亂碼。
4. 執行完整測試後，才移除不再使用的 production dependency。

### 驗證

```powershell
npm run check
git diff --check
git status --short
```

手動 acceptance：

1. 兩個獨立 browser 完成 Main 1–6。
2. 分別觸發 Compliance、Resistance、Truth。
3. 驗證 temporary disconnect、refresh、duplicate submit 與 final choice conflict。
4. 驗證 keyboard、visible focus、live chat announcements、音訊替代路徑與 reduced motion。
5. 驗證 desktop/tablet/mobile layout 與台灣繁體中文。

## 整合點與相容限制

- Legacy URL 只提供安全 redirect；`/v2/:roomCode/A` 或 `/B` 不再代表身份。
- 舊 `{ roomNo, user, chatContent }` API 不保留寫入相容；`public/enter2.js` 與舊 API 必須在同一個 migration stage 停止引用，避免新舊 payload 混用。
- Join token 存在 HttpOnly cookie；失去 cookie 後不允許以 URL 搶回已占用角色。
- Server restart 清空 room；UI 必須明確回報，不假裝恢復。
- 開發中 restart 或新版 deploy 不遷移舊 `entries` 記憶體資料；所有玩家需建立新 room。
- Client 永遠不取得 server-only answers、未發現 evidence 或另一角色 private clues。
- `RoomStore` 是唯一 mutation 入口；routes、engine、story、ending 不直接各自改 revision。
- Main puzzle definitions、story text 與 ending text 分檔，但使用 plain objects/functions，不引入 class hierarchy。
- Playwright screenshot 只作人工 visual QA 輔助；功能測試以 role、label、state 與可見結果為主，避免脆弱 pixel snapshot。
- Legacy 相對素材路徑統一改為 `/public/...` 或新的明確 static mount；E2E 必須確認 CSS、圖片、音訊與 transcript route 都回傳成功。

## 本次不處理

- Database、跨 restart save、帳號與登入。
- Public matchmaking、觀戰者或三人以上房間。
- WebSocket/Socket.IO；revision polling 已足夠支援兩人遊戲。
- Runtime AI 生成劇情、語音聊天或 video chat。
- Production hosting、domain、analytics 與監控。
- 舊解答影片與歷史素材的重新剪輯或刪除。

## Follow-up deployment checks

若之後要部署，需另外規劃 shared persistence、multiple-process room consistency、HTTPS cookie、rate limiting、process health check 與 production static caching。這些不應混入目前的本機 playable v2。
