import JSZip from "jszip";

function makeWavBuffer({ freq = 440, durationSec = 0.25, sampleRate = 8000, amplitude = 0.15 }) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
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

export async function GET() {
  const zip = new JSZip();

  for (let i = 1; i <= 100; i += 1) {
    zip.file(`A_${String(i).padStart(3, "0")}.wav`, makeWavBuffer({ freq: 420 + (i % 20) }));
    zip.file(`B_${String(i).padStart(3, "0")}.wav`, makeWavBuffer({ freq: 520 + (i % 20) }));
  }

  const content = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="mock-audio-pack.zip"',
    },
  });
}
