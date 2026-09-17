// Rebuild the puzzle recording without an external audio dependency.
const fs = require('node:fs');
const path = require('node:path');
const rate = 16000;
const unit = 0.12;
const samples = [];
function segment(units, tone = false) {
  const length = Math.round(rate * unit * units);
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, i / 80, (length - i - 1) / 80);
    samples.push(tone ? Math.round(Math.sin(2 * Math.PI * 650 * i / rate) * 10000 * fade) : 0);
  }
}
segment(4);
for (const letter of ['.--.', '---', '.--', '.', '.-.']) {
  for (const signal of letter) {
    segment(signal === '.' ? 1 : 3, true);
    segment(1);
  }
  segment(2);
}
segment(4);
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
samples.forEach((sample, index) => wav.writeInt16LE(sample, 44 + index * 2));
fs.writeFileSync(path.join(__dirname, '../public/audio/emergency-morse.wav'), wav);
