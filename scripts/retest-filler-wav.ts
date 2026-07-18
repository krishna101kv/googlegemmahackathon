import fs from "fs";
import { countFillersRough } from "../src/lib/asr";
import { evaluateSpeechWithGemma } from "../src/lib/gemma";

const wavPath =
  process.argv[2] ??
  "c:/Users/panki/Downloads/f87b29ff-37dd-4284-881d-785e0a4534ef.wav";

async function main() {
  const { evaluation, audioMeta } = await evaluateSpeechWithGemma({
    wavBase64: fs.readFileSync(wavPath).toString("base64"),
    speechType: "prepared",
    goal: "reduce_fillers",
    preferMode: "local",
  });

  const fillers = countFillersRough(evaluation.transcript);
  console.log("audioMeta", audioMeta);
  console.log("fillers≈", fillers);
  console.log("confidence", evaluation.transcriptionConfidence);
  console.log("transcript:\n", evaluation.transcript);
  console.log(
    "metrics hint — fillerControl score from coach:",
    evaluation.scores.fillerControl,
  );

  if (fillers < 1) {
    console.error("FAIL: expected um/uh fillers in this clip");
    process.exit(2);
  }
  console.log("PASS: fillers detected in transcript");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
