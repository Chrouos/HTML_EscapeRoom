const fs = require('node:fs');

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Pattern not found in ${path}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Pattern not unique in ${path}`);
  fs.writeFileSync(path, source.slice(0, index) + to + source.slice(index + from.length));
}

replaceOnce(
  'game/privateEventEngine.js',
  "  if (!normalized || room?.ending || !room?.publicFacts?.includes('main1Completed')) return false;",
  "  if (!normalized || !room?.players?.A || !room?.players?.B || room?.ending\n    || !room?.publicFacts?.includes('main1Completed')) return false;"
);

replaceOnce(
  'realtime/liveHub.js',
  "        const currentTime = now();\n        if (!shouldTriggerIdleObservation(room, actor.role, currentTime)) return;",
  "        const occupant = room.players?.[actor.role];\n        if (!occupant || occupant.playerId !== actor.playerId) {\n          socket.close(1008);\n          return;\n        }\n        const currentTime = now();\n        if (!shouldTriggerIdleObservation(room, actor.role, currentTime)) return;"
);

fs.unlinkSync(__filename);
