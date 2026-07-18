import fs from "fs";
import { prepareWavForGemma } from "../src/lib/audioPrep";

const model = process.env.OLLAMA_MODEL ?? "gemma4:latest";
const src =
  process.argv[2] ??
  "c:/Users/panki/Downloads/d066e6fa-9051-40c8-a3a6-a6975ea6723f.wav";

function sliceWav(pcmMono16k: Buffer, startSec: number, durSec: number) {
  const start = 44 + Math.floor(startSec * 16000) * 2;
  const end = Math.min(
    pcmMono16k.length,
    44 + Math.floor((startSec + durSec) * 16000) * 2,
  );
  const data = pcmMono16k.subarray(start, end);
  const out = Buffer.alloc(44 + data.length);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data.length, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16000, 24);
  out.writeUInt32LE(32000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(data.length, 40);
  data.copy(out, 44);
  return out;
}

async function asr(label: string, wav: Buffer, useModel = model) {
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: useModel,
      stream: false,
      think: false,
      messages: [
        {
          role: "user",
          content:
            "Transcribe the following speech segment in English into English text. Only output the transcription, with no newlines. If unintelligible output NO_SPEECH.",
          images: [wav.toString("base64")],
        },
      ],
      options: {
        temperature: 0,
        num_predict: 200,
        repeat_penalty: 1.4,
        num_ctx: 4096,
      },
    }),
  });
  const j = (await res.json()) as { message?: { content?: string } };
  console.log(`[${useModel}] ${label}:`, j.message?.content ?? "(empty)");
}

async function main() {
  const prepared = prepareWavForGemma(fs.readFileSync(src));
  console.log("prepared", {
    duration: prepared.durationSeconds,
    amplified: prepared.amplified,
  });

  await asr("full", prepared.wav);
  await asr("0-10s", sliceWav(prepared.wav, 0, 10));
  await asr("10-20s", sliceWav(prepared.wav, 10, 10));
  await asr("20-28s", sliceWav(prepared.wav, 20, 8));

  // Also try 12b if present
  try {
    await asr("0-10s", sliceWav(prepared.wav, 0, 10), "gemma4:12b");
  } catch (e) {
    console.log("12b skip", e);
  }

  await asr("cookbook", prepareWavForGemma(fs.readFileSync("public/demo/sample-speech.wav")).wav);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
