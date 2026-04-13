import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.cwd(), "mock-audio");
const totalPerType = 100;

function makeWavBuffer({ freq = 440, durationSec = 0.25, sampleRate = 8000, amplitude = 0.15 }) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * amplitude;
    const int16 = Math.max(-1, Math.min(1, sample)) * 32767;
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  return buffer;
}

fs.mkdirSync(outDir, { recursive: true });

for (let i = 1; i <= totalPerType; i += 1) {
  const fileA = `A_${String(i).padStart(3, "0")}.wav`;
  const fileB = `B_${String(i).padStart(3, "0")}.wav`;

  fs.writeFileSync(path.join(outDir, fileA), makeWavBuffer({ freq: 420 + (i % 20) }));
  fs.writeFileSync(path.join(outDir, fileB), makeWavBuffer({ freq: 520 + (i % 20) }));
}

console.log(`Generated ${totalPerType * 2} files in ${outDir}`);
