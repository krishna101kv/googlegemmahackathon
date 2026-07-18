/**
 * Prepare WAV bytes for Gemma 4 audio encoder:
 * - ensure PCM16 mono
 * - amplify quiet clips toward a healthy peak
 * - trim to maxSeconds (Gemma audio is most reliable under ~30s)
 */
export function prepareWavForGemma(
  input: Buffer,
  options: { maxSeconds?: number; targetPeak?: number } = {},
): { wav: Buffer; durationSeconds: number; amplified: boolean; trimmed: boolean } {
  const maxSeconds = options.maxSeconds ?? 28;
  const targetPeak = options.targetPeak ?? 24000;

  if (input.subarray(0, 4).toString("ascii") !== "RIFF") {
    throw new Error("Audio is not a RIFF/WAV file.");
  }

  // Find data chunk (do not assume 44-byte header)
  let offset = 12;
  let channels = 1;
  let sampleRate = 16000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= input.length) {
    const id = input.subarray(offset, offset + 4).toString("ascii");
    const size = input.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (id === "fmt ") {
      channels = input.readUInt16LE(chunkStart + 2);
      sampleRate = input.readUInt32LE(chunkStart + 4);
      bitsPerSample = input.readUInt16LE(chunkStart + 14);
    } else if (id === "data") {
      dataOffset = chunkStart;
      dataSize = size;
      break;
    }
    offset = chunkStart + size + (size % 2);
  }

  if (dataOffset < 0) throw new Error("WAV data chunk not found.");
  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}. Expected 16-bit.`);
  }

  const bytesPerFrame = channels * 2;
  let frameCount = Math.floor(dataSize / bytesPerFrame);
  const maxFrames = Math.floor(maxSeconds * sampleRate);
  let trimmed = false;
  if (frameCount > maxFrames) {
    frameCount = maxFrames;
    trimmed = true;
  }

  // Mix to mono + measure peak
  const mono = new Int16Array(frameCount);
  let peak = 0;
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      sum += input.readInt16LE(dataOffset + i * bytesPerFrame + c * 2);
    }
    const sample = Math.round(sum / channels);
    mono[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  let amplified = false;
  let gain = 1;
  if (peak > 0 && peak < targetPeak * 0.55) {
    gain = Math.min(12, targetPeak / peak);
    amplified = gain > 1.05;
  }

  const outDataSize = frameCount * 2;
  const out = Buffer.alloc(44 + outDataSize);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + outDataSize, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(1, 22); // mono
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(outDataSize, 40);

  for (let i = 0; i < frameCount; i++) {
    let s = Math.round(mono[i] * gain);
    s = Math.max(-32768, Math.min(32767, s));
    out.writeInt16LE(s, 44 + i * 2);
  }

  return {
    wav: out,
    durationSeconds: frameCount / sampleRate,
    amplified,
    trimmed,
  };
}
