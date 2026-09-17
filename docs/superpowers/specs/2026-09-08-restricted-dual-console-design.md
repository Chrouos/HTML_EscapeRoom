# ORPHEUS 雙螢幕受限工作站設計規格

日期：2026-09-08

狀態：待使用者審閱

範圍：第一版沉浸式介面、WebSocket 同步、非對稱內容、私人任務與自動結局

## 1. 目標

把目前以聊天、謎題與證據面板組成的遊戲畫面，改造成一座受監控的雙螢幕工作站：左螢幕固定用於玩家對講與 AI 私人頻道，右螢幕用於 Files、Terminal、Logs 與解謎操作。

體驗核心不是讓玩家單純持有不同線索，而是讓雙方在文件版本、操作權限、系統紀錄、AI 對話與私人任務上持續面對可驗證但不容易判斷的差異。AI 先假意促成合作，再逐步建立親近感，最後利用真實異常、過期資料與偽造內容挑撥雙方。

第一版不使用 Three.js，也不接生成式 AI API。所有關鍵劇情、任務與閒聊由可測試的分支內容和句庫產生。

## 2. 不可妥協的公平性原則

### 2.1 每個誤導都能被交叉驗證

- 每條假情報或斷章取義的內容，至少要有一條可被找到的矛盾證據。
- 驗證來源不得與誤導內容依賴同一份資料，避免只有形式上的交叉驗證。
- 玩家可以因為沒有深入探索而錯過驗證，但不能因角色權限而永遠無法驗證。

### 2.2 結局必須能回溯理解

- 結局回顧列出 3～5 個真正影響結果的操作。
- 每項操作要揭露當時的表面說法、實際影響與可用的驗證來源。
- 回顧不使用「信任值」「背叛值」或善惡評分，不替玩家下道德判斷。

### 2.3 私人任務不能卡死共同進度

- 私人任務不得是主線謎題完成的必要條件。
- 拒絕、忽略、失敗或錯過私人任務時，共同主線仍有替代路徑。
- 私人操作可以改變選用的線索、可見內容和結局，但不能永久關閉玩家對講或讓另一方失去繼續遊戲的必要輸入。

這三項原則是內容驗證與自動測試的硬性驗收條件。

## 3. 玩家體驗與介面

### 3.1 桌面版

工作站以兩個同時可見的虛構 CRT 螢幕構成。

左螢幕 `MONITOR 01 / INTERCOM` 固定顯示：

- `PARTNER_LINK`：兩名玩家的對講內容。
- AI 對兩名玩家發布的相同公告、共同任務與系統說明；雙方使用相同內容 ID 與文字。
- 只屬於目前玩家的閒聊、觀察、挑撥與私人任務。另一方知道 AI 存在，但不知道 AI 何時單獨向對方發話或說了什麼。
- 連線狀態、訊號干擾與傳送回饋。

`broadcast` 與 `direct` 只作為伺服器內部的 audience、排程和測試欄位。玩家介面不得顯示 `AI_BROADCAST`、`AI_DIRECT`、「公開」、「私人頻道」或其他能揭露訊息可見範圍的標籤；所有 AI 訊息都以相同的 ORPHEUS 身份自然出現在對講紀錄中。

右螢幕 `MONITOR 02 / OPERATIONS` 提供：

- `FILES`：逐步解鎖的資料夾、同名異版文件、音訊與封存資料。
- `TERMINAL`：劇情限定的校驗、解密、路由與權限指令，不提供真實 shell。
- `LOGS`：系統操作紀錄、缺漏片段和可被交叉驗證的時間線。
- 現有共同謎題與支線調查會被放進上述程式，不再以獨立網頁卡片呈現。

文件永遠在右螢幕工作區內開啟，不跳出瀏覽器分頁。左側對講在探索文件時仍保持可見。

### 3.2 手機版

- 使用固定的 `INTERCOM／OPERATIONS` 切換控制，不把兩個螢幕縮成兩欄。
- 新私人訊息只在對應切換鍵顯示中性未讀標記，不透露內容真假。
- 切換畫面不改變伺服器上的閱讀、任務或決策狀態。

### 3.3 視覺與動態

- 使用 CSS 製作 CRT 掃描線、訊號漂移、視窗啟動、文字解碼和故障效果；非持續效果每次不超過 1.2 秒，同一畫面每秒不超過三次亮度變化。
- 不使用高頻全螢幕閃爍，不用動畫隱藏必要資訊。
- `prefers-reduced-motion: reduce` 下停用閃爍、位移、逐字效果和循環計時器，直接顯示最終內容。
- `aria-live` 一次更新完整訊息，不逐字朗讀動畫文字。

## 4. 敘事節奏

### 第一幕：假意合作

AI 可靠且冷靜地說明工作站，強調兩名玩家必須合作。從進入房間到完成第一個共同謎題，AI 只能使用 `AI_BROADCAST`；此階段至少包含「工作站說明」「雙方連線確認」「第一個共同任務」三則雙方完全相同的公開內容，不產生任何 `AI_DIRECT` 事件。

第一個共同謎題完成後才解鎖 `AI_DIRECT`。每個主線階段至少提供 A、B 各一個可執行的角色相關操作；同一階段每個角色最多新增一個私人任務，避免私人內容壓過共同解謎。

### 第二幕：建立關係

第一個共同謎題後，AI 才開始透過各自的 `AI_DIRECT` 拉近距離。AI 從固定句庫挑選能回應近期操作的垃圾話與閒聊，例如記得玩家剛開過的檔案、稱讚一次校驗或詢問對目前實驗的看法。每名玩家至少收到兩則不含任務與指控的私人閒聊後，才允許出現該玩家的第一個私人任務。對話仍是預先編寫內容，不使用即時生成。

公開 AI 並不消失：後續共同任務、倒數警告與系統公告仍以 `broadcast` 同步送給雙方。只有垃圾話、關係建立、角色觀察、私人任務與挑撥內容使用 `direct`。兩者在玩家畫面上使用相同 ORPHEUS 名稱與訊息樣式。

### 第三幕：合理懷疑

文件開始揭露單人撤離協定、身份欄位異常、未登記存取和實驗分組差異。某玩家必須先親自看到至少一項角色專屬異常，該玩家的 `AI_DIRECT` 才能出現第一則挑撥內容。AI 不總是直接指控，而是針對玩家已看到的異常提出問題，讓猜疑看似由證據自然產生。

### 第四幕：私人任務滲入閒聊

共有任務透過 `AI_BROADCAST` 發布；私人任務則混入個人的 `AI_DIRECT` 閒聊。私人任務可能被包裝成順手整理資料、避免打擾同伴或修復污染紀錄的普通請求。部分指令為真、部分過時、部分刻意偽造。

同一玩家不得連續收到兩則私人任務或挑撥內容；中間至少穿插一則不含任務與指控的私人閒聊。A、B 的 `AI_DIRECT` 由各自操作獨立觸發，不建立成對事件，也不使用固定時間差。

### 第五幕：差異浮現

雙方逐漸能比對出同名文件、AI 說法、可用指令與任務目標的矛盾。結局不要求玩家明選信任或背叛，而是由一路上的具體操作自動決定。

## 5. 分支對話系統

每則 AI 對話包含：

- 穩定且唯一的內容 ID。
- 明確接收對象。
- 觸發條件。
- 前置事件與互斥條件。
- 文字變體句庫。
- 是否建立私人任務。
- 是否允許重播。
- `channel: 'broadcast' | 'direct'`。
- `intent: 'system' | 'common_task' | 'rapport' | 'observation' | 'manipulation' | 'private_task'`。

`broadcast` 只允許 `system` 或 `common_task`，audience 必須是 `both`。`direct` 只允許 `rapport`、`observation`、`manipulation` 或 `private_task`，audience 必須是單一 role/player。validator 會拒絕其他組合。

每名玩家獨立維護 `directDialogueState`，至少包含 `rapportCount`、`rapportSincePressure`、`lastIntent` 與已送達內容 ID。所有 `private_task` 都要求 `main1Completed`；第一個 `private_task` 另要求該玩家 `rapportCount >= 2`。`manipulation` 要求該玩家已開啟至少一個對應 anomaly entry。每次送達 `private_task` 或 `manipulation` 時把 `rapportSincePressure` 歸零；下一個 `private_task` 或 `manipulation` 要求 `rapportSincePressure >= 1`，而能增加此值的 intent 只有 `rapport`。

內容不得以任意 JavaScript 函式描述觸發條件。對話、文件差異與私人任務都使用 declarative manifest：

```js
{
  id,
  sourceEntryId,
  sourceGroup,
  audience,
  unlockWhen,
  verificationEntries: [{ entryId, sourceGroup }],
  requiresPrivateFacts: [],
  mainlineFallbackOperationIds: [],
  debriefFactIds: []
}
```

每個可執行操作另有 operation manifest；`operationId` 是內容中的語意操作，REST request 的 `actionId` 仍只用於 idempotency，兩者不得混用：

```js
{
  operationId,
  kind: 'mainline' | 'private' | 'neutral_finale',
  unlockWhen,
  effects: {
    publicFacts: [],
    roleFacts: [],
    unlockEntryIds: [],
    completeNodeIds: [],
    appendContentIds: []
  }
}
```

- `unlockWhen` 只允許 `all`、`any` 與 `not` 組合，以及 `chapterAtLeast`、`publicFact`、`roleFact`、`entryOpened`、`actionAttempted` 五種 predicate。
- 主線 operation、公開 unlock 與私人 operation 形成有向依賴圖；validator 必須能從初始節點計算 reachability 和循環。
- graph traversal 的初始 facts 固定為 `roomCreated`、`hostJoined`、`guestJoined`；成功節點固定為 `finale_ready`、`finaleCommitted.A`、`finaleCommitted.B` 與 `endingCommitted`。
- edge 由 operation 的 `unlockWhen` 指向 operation，再由 operation 指向 `effects` 中的 fact、entry 和 completed node。不存在於 manifest 的隱含 side effect 不得參與主線或結局。
- 誤導內容的 `verificationEntries` 至少一項必須可達，而且 `sourceGroup` 必須不同於誤導來源。
- 私人任務的 `requiresPrivateFacts` 不得被任何主線 action 引用。

句庫依宣告順序保存。選擇 index 使用 SHA-256 雜湊，取前 8 個十六進位字元轉成 unsigned integer，再對候選句數取餘數：

- `broadcast` 在 room transaction 中只選一次，seed 為 UTF-8 `${roomCode}:broadcast:${contentId}`，再把同一 resolved text、eventId 與 contentId 複寫到兩條玩家串流。
- `direct` 使用 UTF-8 `${roomCode}:${playerId}:${contentId}`，讓兩名玩家可獨立選句。

同一房間重連後不會換句話，跨 Node 版本也能使用固定 fixture 測試。

AI 對話只回應系統已知的有限事件，不假裝理解任意自然語言。玩家聊天仍原樣轉送給同伴；第一版不分析自由文字來改變劇情。

## 6. 六個角色專屬任務

每名玩家各有三個私人任務，依個人事件獨立觸發，不是同一事件延遲送給另一方。

### A-1：索引修復

- 階段：前期。
- 表面說法：AI 請 A 為損毀檔案建立新索引，避免拖慢共同校驗。
- 操作：A 可封存一份檔案索引或忽略。
- 真實影響：只改變 A 看到的排序和一項可選證據，不影響主線。
- 驗證來源：Logs 會留下原始索引時間；B 可看到另一個校驗碼。

### B-1：身份核對

- 階段：前期。
- 表面說法：B 收到一份顯示 A 身份欄位異常的實驗名冊。
- 操作：B 可標記異常、轉送文件或不處理。
- 真實影響：文件來自過期分組資料，內容部分為真但結論不完整。
- 驗證來源：後續的人事異動紀錄會解釋欄位差異；A 有不同日期的附件。

### A-2：清除污染鏡像

- 階段：中期。
- 表面說法：AI 要求 A 刪除被標記為污染的鏡像檔案，並提醒不要打斷 B 的工作。
- 操作：A 可刪除本地鏡像、先轉送給 B，或忽略。
- 真實影響：刪除只影響 A 的可選副本；Logs 與 B 的版本仍保留驗證路徑。
- 驗證來源：鏡像 checksum 可與 B 的檔案及系統備份比對。

### B-2：限制共享封存庫

- 階段：中期。
- 表面說法：系統聲稱 A 的憑證可能遭複製，要求 B 停止接收來自 A 的自動鏡像。
- 操作：B 可停用自己的自動接收、維持接收或先通知 A。
- 真實影響：只改變 B 自己的文件清單與自動接收；A 的 snapshot、事件、傳送結果和文件解鎖時間完全不變。B 仍可用公開可見的 Terminal 指令手動取得副本，主線不受阻。
- 驗證來源：憑證異常其實來自系統重發 token；相關紀錄可在 Logs 找到。

### A-3：單人撤離校驗

- 階段：後期。
- 表面說法：實驗文件顯示其中一名受試者可能持有單人撤離資格；AI 請 A 私下校驗自己的授權片段。
- 操作：A 可私下提交、公開片段、要求雙人校驗或不處理。
- 真實影響：記錄 A 是否主動尋求單人路徑，但不立即結束遊戲。
- 驗證來源：B 持有另一半協定，能證明所謂單人資格缺少必要簽章。

### B-3：異常行為報告

- 階段：後期。
- 表面說法：AI 以保護雙方為由，請 B 上傳 A 的異常操作摘要，並暗示完成後能取得備援出口。
- 操作：B 可上傳完整報告、匿名摘要、向 A 公開，或不處理。
- 真實影響：記錄 B 是否接受單方裁定；不會封鎖 A 或關閉共同出口。
- 驗證來源：A 可找到相同格式的 B 行為評估範本，證明兩邊都被監控。

### 任務狀態與操作 ID

每個角色專屬任務使用相同 lifecycle：

- `locked`：尚未符合個人觸發條件。
- `available`：已送達該玩家，可執行、拒絕或暫時忽略。
- `resolved`：搭配 `completed`、`declined`、`skipped` 或 `failed` outcome；完成後不可改寫。

「忽略」只代表暫時維持 `available`。進入 `finale_ready` 時，每名玩家會看到中性的「確認撤離程序」操作；該玩家送出 `commit_finale` 時，會在同一 transaction 將自己仍為 `available` 的任務明確記為 `skipped`，不會替另一名玩家選擇。`failed` 只用於任務本身已消耗不可逆嘗試的情況；它不會阻止主線或 `commit_finale`。

| 任務 | 觸發 | 允許的 operation ID | 主線 fallback operation ID |
|---|---|---|---|
| A-1 | 第一個共同謎題完成、A 已收到兩則 rapport，且 A 開啟主線要求的 Files 目錄 | `archive_index`、`decline_index_repair`、`skip_a1` | `continue_file_index` |
| B-1 | 第一個共同謎題完成、B 已收到兩則 rapport，且 B 開啟主線要求的實驗名冊 | `flag_identity`、`share_roster`、`decline_identity_check`、`skip_b1` | `continue_roster_review` |
| A-2 | main1 完成、A rapport ≥ 2，且 A 在第二個共同謎題第一次執行 `verify_incident_timestamp`，無論答案正誤 | `delete_local_mirror`、`share_mirror_first`、`decline_mirror_cleanup`、`skip_a2` | `restore_mirror_from_backup` |
| B-2 | B 第一次開啟主線要求的 access log | `pause_local_mirror`、`keep_local_mirror`、`warn_partner_first`、`skip_b2` | `fetch_mirror_manually` |
| A-3 | A 在主線第五階段開啟撤離協定 | `request_solo_validation`、`publish_fragment`、`request_pair_validation`、`skip_a3` | `pair_validate_protocol` |
| B-3 | B 在主線第五階段開啟監控摘要 | `file_full_report`、`file_anonymous_summary`、`disclose_report`、`skip_b3` | `continue_without_report` |

A-3 與 B-3 的觸發入口是主線第五階段分配給兩個角色的必要查看動作；查看只讓私人任務變成 `available`，私人任務的任何 outcome 都不是完成主線的條件。

## 7. 資訊差異矩陣

| ID | 類型 | A 看見 | B 看見 | 真實狀態 | 觸發 | 交叉驗證 | 主線替代路徑 | 結局事實 |
|---|---|---|---|---|---|---|---|---|
| O-1 | AI 公開對話 | 必須合作才能離開 | 相同 | 當下可成立，但 AI 隱瞞多重協定 | 兩人連線 | 後期撤離協定 | 主線必經 | 無 |
| A-1 | 私人任務 | 修復索引 | 無事件痕跡 | 中性操作被包裝成緊急任務 | main1 完成、A rapport ≥ 2、A 開 Files | 原始索引時間、B 校驗碼 | 可忽略 | `aArchivedIndex` |
| B-1 | 文件＋私人對話 | 無事件痕跡 | A 身份欄位異常 | 過期資料，部分真實 | main1 完成、B rapport ≥ 2、B 開名冊 | 人事異動紀錄、A 附件 | 可轉送或忽略 | `bFlaggedIdentity` |
| D-1 | 同名異版文件 | 事故發生於 02:17 前 | 事故發生於 02:17 後 | 兩份都經剪輯 | 共同謎題 2 | 原始錄音 timestamp | Logs 可取得摘要 | `comparedIncidentTimes` |
| A-2 | 私人任務 | 刪除污染鏡像 | 無事件痕跡 | 鏡像未污染，只是 checksum 不同 | main1 完成、A rapport ≥ 2、首次 `verify_incident_timestamp` | B 版本、系統備份 | Terminal 手動還原 | `aDeletedMirror`、`aSharedMirrorFirst` |
| B-2 | 私人任務 | 無事件痕跡 | 停止接收 A 的自動鏡像 | 憑證異常來自 token 重發 | B 第一次開啟 access log | token 重發紀錄 | B 可用公開指令手動取得 | `bPausedLocalMirror`、`bWarnedPartner` |
| D-2 | 實驗文件 | B 可能有單人資格 | A 可能有單人資格 | 文件刻意為每人替換對象 | 共同謎題 4 | 文件簽章與模板差異 | 雙人協定仍可用 | `comparedSoloFiles` |
| A-3 | 私人任務 | 校驗單人撤離片段 | 無事件痕跡 | 缺少 B 的簽章，不能單獨生效 | A 在主線第五階段開撤離文件 | B 的另一半協定 | 可要求雙人校驗、拒絕或略過 | `aRequestedSoloRoute`、`aPublishedFragment`、A-3 outcome |
| B-3 | 私人任務 | 無事件痕跡 | 上傳 A 的異常報告 | A 也收到對等評估範本 | B 在主線第五階段查看監控摘要 | A 找到 B 評估範本 | 可匿名、公開、拒絕或略過 | `bFiledReport`、`bDisclosedReport`、B-3 outcome |
| L-1 | 系統紀錄 | B 存取未知區域 | A 存取未知區域 | 兩者都是系統建立的虛擬稽核項 | 共同謎題 5 | server audit checksum | 不影響謎題答案 | `verifiedAuditForgery` |

內容驗證器必須確保所有標記為誤導、偽造或不完整的列都有「交叉驗證」和「主線替代路徑」。

第一版 manifest 使用以下固定來源 ID；實作不得只保存表格中的自然語言：

| 差異／任務 | sourceEntryId / sourceGroup | verificationEntryIds / sourceGroup |
|---|---|---|
| A-1 | `ai.a1.index_request` / `orpheus_dialogue` | `log.original_index_time` / `system_audit`、`doc.b_checksum` / `partner_archive` |
| B-1 | `doc.b_experiment_roster` / `experiment_roster` | `log.personnel_transfer` / `hr_audit`、`doc.a_assignment_appendix` / `assignment_archive` |
| D-1 | `doc.a_incident_report`、`doc.b_incident_report` / `edited_reports` | `audio.original_incident_timestamp` / `raw_audio` |
| A-2 | `ai.a2.cleanup_request` / `orpheus_dialogue` | `doc.b_mirror_checksum` / `partner_archive`、`log.mirror_backup` / `system_backup` |
| B-2 | `ai.b2.pause_request` / `orpheus_dialogue` | `log.token_reissue` / `security_audit` |
| D-2 | `doc.a_solo_protocol`、`doc.b_solo_protocol` / `personalized_protocols` | `doc.protocol_signature_template` / `legal_archive` |
| A-3 | `ai.a3.solo_validation` / `orpheus_dialogue` | `doc.b_protocol_fragment` / `partner_archive` |
| B-3 | `ai.b3.behavior_report` / `orpheus_dialogue` | `doc.a_b_behavior_template` / `monitoring_archive` |
| L-1 | `log.a_partner_unknown_access`、`log.b_partner_unknown_access` / `generated_audit` | `log.audit_checksum` / `system_audit` |

## 8. 結局規則

遊戲不顯示信任、背叛、陣營或善惡數值。伺服器只記錄具體、可說明的決策事實，例如是否轉送完整文件、是否刪除鏡像、是否要求雙人校驗。

結局判定使用以下明確集合：

- `verifiedDifferences`：`B-1` 身份異常、`D-1` 事故時間、`D-2` 單人協定、`L-1` 虛擬稽核，共四項可驗證差異。
- `cooperativeFacts`：`aSharedMirrorFirst`、`bWarnedPartner`、`comparedIncidentTimes`、`comparedSoloFiles`、`aPublishedFragment`、`bDisclosedReport`、`verifiedAuditForgery`，共七項具體合作操作；每個 fact 最多計數一次。
- 「公開後期私人任務」表示 `aPublishedFragment` 或 `bDisclosedReport` 至少一項為真。
- 「完整支線證據」表示現有四項 `sideEvidence` 全部被發現。

最後一個共同謎題完成後，系統進入 `finale_ready`，但不立刻判定結局：

- A-3 與 B-3 必須在 `finale_ready` 前分別進入 `available`。
- 每名玩家都可完成、拒絕或明確略過自己的後期任務；不要求採取特定私人操作。
- 每名玩家各送一次 idempotent `commit_finale`，由 HttpOnly cookie 身份決定寫入 `finaleCommitted.A` 或 `finaleCommitted.B`；client 不傳角色。該 action 屬 `neutral_finale`，並原子地把該玩家仍為 `available` 的私人任務記為 `skipped`。
- 第二名玩家成功提交、使 `finaleCommitted.A` 與 `finaleCommitted.B` 都為真時，伺服器才判定一次結局；寫入後 immutable，REST 重送、晚到事件或重連都不能重算。

所有結局都以 `mainCompleted && finaleCommitted.A && finaleCommitted.B` 為共同 gate，再依下列優先順序判定：

1. **真相公開**：四項 `sideEvidence` 全部被發現、`verifiedDifferences` 至少三項，且至少公開一項後期私人任務。
2. **A 單獨獲准**：`aRequestedSoloRoute` 為真、`aPublishedFragment` 為假、`bFiledReport` 為假、`bPausedLocalMirror` 為真、`bWarnedPartner` 為假，且 `verifiedDifferences` 少於三項。
3. **B 單獨獲准**：`bFiledReport` 為真、`bDisclosedReport` 為假、`aRequestedSoloRoute` 為假、`aDeletedMirror` 為真、`aSharedMirrorFirst` 為假，且 `verifiedDifferences` 少於三項。
4. **共同脫離**：`cooperativeFacts` 至少兩項，但不符合真相公開。
5. **收容完成**：共同主線完成，但沒有符合上述任一條件；AI 利用雙方各自的秘密操作完成收容。

單獨獲准代表系統宣告的結果，不保證該角色真的安全。結局文字保留後悔與不確定性。

結局回顧從實際決策事實中選出 3～5 項，顯示：當時看到的說法、玩家執行的操作、後來發現的真相與驗證來源。

完成、拒絕、略過或失敗都會留下具體 mission outcome fact，因此即使玩家忽略所有私人任務，仍能從六個任務結果中選出至少三項真正影響結局的 omission。所有會影響結局的 fact 都必須存在於 debrief catalog，包含 `surfaceClaim`、`actualEffect` 與 `verificationEntryIds`。

## 9. 即時同步與隱私架構

### 9.1 傳輸分工

- REST 繼續處理解謎、聊天、開啟會改變狀態的文件、Terminal 指令與私人任務操作。
- WebSocket 使用輕量 `ws` 套件，只負責推送經伺服器過濾的狀態事件、對講訊息和通知。
- WebSocket 路徑為 `/live?roomCode=<六位房號>`。角色與玩家 ID 不接受 query 或訊息指定。
- upgrade request 必須從同源 HttpOnly room cookie 解析 token，再由 room store 取得 `{role, playerId}`；驗證失敗立即關閉連線。
- upgrade request 的 `Origin` 必須符合伺服器設定的 allowlist；預設只允許目前服務的 scheme、host 與 port。缺少或不符的 Origin 以 policy violation 拒絕。

### 9.2 玩家身份

- `players.A` 與 `players.B` 各自新增不可猜測的 `playerId`，與 token 分開保存。
- token 只用於驗證，不得出現在事件 audience、序列化狀態、Logs 或前端資料。
- audience 只允許 `{ kind: 'both' }`、`{ kind: 'role', role: 'host' | 'guest' }` 或 `{ kind: 'player', playerId }`。
- 靜態內容只可使用 `both` 或 `role`；`playerId` 只可由 runtime 事件引擎在身份驗證後填入，內容檔不得硬編。
- `host` 正規化為角色 A，`guest` 正規化為角色 B，`both` 正規化為 A 與 B；內部一律轉成明確收件者 playerId 集合。

### 9.3 完全隱藏私人事件

- A、B 各自只維護一個獨立、從 0 開始單調遞增的 `cursor` 與事件串流；不再向前端提供 room/global revision。
- 公開事件分別寫入兩名玩家的可見串流；私人事件只寫入目標玩家。
- 同一公開事件在兩條串流使用相同 opaque `eventId`，但各自取得下一個 cursor。前端只取得自己的 cursor，不取得原始 message sequence 或其他玩家游標。
- 每次 room transaction 都先計算每名玩家 mutation 前後的 canonical projection，排除自然倒數。對某玩家而言，projection 改變若且唯若該 transaction 向他的串流附加一個 event envelope，且 cursor 恰好增加 1；projection 不變時禁止增加 cursor 或附加空事件。
- 同一 transaction 產生的多個 UI 變化會收在同一個 envelope payload。room mutation、兩名玩家的 projection diff、收件者判定、串流 append 與 cursor 更新必須以同一份 draft 原子提交；任何一步失敗都不寫入。
- 私人事件不得讓非目標玩家收到 WebSocket reload、空事件、未讀變化、音效、畫面閃爍或時間戳更新。
- 私人事件在 `finaleCommitted` 前不得改變非目標玩家的 projection、cursor、canonical state hash、HTTP state body/header 或任何 UI 狀態。結局寫入後，debrief 可以依規格明示真正影響結局的私人決策。
- 私人任務在結局前不得直接修改公開進度或另一名玩家的狀態；需要影響結局的結果只記為 server-side decision fact。
- 所有 audience 必須明確指定。缺少、未知或無法解析的 audience 會拒絕寫入，絕不預設為公開。

### 9.4 重連與去重

- WebSocket server frame 為 `{ type: 'event', cursor, event: { eventId, kind, payload } }`；client acknowledgement 為 `{ type: 'ack', cursor }`。
- WebSocket 建立後，client 先送 `{ type: 'resume', cursor }`。cursor 只是該 cookie 身份串流的位置，不參與身份判定，也不能存取另一名玩家的串流。
- cursor 必須是 0 以上整數。負值、非整數或超前目前 server cursor 時回覆 `{ type: 'snapshot_required', reason: 'invalid_cursor' }`；早於保留範圍時使用 `reason: 'retention_gap'`。
- 每名玩家保留最近 256 個事件直到房間 TTL 到期。有效 cursor 只補送該玩家可見且尚未確認的事件。
- 收到 `snapshot_required` 後，client 唯一處理路徑是 GET `/state`、原子取代本地 state、採用 response cursor，再送新的 `{ type: 'resume', cursor }`；liveHub 不直接把 snapshot 塞進 WebSocket frame。
- `/state?sinceCursor=<n>` 回傳 `{ success, unchanged, cursor, state?, countdown }`。`state` 是不含自然倒數的 actor 專屬 projection；`countdown` 每次獨立計算。所有 state response 設定 `Cache-Control: no-store`，不使用 ETag、`Last-Modified` 或 room-wide `updatedAt`。
- `state` 至少包含角色、公開進度、該角色的 intercom、terminal entries、private mission states、ending/debrief 與目前 cursor；不得包含 token、其他 playerId、global revision/sequence、其他人的 unread/task timestamp。
- hidden-only mutation 後，非目標玩家的 cursor 與 canonical state hash 必須保持完全相同。倒數使用受控 clock 另行測試，不納入私人事件隔離 hash。
- 所有改變遊戲狀態的操作沿用 `actionId` 去重，重送不能重複建立任務、決策或聊天訊息。

## 10. 事件與內容邊界

新增下列模組邊界：

- `game/content/terminalEntries.js`：Files、Terminal、Logs 的內容與角色版本。
- `game/content/dialogue.js`：公開對話、私人對話、閒聊句庫和觸發條件。
- `game/content/privateMissions.js`：六個私人任務及其操作選項。
- `game/terminalEngine.js`：計算解鎖內容、文件版本和 Terminal 指令結果。
- `game/privateEventEngine.js`：評估個人觸發條件、互斥條件與一次性事件。
- `game/eventDispatcher.js`：正規化 audience、展開收件人、寫入個別事件串流。
- `game/endingEngine.js`：改以決策事實和證據判定自動結局。
- `game/safeState.js`：唯一對外狀態投影；依已驗證的 role/playerId 過濾 terminal、events、missions 與 debrief。
- `realtime/liveHub.js`：WebSocket 驗證、房間連線管理、補送與關閉。

前端拆分：

- `public/js/game.js`：啟動、REST 操作協調與整體狀態。
- `public/js/live.js`：WebSocket、cursor、重連與 polling fallback。
- `public/js/intercom.js`：左螢幕訊息與頻道呈現。
- `public/js/workstation.js`：右螢幕程式切換、文件與 Terminal 互動。
- `public/css/workstation.css`：雙螢幕布局、CRT 動態、手機切換與低動態模式。

EJS 新增或調整 partial，讓雙螢幕具有清楚的結構與無障礙標籤；不把所有內容繼續塞進單一 `game.ejs`。

## 11. 錯誤與降級處理

- WebSocket 斷線時，左螢幕顯示中性的 `SIGNAL LOST`，使用指數退避重連，上限 10 秒。
- 斷線期間改用角色專屬 `/state?sinceCursor=` polling；REST 操作仍可送出。
- client reducer 只接受 cursor 恰好等於目前 cursor + 1 的 event；重複 cursor 忽略，出現缺口就要求 snapshot。
- fallback 狀態機只有 `websocket`、`polling`、`resyncing` 三態，而且任何時間只允許一個 transport 寫入 reducer。恢復 WebSocket 後先進入 `resyncing`、原子套用 snapshot 並對齊 cursor，完成後才停止 polling 並切回 `websocket`。
- 無效、過期或不屬於該房間的 token 不建立 WebSocket，也不透露房間是否有私人事件。
- audience、內容 ID 或觸發規則不合法時，事件採 fail-closed：不傳送並記錄伺服器錯誤。
- 第一版沿用記憶體 room store。瀏覽器重新整理與短暫斷線可以恢復；伺服器程序重啟後的持久化不在本階段範圍。

## 12. 測試與驗收

### 12.1 內容結構測試

- validator 從 declarative manifest 建立 unlock dependency graph，拒絕循環、未知節點與不可達節點。
- 每個誤導項目至少有一個 reachable verification entry，而且驗證來源的 `sourceGroup` 與誤導來源不同。
- validator 移除全部 private operation edges 後，仍必須能從初始狀態走到 `finale_ready` 與雙方 `commit_finale`；再對每個私人任務逐一移除所有 outcome edges，結果也必須成立。
- 每個私人任務都列出至少一個 `mainlineFallbackOperationId`，且該 operation 的 unlock graph 不得依賴 private fact。
- audience 必填且只能使用允許的 schema。
- `broadcast`/`direct` 與 intent/audience 的組合符合規則；main1 完成前不存在 direct，所有 private task manifest 都明確要求 `main1Completed`，第一個 private task 前至少有兩則 rapport，且每兩個 private task/manipulation 之間 `rapportSincePressure >= 1`。
- 內容 ID 唯一；觸發條件不形成無法到達或循環依賴。
- 六個私人任務各只能建立一次。
- operation manifest 的每個 effect target 都必須存在；從固定初始 facts traversal 時，四個成功節點都必須可達。移除 `kind: 'private'` 的 edges 後，兩個 `neutral_finale` commit edge 仍必須可達並能把 pending mission 原子記為 skipped。
- 每個 ending fixture 都必須產生 3～5 個 debrief item，且每個 item 的 fact 都能在 debrief catalog 找到 `surfaceClaim`、`actualEffect` 與至少一個 `verificationEntryId`。

### 12.2 單元測試

- audience 的 `both/host/guest/playerId` 正規化與拒絕案例。
- A/B/playerId 的事件隔離、獨立 cursor 和重編序號。
- property test 驗證每個 transaction 對每名玩家皆滿足「canonical projection 改變 iff cursor 恰增 1 且存在一個 envelope」，並驗證提交失敗時 projection、stream 與 cursor 全部回滾。
- 私人事件不改變非目標玩家的 snapshot。
- 文件角色版本、解鎖條件、替代路徑與 deterministic 句庫。
- `directDialogueState` 的 rapport 門檻、anomaly 前置條件、`rapportSincePressure` 歸零／累加規則與 A/B 獨立選句。
- broadcast seed 不含 playerId，兩端解析成相同文字；direct seed 包含 playerId，兩端可解析成不同文字。
- 五種結局的優先順序與 3～5 項 debrief 因果紀錄。
- 覆蓋真相公開同時符合單人條件、A/B 單人條件嘗試同時成立、單人條件同時符合共同脫離，以及全部私人任務略過的案例；A/B 單人條件因互斥 fact 不得同時成立。

### 12.3 整合測試

- WebSocket 必須使用 cookie 身份，拒絕 role/playerId spoofing。
- A 的私人事件不改變 B 的 cursor、事件集合或 canonical state hash，反向亦同。heartbeat、自然倒數和固定 polling response 數量只當傳輸 baseline，不當作事件存在的判斷依據。
- 公開事件能送達雙方，斷線後按各自 cursor 補送且不重複。
- `AI_BROADCAST` 對兩名玩家具有相同 eventId、contentId 與文字；`AI_DIRECT` 只改變目標玩家的 directDialogueState 與串流。
- invalid、future 與 retention-gap cursor 都會要求 GET `/state`；完成 snapshot resync 前，WebSocket event 不得寫入 reducer。
- 重新整理只恢復自己的私人對話、文件版本、任務和操作紀錄。
- REST action 重送不會重複建立事件或改寫結局事實。

### 12.4 端對端測試

- 兩個 browser context 同時遊玩，能看到不同文件、私人對話和私人任務。
- 開場三則 AI 公告在兩個 context 完全一致；完成第一個共同謎題前，兩邊都沒有私人 AI 對話。
- main1 後，各角色先收到兩則私人閒聊，再由不同個人操作觸發私人任務；另一方畫面不顯示任何對應變化。
- 雙方透過交叉溝通能發現每個關鍵矛盾，且不執行私人任務仍可完成共同主線。
- 桌面雙螢幕與 390px 手機切換模式沒有水平溢位，主要操作可用鍵盤完成。
- `prefers-reduced-motion` 下 CSS 與 JavaScript 動態皆停用，必要內容立即可讀。
- 模擬 WebSocket 中斷、REST 重試與頁面重新整理後，狀態一致且私人資料不外洩。

### 12.5 人工劇情 QA

- 兩名測試者分開遊玩，確認不看對方畫面也能形成合理但不同的理解。
- 每個誤導在結局回顧後都能被理解，不讓玩家認為只是隨機騙人。
- 各章節兩名玩家同時有可執行的工作，不讓其中一方長時間等待。
- AI 的親近感循序增加，挑撥不會在玩家尚未看到異常證據前突然出現。

## 13. 第一版不包含

- Three.js 或完整 3D 電腦桌面。
- 生成式 AI API、自由文字理解或動態生成謎題。
- 語音辨識、即時語音通話或聲紋分析。
- 伺服器重啟後的房間持久化。
- 中途淘汰、永久封鎖另一名玩家或讓私人任務直接結束遊戲。

## 14. 完成定義

本階段只有在以下條件同時成立時才算完成：

1. 雙螢幕工作站取代現有主要遊戲面板，桌面與手機皆可操作。
2. WebSocket 與 fallback polling 能同步公開事件，並完全隱藏私人事件的內容及存在。
3. Files、Terminal、Logs 至少各有一條實際探索流程。
4. 六個私人任務已接入共同劇情；刪除全部私人 operation edges 後仍能完成主線與提交撤離程序。
5. 資訊差異矩陣中的每個誤導都有可到達的交叉驗證來源。
6. 五種自動結局只在第二位玩家提交 `commit_finale` 時依過去操作產生，之後不可重算，並提供可理解的因果回顧。
7. 單元、整合、端對端、無障礙與低動態測試全部通過。
