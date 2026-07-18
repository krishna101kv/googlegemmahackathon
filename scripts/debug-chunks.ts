import fs from "fs";
import {
  ASR_SYSTEM_PROMPT,
  VERBATIM_ASR_PROMPT,
  countFillersRough,
  isUsableTranscript,
  sliceWavPcm16Mono,
  stitchChunkTranscripts,
  stripPromptContamination,
} from "../src/lib/asr";
import { prepareWavForGemma } from "../src/lib/audioPrep";

const src =
  process.argv[2] ??
  "c:/Users/panki/Downloads/c2957a50-b910-4a02-a654-15eba34d1eea.wav";

async function asr(wav: Buffer) {
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma4:12b",
      stream: false,
      think: false,
      messages: [
        { role: "system", content: ASR_SYSTEM_PROMPT },
        {
          role: "user",
          content: VERBATIM_ASR_PROMPT,
          images: [wav.toString("base64")],
        },
      ],
      options: {
        temperature: 0,
        num_predict: 220,
        repeat_penalty: 1.05,
        num_ctx: 8192,
      },
    }),
  });
  const j = (await res.json()) as { message?: { content?: string } };
  return stripPromptContamination(j.message?.content ?? "");
}

async function main() {
  const prepared = prepareWavForGemma(fs.readFileSync(src));
  const parts: string[] = [];
  const chunkLen = 4;
  const overlap = 1;
  for (
    let start = 0;
    start < prepared.durationSeconds;
    start += chunkLen - overlap
  ) {
    const dur = Math.min(chunkLen, prepared.durationSeconds - start);
    if (dur < 1.2) break;
    const text = await asr(sliceWavPcm16Mono(prepared.wav, start, dur));
    console.log(
      `[${start.toFixed(1)}-${(start + dur).toFixed(1)}] f=${countFillersRough(text)} | ${text}`,
    );
    if (isUsableTranscript(text)) parts.push(text);
  }
  const stitched = stitchChunkTranscripts(parts);
  console.log("\nSTITCHED f=" + countFillersRough(stitched));
  console.log(stitched);

  const fullRes = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemma4:12b",
      stream: false,
      think: false,
      messages: [
        { role: "system", content: ASR_SYSTEM_PROMPT },
        {
          role: "user",
          content: VERBATIM_ASR_PROMPT,
          images: [prepared.wav.toString("base64")],
        },
      ],
      options: {
        temperature: 0,
        num_predict: 900,
        repeat_penalty: 1.05,
        num_ctx: 8192,
      },
    }),
  });
  const fullJson = (await fullRes.json()) as { message?: { content?: string } };
  const full = stripPromptContamination(fullJson.message?.content ?? "");
  console.log("\nFULL f=" + countFillersRough(full));
  console.log(full);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
