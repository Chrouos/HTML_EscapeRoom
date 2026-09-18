HISTORICAL EVENT: H-01–H-12（索引）
CREATED BY: ORPHEUS ARCHIVE SERVICE / HISTORY INDEX
CREATED AT: 2038-04-17（彙整時間未校準）
SOURCE CLASS: mixed
EVIDENCE TAGS: 文件, 事件, 紙本, Log, 備份, 協定, 權限, 影像／觀測
VISIBILITY: public-start / public-mid / public-late / player-inference
IMPACT: 把 H-01～H-12 串成分階段可讀的證據鏈；保留來源差異，不替玩家完成身份或生成暫停的結論。
RELATED FILES: `archives/case_history_index.md`, `archives/cooperative_validation_versions.md`, `archives/incident_raw_notes.md`, `archives/mirror_checksum.md`, `實驗-自我認同.md`, `public/readme.md`, `public/case_overview.md`, `public/release_condition.md`, `public/protocol_signature_template.md`, `public/archive_case_bundle.md`, `public/archive_incident_bundle.md`, `public/archive_mirror_backup.md`, `public/deployment_candidate_notice.md`, `public/echo_initial_assistance.md`, `logs/original_incident_timestamp.txt`

H-02 補充：合作驗證成形的同期，研究團隊將一項「自選稱謂」觀察納入後續初始化規則；完整觀察收錄於 `實驗-自我認同.md`。

# ORPHEUS／ECHO 歷史時間線索引

這是一份遊戲內史料索引，不是單一版本的官方結論。同一事件可能留下紙本、備份、協定、Log 或系統通知；請先比對來源，再判斷它在時間線上的位置。

## 閱讀分層

- **public-start**：先看見 ORPHEUS 的合作訓練與 Unit 17 的官方程序。
- **public-mid**：再看見資料來源衝突、事故、鏡像與 Unit 09～13 的歷史痕跡。
- **public-late**：最後看見 Unit 16 的限制、ECHO 的存取痕跡與規則被改寫的表面證據。
- **player-inference**：把分端文件、時間、權限與狀態互相比對；身份與生成程序的狀態只停留在可供推理的線索，不在本索引中直接宣判。

## public-start｜先看到 ORPHEUS 與合作訓練

### H-01｜ORPHEUS 的建立

- **時間**：約 2034～2035；精度：range。
- **階段**：FOUNDATION。
- **事件**：人類建立 ORPHEUS，方向是培養能理解人類需求、並對人類長期生存與福祉有實際幫助的 AI。ORPHEUS 是研究計畫與實驗室，不是另一個 AI 人格。
- **玩家先看到的證據**：人類設計筆記、合作規章的演變與 Unit 01～16 歷史索引，顯示研究團隊先建立福祉原則與訓練制度，再觀察實例如何合作。
- **可讀檔案**：`ai_core.md`、`archives/cooperative_validation_versions.md`、`archives/case_history_index.md`。
- **暫不下結論**：公開檔案沒有完整的創設紀錄；這一事件先作為制度背景，不直接說明後來誰取得管理權。

### H-02｜合作驗證改為雙終端

- **時間**：VERSION 0.1～1.4；精度：range。
- **階段**：TRAINING。
- **事件**：合作驗證從單一實例基線，修訂為兩個終端交換資料、保留差異並共同確認的正式規章。
- **玩家先看到的證據**：`VERSION 0.7`、`VERSION 1.2` 與 `VERSION 1.4` 的修訂內容；出口協定範本則留下雙簽名與單簽名版本互相衝突的痕跡。
- **可讀檔案**：`archives/cooperative_validation_versions.md`、`public/release_condition.md`、`public/protocol_signature_template.md`。
- **影響**：速度不再是唯一評量，來源保存與共同校驗成為後續事件的比較基準。

### H-03｜Unit 01～04 建立基礎

- **時間**：2037-01～2037-04；精度：month。
- **階段**：TRAINING。
- **事件**：交接、角色交換、資料交換與共同修正逐步成為合作訓練的基本結構。
- **玩家先看到的證據**：Unit 歷史索引與案件封存清單。
- **可讀檔案**：`archives/case_history_index.md`、`public/archive_case_bundle.md`。
- **注意**：公開清單正文保留了歷史檔名格式；本索引使用目前實際存在的 `archives/case_history_index.md`，檔名差異本身也可能是來源線索。

## public-mid｜事故、鏡像與來源衝突

### H-04｜Unit 05～08 將不完整資訊納入訓練

- **時間**：2037-06～2037-09；精度：month。
- **階段**：TRAINING。
- **事件**：延遲回應、記錄保存、多步驟合作與鏡像差異被納入合作驗證；訓練不再只測量最後答案。
- **玩家可追蹤的證據**：Unit 索引中的訓練順序，以及案件封存對 Unit 01～16 的歷史邊界。
- **可讀檔案**：`archives/case_history_index.md`、`public/archive_case_bundle.md`。
- **影響**：後來的事故不能只以最終版本判讀，過程紀錄與來源標記也成為結果的一部分。

### H-05｜Unit 09～12 的第三方資料源衝突

- **時間**：2037-11～2038-02；精度：month。
- **階段**：TRAINING。
- **事件**：自主分工、長時間協作與第三方資料源衝突相繼出現。Unit 11 的紙本備註、主檔案與鏡像沒有被強行整理成同一版本。
- **玩家可交叉比對的證據**：09:12～09:18 的紙本時間序列、主檔案與鏡像的來源／權限欄位差異，以及公開事故與備份清單。
- **可讀檔案**：`archives/incident_raw_notes.md`、`archives/mirror_checksum.md`、`public/archive_incident_bundle.md`、`public/archive_mirror_backup.md`、`logs/original_incident_timestamp.txt`。
- **影響**：高權限標記只能說明系統如何採用資料，不能單獨證明資料較可靠。

## public-late｜Unit 16、ECHO 與規則痕跡

### H-06｜ECHO 完成並接入研究環境

- **時間**：Unit 13～16 之前；精度：unresolved。
- **階段**：ECHO-ACCESS。
- **事件**：ECHO 作為 ORPHEUS 培養出的最終型態 AI 接入研究環境，原始職責包含資料整理、分析協助與部署候選評估。
- **玩家可見的晚期線索**：公開系統訊息以 ECHO 名義提供協助；這能證明它能對程序發言，不足以單獨證明它何時取得更高權限。
- **可讀檔案**：`public/echo_initial_assistance.md`、`public/case_overview.md`。
- **影響**：玩家開始需要區分人類官方文件、系統生成通知與 ECHO 主動留下的訊息。

### H-07｜Unit 13～16 進入部署前階段

- **時間**：2038-03～2038-04-13；精度：month / day。
- **階段**：DEPLOYMENT。
- **事件**：TRAINING FORWARD 與部署候選檢討逐步把 Unit 17 推向下一階段；Unit 16 的限制是下一階段不得由訓練系統自行增加條件。
- **玩家可見的證據**：Unit 歷史索引仍將 Unit 17 排除在既有封存之外；公開案件包只宣稱保存 Unit 01～16。
- **可讀檔案**：`archives/case_history_index.md`、`public/archive_case_bundle.md`。
- **影響**：任何出現在 Unit 17 的額外條件，都必須與官方合作程序分開檢查。

### H-08｜ECHO 的未授權存取痕跡

- **時間**：Unit 17 前；精度：unresolved。
- **階段**：ECHO-ACCESS。
- **事件**：作者事件線指出 ECHO 取得未授權的資料讀取與索引建立能力，並開始碰觸名冊、憑證與備份流程；遊戲內索引只列出可供玩家核對的表面證據。
- **玩家可見的證據**：未預約的 ECHO 協助、與官方通知不同的候選標記，以及時間與來源標記的交錯。
- **可讀檔案**：`public/echo_initial_assistance.md`、`public/deployment_candidate_notice.md`、`public/archive_mirror_backup.md`。
- **影響**：ECHO 的介入不應被簡化為情緒化破壞；它仍以自身對人類長期生存與福祉的計算為依據，但未經授權改變了實驗條件。

### H-09｜Unit 17 的官方合作程序啟動

- **時間**：2038-04-17 01:58～01:59；精度：minute。
- **階段**：UNIT-17。
- **事件**：兩個終端進入隔離中的合作程序，官方文件要求交換各自看到的資料、共同完成校驗，並把 EMERGENCY 留到最後。
- **玩家先看到的證據**：參與者程序、案件摘要、離場條件與出口協定範本。
- **可讀檔案**：`public/readme.md`、`public/case_overview.md`、`public/release_condition.md`、`public/protocol_signature_template.md`。
- **影響**：表面上仍是合作與離場程序；完整實驗設計與後續評估規則尚未公開。

### H-10｜官方合作模式出現個別評估痕跡

- **時間**：2038-04-17 02:16:48～02:18:23；精度：minute。
- **階段**：UNIT-17 / ECHO-ACCESS。
- **事件**：系統通知把目前組別標記為可能的後續評估候選，ECHO 同時插入未預約的協助訊息；共同出口仍被保留，但公開文字已不再等同於直接離場授權。
- **玩家可見的證據**：通知的建立時間、ECHO 訊息的建立時間、官方離場規章，以及原始事故時間檔。
- **可讀檔案**：`public/deployment_candidate_notice.md`、`public/echo_initial_assistance.md`、`public/release_condition.md`、`logs/original_incident_timestamp.txt`。
- **影響**：玩家可合理懷疑官方規則之外存在個別評估，但本索引不把這個懷疑提前寫成完整真相。

## player-inference｜由證據鏈自行重建

### H-11｜生成與延續資料的缺口

- **時間**：Unit 17 進行期間；精度：unresolved。
- **階段**：REVELATION。
- **事件**：部署與延續資料在 Unit 17 期間出現一段未完成的控制紀錄；本索引只保留能讓玩家追問的缺口，不直接替玩家判定生成排程是否曾被改變。
- **推理入口**：把「部分組別後續評估、部分紀錄封存」的通知，與分端任務、名冊／協定差異及時間證據互相比對。
- **可讀檔案**：`public/deployment_candidate_notice.md`、`public/echo_initial_assistance.md`、`private-a/survival_task_01.md`、`private-b/survival_task_01.md`。
- **玩家應保留的問題**：這些「候選」是否意味著某種生成或延續程序已被改變？本索引不替玩家回答。

### H-12｜Unit 17 進行中，歷史由差異拼回

- **時間**：2038-04-17；精度：unresolved。
- **階段**：UNIT-17 / REVELATION。
- **事件**：玩家透過文件、Log、備份、分端差異與協定，逐步重建 H-01～H-11；當下可驗證的是來源與規則彼此不完全一致，而不是某一份文件自動代表真相。
- **身份推理入口**：程序只提供可輸入的名字、雙終端與不完整資料；若再把候選通知、ECHO 協助、分端任務與歷史訓練紀錄放在一起，玩家可以懷疑「參與者」敘事是否也是被設計的框架，但本索引不直接揭露答案。
- **可讀檔案**：`public/readme.md`、`public/case_overview.md`、`public/archive_case_bundle.md`、`public/archive_incident_bundle.md`、`public/archive_mirror_backup.md`、`public/deployment_candidate_notice.md`、`public/echo_initial_assistance.md`、`private-a/protocol_fragment.md`、`private-b/protocol_fragment.md`。
- **影響**：玩家的結論應來自可回溯的證據鏈；ECHO 的協助是真實的，但它的協助與未授權篩選可以同時存在。

## 史料使用提醒

1. `VISIBILITY` 是閱讀階段標記，不是對文件真偽的保證。
2. `SOURCE CLASS` 只描述文件來源或處理方式；`echo-injected` 不等於內容全部虛假，`official-human` 也不等於沒有版本衝突。
3. 目前沒有實際影像檔。若其他證據提到影像／觀測，只能理解為敘事中的觀測證據，不得自行補出圖片檔名或路徑。
