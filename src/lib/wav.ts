/**
 * Convert an audio Blob (webm/ogg/mp4 from MediaRecorder) to 16 kHz mono WAV.
 * Gemma 4 / Ollama audio path expects RIFF WAV at 16 kHz mono.
 */
export async function blobToWav16kMono(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  await audioContext.close();

  const targetRate = 16000;
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * targetRate),
    targetRate,
  );

  const source = offline.createBufferSource();
  // Mixdown to mono if needed
  const monoBuffer = offline.createBuffer(
    1,
    decoded.length,
    decoded.sampleRate,
  );
  const mixed = monoBuffer.getChannelData(0);
  const channelCount = decoded.numberOfChannels;
  for (let i = 0; i < decoded.length; i++) {
    let sum = 0;
    for (let c = 0; c < channelCount; c++) {
      sum += decoded.getChannelData(c)[i];
    }
    mixed[i] = sum / channelCount;
  }

  source.buffer = monoBuffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);
  return encodeWav(samples, targetRate);
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
