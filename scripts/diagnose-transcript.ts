import fs from "fs";
import path from "path";
import { evaluateSpeechWithGemma, buildUserPrompt, buildSystemPrompt } from "../src/lib/gemma";
import { ollamaFormatSchema } from "../src/lib/schema";

const wavPath =
  process.argv[2] ??
  "c:/Users/panki/Downloads/d066e6fa-9051-40c8-a3a6-a6975ea6723f.wav";

const buffer = fs.readFileSync(wavPath);
const sampleRate = buffer.readUInt32LE(24);
const channels = buffer.readUInt16LE(22);
const bits = buffer.readUInt16LE(34);
const dataSize = buffer.length - 44;
const duration = dataSize / (sampleRate * channels * (bits / 8));
const base64 = buffer.toString("base64");

console.log("=== WAV ===");
console.log({
  path: wavPath,
  bytes: buffer.length,
  sampleRate,
  channels,
  bits,
  durationSec: Number(duration.toFixed(2)),
});

async function pureTranscribe() {
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? "gemma4:latest",
      stream: false,
      think: false,
      messages: [
        {
          role: "user",
          content:
            "Transcribe the following speech segment in its original language. Follow these specific instructions for formatting the answer:\n* Only output the transcription, with no newlines.\n* When transcribing numbers, write the digits, i.e. write 1.7 and not one point seven, and write 3 instead of three.",
          images: [base64],
        },
      ],
      options: { temperature: 0.1, num_ctx: 8192, num_predict: 1024 },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return String(data.message?.content ?? "");
}

async function coachingCall() {
  const { evaluation, inferenceMode } = await evaluateSpeechWithGemma({
    wavBase64: base64,
    speechType: "prepared",
    goal: "reduce_fillers",
    preferMode: "local",
  });
  return { evaluation, inferenceMode };
}

async function main() {
  console.log("\n=== Pure ASR prompt (Gemma cookbook style) ===");
  const asr = await pureTranscribe();
  console.log("ASR transcript:\n", asr);

  console.log("\n=== App coaching call (structured JSON) ===");
  const { evaluation, inferenceMode } = await coachingCall();
  console.log("inferenceMode:", inferenceMode);
  console.log("transcriptionConfidence:", evaluation.transcriptionConfidence);
  console.log("overallScore:", evaluation.overallScore);
  console.log("coaching transcript:\n", evaluation.transcript);

  const out = path.join(process.cwd(), "data", "diagnose-last.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        wavPath,
        duration,
        pureAsr: asr,
        coaching: evaluation,
      },
      null,
      2,
    ),
  );
  console.log("\nWrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
