/**
 * Validate ASR quality on a WAV before claiming a fix.
 * Usage: npx tsx scripts/validate-asr-wav.ts <path-to.wav>
 */
import fs from "fs";
import {
  countFillersRough,
  isFailedAsrText,
  isPromptContaminated,
  isUsableTranscript,
} from "../src/lib/asr";
import { evaluateSpeechWithGemma } from "../src/lib/gemma";

const wavPath =
  process.argv[2] ??
  "c:/Users/panki/Downloads/c2957a50-b910-4a02-a654-15eba34d1eea.wav";

async function main() {
  console.log("Validating:", wavPath);
  const { evaluation, audioMeta } = await evaluateSpeechWithGemma({
    wavBase64: fs.readFileSync(wavPath).toString("base64"),
    speechType: "prepared",
    goal: "reduce_fillers",
    preferMode: "local",
  });

  const t = evaluation.transcript;
  const fillers = countFillersRough(t);

  console.log("\n--- RESULT ---");
  console.log("audioMeta", audioMeta);
  console.log("confidence", evaluation.transcriptionConfidence);
  console.log("contaminated?", isPromptContaminated(t));
  console.log("fillers≈", fillers);
  console.log("transcript:\n", t);

  const failures: string[] = [];
  if (!isUsableTranscript(t)) failures.push("transcript not usable");
  if (isPromptContaminated(t)) failures.push("ASR prompt leaked into transcript");
  if (isFailedAsrText(t)) failures.push("failed-ASR markers present");
  if (/\b(CRITICAL:|speech-to-text engine|formatting the answer)\b/i.test(t)) {
    failures.push("instruction boilerplate still present");
  }
  if (/\bich kann\b/i.test(t)) failures.push("non-English hallucination");
  if (t.length < 20) failures.push("transcript too short");
  if (fillers < 1) failures.push("expected at least one filler (um/uh/…)");
  // Anchor phrases from this known clip (spoken content after prompt reading)
  if (!/\b(one other thing|tell you|words)\b/i.test(t)) {
    failures.push("missing expected spoken content anchors");
  }

  if (failures.length) {
    console.error("\nVALIDATION FAILED:");
    for (const f of failures) console.error(" -", f);
    process.exit(2);
  }

  console.log("\nVALIDATION PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
