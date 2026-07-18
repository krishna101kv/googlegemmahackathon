import fs from "fs";
import { evaluateSpeechWithGemma } from "../src/lib/gemma";
import { isLoopedOrGibberishTranscript } from "../src/lib/transcriptQuality";

const wavPath =
  process.argv[2] ??
  "c:/Users/panki/Downloads/d066e6fa-9051-40c8-a3a6-a6975ea6723f.wav";

async function main() {
  const wavBase64 = fs.readFileSync(wavPath).toString("base64");
  console.log("Running ASR-then-coach on", wavPath);
  try {
    const { evaluation, audioMeta } = await evaluateSpeechWithGemma({
      wavBase64,
      speechType: "prepared",
      goal: "reduce_fillers",
      preferMode: "local",
    });
    console.log("audioMeta", audioMeta);
    console.log("confidence", evaluation.transcriptionConfidence);
    console.log("looped?", isLoopedOrGibberishTranscript(evaluation.transcript));
    console.log("transcript:\n", evaluation.transcript);
    console.log("score", evaluation.overallScore);
  } catch (error) {
    console.error(
      "FAILED (expected if ASR cannot decode):",
      error instanceof Error ? error.message : error,
    );
    process.exit(2);
  }
}

main();
