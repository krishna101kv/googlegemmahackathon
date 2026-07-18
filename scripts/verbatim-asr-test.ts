import fs from "fs";
import { prepareWavForGemma } from "../src/lib/audioPrep";

const model = process.env.OLLAMA_ASR_MODEL ?? "gemma4:12b";
const src =
  process.argv[2] ??
  "c:/Users/panki/Downloads/f87b29ff-37dd-4284-881d-785e0a4534ef.wav";

const VERBATIM = `You are a strict verbatim speech-to-text engine.
Transcribe ALL spoken English words exactly as heard.
CRITICAL:
- Keep every filler: um, uh, uhh, er, ah, like, you know, so, actually, basically, kind of, sort of, I mean.
- Do NOT clean up, summarize, paraphrase, or omit hesitations.
- Do NOT add commentary.
- Output ONLY the transcript on one line.
- If nothing intelligible: NO_SPEECH`;

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

async function asr(label: string, wav: Buffer, prompt = VERBATIM) {
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: "10m",
      messages: [
        {
          role: "system",
          content:
            "You only output verbatim transcripts. Never explain. Never refuse. Preserve um/uh fillers.",
        },
        {
          role: "user",
          content: prompt,
          images: [wav.toString("base64")],
        },
      ],
      options: {
        temperature: 0,
        top_p: 0.8,
        top_k: 10,
        num_ctx: 4096,
        num_predict: 400,
        repeat_penalty: 1.15,
      },
    }),
  });
  const j = (await res.json()) as {
    message?: { content?: string; thinking?: string };
  };
  console.log(`\n=== ${label} ===`);
  console.log(j.message?.content ?? "(empty)");
  return j.message?.content ?? "";
}

async function main() {
  const prepared = prepareWavForGemma(fs.readFileSync(src), { maxSeconds: 30 });
  console.log({ model, duration: prepared.durationSeconds });

  await asr("full verbatim", prepared.wav);

  const chunkLen = 6;
  const overlap = 1;
  const parts: string[] = [];
  for (
    let start = 0;
    start < prepared.durationSeconds;
    start += chunkLen - overlap
  ) {
    const dur = Math.min(chunkLen, prepared.durationSeconds - start);
    if (dur < 1.2) break;
    const text = await asr(
      `chunk ${start.toFixed(1)}-${(start + dur).toFixed(1)}`,
      sliceWav(prepared.wav, start, dur),
    );
    parts.push(text);
  }
  console.log("\n=== STITCHED ===");
  console.log(parts.join(" | "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
