# 新手玩家沉浸感、謎題節奏與終端美術設計

日期：2026-09-16

## 背景

以第一次接觸遊戲、不了解密室逃脫慣例的玩家走過 lobby、建立房間、第二位玩家加入與第一個謎題。現有 CRT 研究終端風格已經成立，但新手需要自行猜測檔案探索路徑；連線後 A 端的倒數狀態也曾停留在「等待連線」。錯誤答案、階段解鎖與警報狀態缺少足夠的視覺回饋。

## 目標

- 讓兩端的連線與倒數狀態一致，玩家能立即知道房間已開始。
- 讓答錯、倒數逼近與步驟解鎖產生短暫而清楚的緊張回饋。
- 讓第一個謎題的探索入口與答案格式可理解，但不直接洩漏答案。
- 保留現有雙人資訊不對稱、CRT 終端語言、鍵盤操作與 responsive layout。
- 依照視覺草稿強化雙終端聯動、中央連線感、有限的 amber/red 警示與解鎖進度。

## 設計

### 沉浸感與狀態回饋

以既有 live snapshot 與 countdown 資料為單一來源。連線後兩端都呈現相同倒數，狀態列不再同時出現「等待連線」與「兩位玩家已就緒」。答錯時在 root 上短暫掛載錯誤狀態，提供邊框脈衝或輕微震動；`prefers-reduced-motion` 只保留色彩與文字回饋。倒數進入緊急狀態時提升紅色警示層次，解鎖步驟時提供短暫的 phosphor pulse。

### 謎題由簡到繁

在 puzzle panel 顯示目前章節、步驟與提示入口，並提供答案格式的非解答式說明，例如「請保留連字號」。workstation 根目錄在玩家尚未操作時顯示清楚的「先讀取啟動備忘錄，再開啟 CASE FILES」引導。已完成與鎖定檔案使用一致的狀態樣式，後續步驟逐步增加資訊密度，不改變伺服器正解或答案驗證。

### 美術方向

以草稿圖 `C:/Users/7157/.codex/generated_images/01a0a7d7-e55b-7480-9d99-e75be108764f/exec-a410f168-eaab-4649-8d0b-ad115e976220.png` 作為參考，不把 raster 圖直接當整頁背景。使用現有 CSS 形狀、漸層、scanline 與狀態色，增加雙終端對稱、中央連線裝置、解鎖進度與有限紅色警報區域，避免整體過亮或影響閱讀。

## 修改邊界

- 沉浸感：`public/js/live.js`、`public/js/game.js`、`game/eventDispatcher.js`、`game/roomStore.js`、`game/safeState.js`、`realtime/liveHub.js`、`public/css/puzzle-progress.css`
- 謎題流程：`public/js/workstation.js`、`views/partials/operationsMonitor.ejs`、`public/css/puzzle-progress.css`、`views/partials/head.ejs`
- 美術：`public/css/workstation.css`、`views/partials/intercomMonitor.ejs`
- 不改變 `game/content/mainPuzzles.js` 的正解，不新增 runtime dependency。Live event 只增加可選的 countdown payload，舊事件仍可被前端接受。

## 驗證

- 執行內容驗證、unit、integration 與 E2E 測試。
- 以 Chromium 檢查 lobby、連線後的 A/B 兩端、答錯、倒數警示、第一題探索與 mobile layout。
- 檢查 `prefers-reduced-motion`、鍵盤焦點、aria 狀態與既有測試沒有回歸。
