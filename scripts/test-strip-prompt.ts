import {
  countFillersRough,
  isPromptContaminated,
  isUsableTranscript,
  stripPromptContamination,
} from "../src/lib/asr";

const bad = `Okay, this is one additional prompt. You are a strict verbatim speech-to-text engine. Transcribe ALL spoken English words exactly as heard. CRITICAL: - Keep every filler and hesitation: um, uh, uhh, er, ah, like, you know, so, actually, basically, kind of, sort of, I mean. - Do NOT clean up, summarize, paraphrase, polish, or omit hesitations. - Do NOT add commentary, labels, or quotation marks. - Output ONLY the transcript on one line. - If nothing intelligible: NO_SPEECH I'm just um and one other thing you are a strict verbatim speech-to-text engine. Transcribe all spoken English words exactly as heard. CRITICAL: Keep every filler and hesitation: um, uh, uhh, er, ah, like, you know, so, actually, basically, kind of, sort of, I mean. Do not clean up, summarize, paraphrase, polish, or omit hesitations. Do not add commentary, labels, or quotation marks. Output only the transcript on one line. If nothing intelligible: NO_SPEECH one other thing that I want to see is it expressly puts all the words you know um so it's all something in there. I'm going to tell you.`;

const cleaned = stripPromptContamination(bad);
console.log("cleaned:", cleaned);
console.log("contaminated?", isPromptContaminated(cleaned));
console.log("usable?", isUsableTranscript(cleaned));
console.log("fillers", countFillersRough(cleaned));

if (isPromptContaminated(cleaned) || !isUsableTranscript(cleaned)) {
  process.exit(2);
}
if (!/i'm just um/i.test(cleaned)) {
  console.error("missing expected spoken phrase");
  process.exit(2);
}
console.log("strip test PASS");
