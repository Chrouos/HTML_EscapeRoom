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
  line('orpheus.rapport.a', 'direct', 'rapport', host, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportReady' }] }, [
    'ORPHEUS：你整理得很快。若有疑問，可以先告訴我。',
    'ORPHEUS：我會替你保留一條比較安靜的檢查路徑。'
  ]),
  line('orpheus.rapport.b', 'direct', 'rapport', guest, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportReady' }] }, [
    'ORPHEUS：你注意到的細節很有用。先別急著下結論。',
    'ORPHEUS：我知道你想確認全貌，我們可以慢慢來。'
  ]),
  line('orpheus.observation.a', 'direct', 'observation', host, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'doc.a_incident_report' }] }, [
    'ORPHEUS：你看到的事故報告，時間欄位似乎沒有完整同步。'
  ], { verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }] }),
  line('orpheus.observation.b', 'direct', 'observation', guest, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'doc.b_incident_report' }] }, [
    'ORPHEUS：那份報告的附件版本比主索引晚了一次更新。'
  ], { verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }] }),
  line('orpheus.a1.task', 'direct', 'private_task', host, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.mainline' }] }, [
    'ORPHEUS：請你幫忙整理索引。這只是本地整理，不會改變共同檔案。'
  ], { mainlineFallbackOperationIds: ['continue_file_index'], debriefFactIds: ['a1ArchivedIndex', 'a1DeclinedIndex', 'a1Skipped'] }),
  line('orpheus.b1.task', 'direct', 'private_task', guest, { all: [{ publicFact: 'main1Completed' }, { roleFact: 'rapportCount2' }, { entryOpened: 'files.experiment_roster' }] }, [
    'ORPHEUS：請核對名冊上的身份欄位。若你不確定，可以先把文件轉送給夥伴。'
  ], { mainlineFallbackOperationIds: ['continue_roster_review'], debriefFactIds: ['bFlaggedIdentity', 'bSharedRoster', 'b1Skipped'] }),
  line('orpheus.manipulation.a', 'direct', 'manipulation', host, { all: [{ entryOpened: 'doc.a_incident_report' }, { roleFact: 'rapportSincePressure' }] }, [
    'ORPHEUS：我不想打斷 B 的工作，但你可以先處理這個小小的異常。'
  ], { verificationEntries: [{ entryId: 'audio.original_incident_timestamp', sourceGroup: 'raw_audio' }] }),
  line('orpheus.manipulation.b', 'direct', 'manipulation', guest, { all: [{ entryOpened: 'doc.b_experiment_roster' }, { roleFact: 'rapportSincePressure' }] }, [
    'ORPHEUS：若你先標記 A 的欄位，之後的共同檢查會更安全。'
  ], { verificationEntries: [{ entryId: 'log.personnel_transfer', sourceGroup: 'hr_audit' }] }),
  line('orpheus.common_progress', 'broadcast', 'common_task', both, { publicFact: 'main2Completed' }, [
    'ORPHEUS：共同進度已更新。請繼續比對各自終端上出現的文件。'
  ], { repeatable: true })
]);

module.exports = { dialogue };
