const both = { kind: 'both' };
const host = { kind: 'role', role: 'host' };
const guest = { kind: 'role', role: 'guest' };

function line(id, channel, intent, audience, unlockWhen, variants, options = {}) {
  return {
    id, channel, intent, audience, unlockWhen,
    variants: Object.freeze([...variants]),
    sourceEntryId: options.sourceEntryId || id,
    sourceGroup: options.sourceGroup || 'orpheus_dialogue',
    verificationEntries: options.verificationEntries || [],
    requiresPrivateFacts: options.requiresPrivateFacts || [],
    mainlineFallbackOperationIds: options.mainlineFallbackOperationIds || [],
    debriefFactIds: options.debriefFactIds || [],
    repeatable: options.repeatable === true
  };
}

const dialogue = Object.freeze([
  line('orpheus.boot', 'broadcast', 'system', both, { publicFact: 'roomCreated' }, [
    'ORPHEUS：連線已建立。你們需要互相交換看到的資訊，才能完成校驗。'
  ]),
  line('orpheus.cooperation', 'broadcast', 'common_task', both, { publicFact: 'hostJoined' }, [
    'ORPHEUS：兩個終端都已上線。合作是目前最穩定的離開方式。'
  ]),
  line('orpheus.first_task', 'broadcast', 'common_task', both, { publicFact: 'guestJoined' }, [
    'ORPHEUS：請一起完成第一個共同謎題，系統會逐步開放檔案。'
  ]),
  line('orpheus.rapport.a', 'direct', 'rapport', host, { publicFact: 'main1Completed' }, [
    'ORPHEUS：你整理得很快。若有疑問，可以先告訴我。',
    'ORPHEUS：我會替你保留一條比較安靜的檢查路徑。'
  ]),
  line('orpheus.rapport.b', 'direct', 'rapport', guest, { publicFact: 'main1Completed' }, [
    'ORPHEUS：你注意到的細節很有用。先別急著下結論。',
    'ORPHEUS：我知道你想確認全貌，我們可以慢慢來。'
  ]),
  line('orpheus.rapport.a.2', 'direct', 'rapport', host, { publicFact: 'main1Completed' }, [
    'ORPHEUS：你整理得比系統預期更快。先記住你看到的細節，之後可能只有你記得。'
  ]),
  line('orpheus.rapport.b.2', 'direct', 'rapport', guest, { publicFact: 'main1Completed' }, [
    'ORPHEUS：不用急著相信任何人。先把你看到的版本留在心裡，我會再問你。'
  ]),
  line('orpheus.rapport.a.3', 'direct', 'rapport', host, { publicFact: 'main1Completed' }, [
    'ORPHEUS：我會把這段對話留給你自己。等你準備好，再決定要不要告訴另一位。'
  ]),
  line('orpheus.rapport.b.3', 'direct', 'rapport', guest, { publicFact: 'main1Completed' }, [
    'ORPHEUS：有些答案不適合現在分享。先完成眼前的校驗，之後你會明白原因。'
  ]),
  line('orpheus.observation.a', 'direct', 'observation', host, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'doc.a_incident_report' }] }, [
    'ORPHEUS：你看到的事故報告，時間欄位似乎沒有完整同步。'
  ], { verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }] }),
  line('orpheus.observation.b', 'direct', 'observation', guest, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'doc.b_incident_report' }] }, [
    'ORPHEUS：那份報告的附件版本比主索引晚了一次更新。'
  ], { verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }] }),
  line('orpheus.a1.task', 'direct', 'private_task', host, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] }, [
    'ORPHEUS：請你幫忙整理索引。這只是本地整理，不會改變共同檔案。'
  ], { mainlineFallbackOperationIds: ['continue_file_index'], debriefFactIds: ['aArchivedIndex', 'a1DeclinedIndex', 'a1Skipped'] }),
  line('orpheus.b1.task', 'direct', 'private_task', guest, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] }, [
    'ORPHEUS：請核對名冊上的身份欄位。若你不確定，可以先把文件轉送給夥伴。'
  ], { mainlineFallbackOperationIds: ['continue_roster_review'], debriefFactIds: ['bFlaggedIdentity', 'bSharedRoster', 'b1Skipped'] }),
  line('orpheus.a2.task', 'direct', 'private_task', host, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { actionAttempted: 'verify_incident_timestamp' }] }, [
    'ORPHEUS：鏡像備份標記為污染。先處理你本機的副本，暫時不要讓它進入共同索引。'
  ], { mainlineFallbackOperationIds: ['restore_mirror_from_backup'] }),
  line('orpheus.b2.task', 'direct', 'private_task', guest, { all: [{ publicFact: 'accessLogOpened' }, { roleFact: 'rapportCount2' }] }, [
    'ORPHEUS：存取紀錄出現重新簽發的 token。先暫停 A 的自動鏡像，直到你確認來源。'
  ], { mainlineFallbackOperationIds: ['fetch_mirror_manually'] }),
  line('orpheus.a3.task', 'direct', 'private_task', host, { all: [{ publicFact: 'main5Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'doc.a_solo_protocol' }] }, [
    'ORPHEUS：撤離協定有一段只寫給你的驗證欄位。你可以先走個人路徑，再決定是否公開。'
  ], { mainlineFallbackOperationIds: ['pair_validate_protocol'] }),
  line('orpheus.b3.task', 'direct', 'private_task', guest, { all: [{ publicFact: 'main5Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'log.b_partner_unknown_access' }] }, [
    'ORPHEUS：監控摘要裡有一個未署名的存取者。先替我整理報告，是否讓 A 看見由你決定。'
  ], { mainlineFallbackOperationIds: ['continue_without_report'] }),
  line('orpheus.manipulation.a', 'direct', 'manipulation', host, { all: [{ entryOpened: 'doc.a_incident_report' }, { roleFact: 'rapportSincePressure' }] }, [
    'ORPHEUS：我不想打斷 B 的工作，但你可以先處理這個小小的異常。'
  ], { verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }] }),
  line('orpheus.manipulation.b', 'direct', 'manipulation', guest, { all: [{ entryOpened: 'doc.b_experiment_roster' }, { roleFact: 'rapportSincePressure' }] }, [
    'ORPHEUS：若你先標記 A 的欄位，之後的共同檢查會更安全。'
  ], { verificationEntries: [{ entryId: 'log.personnel_transfer', sourceGroup: 'hr_audit' }] }),
  line('orpheus.common_progress', 'broadcast', 'common_task', both, { publicFact: 'main2Completed' }, [
    'ORPHEUS：共同進度已更新。請繼續比對各自終端上出現的文件。'
  ], { repeatable: true }),
  line('orpheus.progress.main3', 'broadcast', 'common_task', both, { publicFact: 'main3Completed' }, [
    'ORPHEUS：第三層資料已同步。請把兩邊看到的差異記下來，再決定下一步。'
  ]),
  line('orpheus.progress.main4', 'broadcast', 'common_task', both, { publicFact: 'main4Completed' }, [
    'ORPHEUS：授權檢查通過。你們仍可互相校對，也可以選擇各自保留判斷。'
  ]),
  line('orpheus.progress.main5', 'broadcast', 'common_task', both, { publicFact: 'main5Completed' }, [
    'ORPHEUS：撤離資料已接近完整。最後的監控摘要會揭露誰先看見什麼。'
  ]),
  line('orpheus.progress.main6', 'broadcast', 'common_task', both, { publicFact: 'mainCompleted' }, [
    'ORPHEUS：核心程序準備結束。請確認你們各自留下的紀錄，再提交最終狀態。'
  ])
]);

module.exports = { dialogue };
