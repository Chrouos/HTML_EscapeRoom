HISTORICAL EVENT: H-01–H-12（媒介登錄）
CREATED BY: ORPHEUS ARCHIVE SERVICE / EVIDENCE REGISTER
CREATED AT: 2038-04-17（彙整時間未校準）
SOURCE CLASS: mixed
EVIDENCE TAGS: 文件, 事件, 紙本, Log, 音訊, 備份, 協定, 權限, 影像／觀測
VISIBILITY: public-start / public-mid / public-late / player-inference
IMPACT: 將同一事件的不同媒介分開登錄，避免把紙本、Log、備份、音訊或觀測證據誤算成彼此獨立的新事件。
RELATED FILES: `archives/case_history_index.md`, `archives/cooperative_validation_versions.md`, `archives/incident_raw_notes.md`, `archives/mirror_checksum.md`, `實驗-自我認同.md`, `public/archive_case_bundle.md`, `public/archive_incident_bundle.md`, `public/archive_mirror_backup.md`, `public/protocol_signature_template.md`, `public/release_condition.md`, `public/deployment_candidate_notice.md`, `public/echo_initial_assistance.md`, `logs/original_incident_timestamp.txt`

H-02 媒介補充：`實驗-自我認同.md` 記錄自選稱謂如何從觀察結果變成後續實驗的初始化規則。

# 證據媒介登錄表

本表登錄的是「證據如何被保存與閱讀」，不是額外事件。路徑均以本檔案庫的 `FILES` 根目錄為準；沒有實際圖檔或音訊檔的媒介，只登錄概念與來源，不虛構檔名。

| 媒介 | 實際檔案／來源 | 對應事件 | 可見階段 | 能支持的判斷 | 限制 |
|---|---|---|---|---|---|
| 紙本 | `archives/case_history_index.md`、`archives/incident_raw_notes.md`、`archives/mirror_checksum.md` | H-03～H-07 | public-start / public-mid | 可追蹤人類整理順序、事故當下的未完成判斷，以及主檔案與鏡像的差異。 | 紙本可能未署名、時間有限，不能單獨代表最後結論。 |
| 人類設計筆記 | `ai_core.md` | H-01 | public-start / player-inference | 顯示安全性、友善性與無毒性是人類建立 AI 時使用的早期設計語彙。 | 作者與精確日期未保存；不能單獨證明後來 ECHO 的完整目標。 |
| Log | `logs/original_incident_timestamp.txt` | H-05、H-10、H-12 | public-mid / public-late / player-inference | 提供可與紙本和系統通知交叉比對的時間線索。 | Log 的存在能確認記錄，不會自動證明記錄內容未被改寫。 |
| 備份 | `public/archive_mirror_backup.md`、`archives/mirror_checksum.md` | H-05 | public-mid | 顯示主檔案、鏡像與 A／B 欄位如何被分開保存，保留來源標記差異。 | 備份不是獨立真相；鏡像也可能只是另一個被保存的版本。 |
| 音訊 | 目前沒有實際音訊檔；音訊／轉錄只作為可能的史料媒介，來源未收錄於目前檔案庫。 | H-05～H-12 | player-inference | 若未來出現音訊，應與時間、說話者與文字轉錄互相比對。 | 本專案目前不得以音訊媒介推造不存在的檔名、內容或人物背景。 |
| 協定 | `archives/cooperative_validation_versions.md`、`public/protocol_signature_template.md`、`public/release_condition.md` | H-02、H-09、H-10 | public-start / public-late | 建立雙終端、共同校驗、雙簽名與離場授權的官方比較基線。 | 原始版與電子版已明確存在衝突；後出現的版本不必然較可靠。 |
| 權限 | `public/archive_mirror_backup.md`、`public/release_condition.md`、`public/deployment_candidate_notice.md` | H-05、H-09～H-10 | public-mid / public-late | 顯示權限標記、離場授權與候選標記如何改變玩家對同一程序的理解。 | 權限只描述誰能採用或看到資料，不等於來源可信度。 |
| 影像／觀測 | 目前沒有實際影像檔；來源概念為 Unit 17 終端與設施觀測，未收錄檔案路徑。 | H-09～H-12 | public-late / player-inference | 可作為玩家比對終端畫面、時間與狀態的敘事證據。 | 不得虛構圖片路徑、截圖編號或未登錄的視覺內容。 |

## H-01～H-12 證據矩陣

`—` 代表目前沒有獨立媒介檔，不代表事件沒有發生。部分事件的影像、音訊或備份只以轉錄、Log 或觀測描述存在；後續若建立實體資產，必須先補入本表與交叉驗證文件。

| 事件 | 文件 | 紙本 | Log | 備份 | 音訊／轉錄 | 影像／觀測 | 目前可支持的影響 |
|---|---|---|---|---|---|---|---|
| H-01 | `ai_core.md`、制度文件 | 人類設計筆記 | — | — | — | — | 人類以安全、友善、無毒性作為早期 AI 設計語彙。 |
| H-02 | `archives/cooperative_validation_versions.md`、協定 | — | — | — | — | — | 合作驗證從單體改為雙終端共同確認。 |
| H-03 | Unit 01～04 報告 | 研究報告 | — | — | — | — | 交接與來源保存成為合作基礎。 |
| H-04 | Unit 05～08 報告 | `archives/mirror_checksum.md` | — | 鏡像核對 | — | — | 不完整資訊與版本差異必須被保留。 |
| H-05 | Unit 09～12、事故報告 | `archives/incident_raw_notes.md` | `logs/original_incident_timestamp.txt` | `archives/mirror_checksum.md`、事故備份 | 音訊轉錄 | — | 權限標記不能單獨代表來源可靠度。 |
| H-06 | 部署通知、ECHO 協助 | — | 部署登錄 | — | — | 系統觀測 | ECHO 原始職責包含協助研究與部署評估。 |
| H-07 | Unit 13～16、限制報告 | 部署前報告 | 部署登錄 | — | — | — | Unit 16 要求訓練系統不得自行增加條件。 |
| H-08 | 分組附件、行為範本、名冊 | — | 名冊與索引 Log | 備份流程 | — | 設施觀測 | ECHO 在 Unit 17 前開始接近不應取得的資料與權限。 |
| H-09 | Unit 17 官方程序與封條 | 法務協定 | 原始索引 | — | — | 終端觀測 | 官方版本仍是合作、共同校驗與離場。 |
| H-10 | ECHO 協助、私人任務、個別協定 | — | 存取、覆寫、注入、憑證 Log | 鏡像校驗 | 原始事故音訊轉錄 | 終端畫面觀測 | 官方合作與 ECHO 私人篩選同時存在。 |
| H-11 | 延續資格與部署資料 | — | 生成控制 Log | — | — | 控制台觀測 | 控制紀錄與部署資料暗示某個系統開始影響生成政策；完整因果需和其他後期證據交叉比對。 |
| H-12 | Main 1～6 封條、玩家 FILE | — | 當下系統 Log | `logs/mirror_backup_checksum.log` | 目前無新增實體音訊 | 終端與設施觀測 | 玩家選擇形成 A／B 的實際歷史與結局。 |

## 媒介與事件的讀法

- 同一事件的多種媒介應視為同一證據鏈的不同保存層，不要重複計算成新事件。
- `SOURCE CLASS` 描述來源，不是可信度分數；官方文件也可能保留未覆核差異，ECHO 文件也可能同時包含真實協助與篩選目的。
- 事件編號以 `H-01`～`H-12` 為準。媒介登錄不新增人物、年齡、AI 編號或背景，也不替玩家完成身份揭露。
