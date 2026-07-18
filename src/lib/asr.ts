import { isLoopedOrGibberishTranscript } from "./transcriptQuality";

/**
 * English-forced verbatim ASR. Keep instructions out of the spoken domain
 * as much as possible; we also strip any echoed boilerplate after decode.
 */
export const VERBATIM_ASR_PROMPT = `Transcribe the following speech segment in English into English text.
Follow these specific instructions for formatting the answer:
* Only output the transcription, with no newlines.
* Keep every hesitation exactly as spoken: um, uh, uhh, er, ah, you know, kind of, sort of, I mean, basically, actually.
* Do not clean up, summarize, paraphrase, or omit those hesitations.
* When transcribing numbers, write the digits.
* If the audio is silent or unintelligible, output exactly: NO_SPEECH`;

export const ASR_SYSTEM_PROMPT =
  "You are an English speech recognizer. Output only the English transcript of the audio. Preserve um and uh. Do not translate. Do not explain.";

const PROMPT_LEAK_MARKERS = [
  "strict verbatim speech-to-text",
  "speech-to-text engine",
  "transcribe all spoken english",
  "transcribe the following speech segment",
  "keep every filler and hesitation",
  "keep every hesitation exactly",
  "do not clean up, summarize",
  "do not add commentary",
  "output only the transcript",
  "only output the transcription",
  "if nothing intelligible",
  "if the audio is silent",
  "follow these specific instructions",
  "formatting the answer",
  "never repeat these instructions",
  "you are an english speech recognizer",
];

const FAILURE_MARKERS = [
  "no audio",
  "cannot provide a transcript",
  "no audio file",
  "i can't help",
  "i cannot",
  "as an ai",
  "ich kann",
  "keine",
  "unintelligible feedback",
];

export function countFillersRough(text: string): number {
  const lower = ` ${text.toLowerCase()} `;
  const patterns = [
    /\bum\b/g,
    /\buh+\b/g,
    /\ber\b/g,
    /\bah\b/g,
    /\byou know\b/g,
    /\bkind of\b/g,
    /\bsort of\b/g,
    /\bi mean\b/g,
    /\bbasically\b/g,
    /\bactually\b/g,
  ];
  let count = 0;
  for (const p of patterns) count += lower.match(p)?.length ?? 0;
  return count;
}

export function normalizeAsrOutput(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^["']|["']$/g, "")
    .replace(/^\s*(transcript|verbatim)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPromptContaminated(text: string): boolean {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const marker of PROMPT_LEAK_MARKERS) {
    if (lower.includes(marker)) hits += 1;
  }
  return hits >= 2;
}

export function isFailedAsrText(text: string): boolean {
  const lower = text.toLowerCase();
  return FAILURE_MARKERS.some((m) => lower.includes(m));
}

export function stripPromptContamination(text: string): string {
  let out = normalizeAsrOutput(text);

  const blockPatterns = [
    /you are a strict verbatim speech-to-text engine[\s\S]*?(?:no_speech|one line\.?)/gi,
    /you are an english speech recognizer[\s\S]*?(?:explain\.?|uh\.?)/gi,
    /transcribe the following speech segment in english into english text\.?/gi,
    /follow these specific instructions for formatting the answer:?/gi,
    /only output the transcription, with no newlines\.?/gi,
    /keep every hesitation exactly as spoken:[^.]*\.?/gi,
    /keep every filler and hesitation:[^.]*\.?/gi,
    /do not clean up, summarize, paraphrase(?:\, polish)?,? or omit(?: those)? hesitations\.?/gi,
    /when transcribing numbers, write the digits\.?/gi,
    /do not add commentary, labels, or quotation marks\.?/gi,
    /output only the transcript on one line\.?/gi,
    /if nothing intelligible:\s*no_speech/gi,
    /if the audio is silent or unintelligible, output exactly:\s*no_speech/gi,
    /okay,?\s*this is one additional prompt\.?/gi,
  ];

  for (const pattern of blockPatterns) {
    out = out.replace(pattern, " ");
  }

  out = out
    .replace(/\bCRITICAL:\b/gi, " ")
    .replace(/\bNO_SPEECH\b/gi, " ")
    .replace(/\*\s*/g, " ")
    .replace(/\s*[-•]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return out;
}

export function isUsableTranscript(text: string): boolean {
  const cleaned = stripPromptContamination(text);
  if (!cleaned) return false;
  if (/^no[_\s-]?speech$/i.test(cleaned)) return false;
  if (isLoopedOrGibberishTranscript(cleaned)) return false;
  if (isFailedAsrText(cleaned)) return false;
  if (isPromptContaminated(cleaned)) return false;
  // Reject mostly non-Latin scripts (hallucinated other languages)
  const letters = cleaned.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length < 6) return false;
  return cleaned.split(/\s+/).length >= 3;
}

export function stitchChunkTranscripts(chunks: string[]): string {
  const usable = chunks
    .map((c) => stripPromptContamination(c))
    .filter((c) => isUsableTranscript(c));
  if (usable.length === 0) return "";
  if (usable.length === 1) return usable[0];

  let out = usable[0];
  for (let i = 1; i < usable.length; i++) {
    out = mergeOverlap(out, usable[i]);
  }
  return stripPromptContamination(out);
}

function mergeOverlap(left: string, right: string): string {
  const a = left.split(/\s+/);
  const b = right.split(/\s+/);
  const max = Math.min(12, a.length, b.length);
  for (let n = max; n >= 2; n--) {
    const tail = a.slice(-n).join(" ").toLowerCase();
    const head = b.slice(0, n).join(" ").toLowerCase();
    if (tail === head) return [...a, ...b.slice(n)].join(" ");
  }
  if (a[a.length - 1]?.toLowerCase() === b[0]?.toLowerCase()) {
    return [...a, ...b.slice(1)].join(" ");
  }
  return `${left} ${right}`;
}

export function pickBestTranscript(candidates: string[]): string | null {
  const scored = candidates
    .map((text) => stripPromptContamination(text))
    .filter((text) => isUsableTranscript(text))
    .map((text) => {
      const words = text.split(/\s+/).filter(Boolean).length;
      const fillers = countFillersRough(text);
      // Prefer longer coherent English with real hesitations
      const score = words * 3 + fillers * 8;
      return { text, score, fillers, words };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.text ?? null;
}

export function sliceWavPcm16Mono(
  wav: Buffer,
  startSec: number,
  durSec: number,
  sampleRate = 16000,
): Buffer {
  const start = 44 + Math.floor(startSec * sampleRate) * 2;
  const end = Math.min(
    wav.length,
    44 + Math.floor((startSec + durSec) * sampleRate) * 2,
  );
  const data = wav.subarray(start, end);
  const out = Buffer.alloc(44 + data.length);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data.length, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(data.length, 40);
  data.copy(out, 44);
  return out;
}
