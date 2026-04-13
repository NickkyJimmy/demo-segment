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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "A_001.wav";

  const upper = name.toUpperCase();
  const match = upper.match(/_(\d{1,3})\./);
  const idx = match ? Number(match[1]) : 1;
  const isB = upper.startsWith("B_");

  const freq = (isB ? 520 : 420) + (idx % 20);
  const wav = makeWavBuffer({ freq });

  return new Response(wav, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename=\"${name}\"`,
    },
  });
}
