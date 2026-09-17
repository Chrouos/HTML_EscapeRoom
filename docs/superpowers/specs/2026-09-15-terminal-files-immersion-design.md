# Terminal 指令與 Files 探索沉浸感設計

## 目標

讓玩家透過 Files 探索文件、透過 Terminal 下達故事指令，並由 ORPHEUS 把提示與玩家提交的線索轉成雙方可見的對講公告；答案提交只在解鎖指定文件後出現。

## 玩家體驗

- Operations 螢幕以 Files、Terminal、Logs 為主要入口，不再顯示醒目的「你的線索」標題或常駐答案表單。
- Files 顯示階層資料夾、檔名、權限與鎖定狀態。鎖定檔案可見檔名與基本 metadata，但內容與答案表單不可見。
- 部分檔案是壓縮檔或損壞封存檔。玩家可透過 Files 的解壓操作或 Terminal 指令嘗試處理；成功後才展開新的資料夾、checksum、時間戳或碎片文件。
- Terminal 是真正可輸入的命令列，具備 prompt、游標、輸入回顯與指令結果。
- `HELP` 顯示目前章節允許的指令與格式；`HINT` 觸發 ORPHEUS 對兩名玩家的公開提示。其他合法指令依故事節點執行，例如搜尋節點、檢查檔案或送出線索。
- 玩家輸入的線索不直接顯示為「你的線索」，而是由伺服器產生一則 ORPHEUS 公開公告，兩名玩家都能在 Intercom 看見。
- 答案表單只在玩家於 Files 開啟目前章節的答案文件後由該文件內容提供；未解鎖、未開啟或另一方的私人文件不會產生表單。

## 伺服器與資料流

1. Browser 將 Terminal 指令送到既有 authenticated action route，帶有 fresh action ID 與玩家身份。
2. Game engine 驗證指令、章節、角色與檔案狀態；未知或未解鎖指令只回傳不具劇情副作用的錯誤結果。
3. `HINT` 與 clue 指令透過既有 story event dispatcher 產生 `ORPHEUS`、`both` audience 的事件；不在可見文字中暴露 audience/channel 欄位。
4. 開啟答案文件只產生 actor-scoped workstation state；解鎖表單不寫入另一方 projection。
5. 所有提交仍使用既有 mainline operation / puzzle answer contract，且不能因私人探索失敗而阻塞共同主線。

## 指令契約

- `HELP`：列出目前可用指令與一個故事內範例。
- `HINT`：取得一則不直接揭露答案的 ORPHEUS 公告；同一 action ID 重送不得重複公告。
- `SEARCH <node>`：搜尋已存在的節點或檔案索引，成功時只揭露該玩家可見結果。
- `SCAN <filename>`：檢查已知檔案的鎖定／完整性狀態；不繞過權限。
- `UNZIP <filename>`：嘗試解壓已知壓縮檔；只有符合目前章節條件時才產生新檔案節點，失敗時回傳不暴露答案的錯誤。
- `SEND <text>`：將玩家線索交給 ORPHEUS，轉成兩人可見公告；輸入需限長並做安全文字處理。

## 錯誤與安全

- 指令名稱、參數、長度與玩家身份均由伺服器驗證；前端不負責權限判定。
- 私人 Files 與事件維持既有 actor projection 隔離，不得出現 placeholder、cursor gap、unread、timing 或 DOM 痕跡。
- `HINT` 不得回傳可直接當作答案的 canonical answer；提示內容必須來自目前可達章節內容。
- `prefers-reduced-motion` 下 Terminal 游標、輸入回顯與公告仍可讀，但不依賴動畫才能操作。

## 驗收

- Terminal 可以輸入、送出、顯示結果，重新整理後保留必要的公開公告。
- `HINT` 與 `SEND` 會由 ORPHEUS 同步公告給 A/B，且不顯示傳遞 metadata。
- Files 可逐層開啟；上鎖答案文件未解鎖前不存在答案表單，解鎖後只在正確玩家的工作站出現。
- `SEARCH`／`SCAN` 不可繞過檔案權限；私人檔案與事件不會出現在另一方 REST、WebSocket、DOM。
- `UNZIP` 只會展開伺服器定義的安全檔案清單，不接受路徑穿越、任意檔案名或客戶端提供的壓縮內容；重複解壓必須冪等。
- 既有主線、結局、手機可操作性與 reduced-motion 測試維持通過。
