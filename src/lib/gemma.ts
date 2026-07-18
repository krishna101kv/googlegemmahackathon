import {
  ASR_SYSTEM_PROMPT,
  VERBATIM_ASR_PROMPT,
  countFillersRough,
  isPromptContaminated,
  isUsableTranscript,
  normalizeAsrOutput,
  pickBestTranscript,
  sliceWavPcm16Mono,
  stitchChunkTranscripts,
  stripPromptContamination,
} from "./asr";
import {
  coachEvaluationSchema,
  ollamaFormatSchema,
  type CoachEvaluationParsed,
} from "./schema";
import { prepareWavForGemma } from "./audioPrep";
import { isLoopedOrGibberishTranscript } from "./transcriptQuality";
import type { InferenceMode, PracticeGoal, SpeechType } from "./types";
import { GOAL_LABELS, SPEECH_TYPE_LABELS } from "./types";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
// Text coaching can stay on E4B; ASR prefers gemma4:12b.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:latest";
const OLLAMA_ASR_MODEL =
  process.env.OLLAMA_ASR_MODEL ?? "gemma4:12b";
const ASR_MODEL_CANDIDATES = [
  ...new Set([OLLAMA_ASR_MODEL, "gemma4:12b"].filter(Boolean)),
];
const GOOGLE_API_KEY =
  process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
const CLOUD_GEMMA_MODEL =
  process.env.CLOUD_GEMMA_MODEL ?? "gemma-4-e4b-it";
const INFERENCE_MODE = (process.env.INFERENCE_MODE ?? "local") as
  | "local"
  | "cloud"
  | "auto";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 180_000);
const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES ?? 1);

export function buildCoachSystemPrompt(): string {
  return `You are a supportive Toastmasters-style speech coach.
You are given an already-verified transcript of a practice speech. Evaluate delivery from that transcript.

Rules:
- Be coach-like, specific, and encouraging. Never harsh or sarcastic.
- Never judge accent, identity, personality, or intelligence.
- Frame confidence as a delivery impression, not a fact about the speaker.
- Never make medical, psychological, or diagnostic claims.
- Do NOT invent exact filler-word counts, WPM, or duration — the app computes those.
- Do NOT invent or rewrite the transcript. Copy the provided transcript into the transcript field EXACTLY.
- Every improvement area must include concrete evidence from the transcript.
- Keep scoring consistent: category scores 1-5, overallScore 0-100.
- Return ONLY valid JSON matching the required schema.`;
}

export function buildCoachUserPrompt(
  speechType: SpeechType,
  goal: PracticeGoal,
  transcript: string,
): string {
  const goalLine =
    goal === "none"
      ? "No specific focus goal was selected."
      : `Speaker focus goal: ${GOAL_LABELS[goal]}.`;

  return `Speech type: ${SPEECH_TYPE_LABELS[speechType]}.
${goalLine}

VERIFIED TRANSCRIPT (copy into JSON "transcript" exactly, character for character):
"""
${transcript}
"""

Evaluate this practice speech for Toastmasters-style delivery coaching.
Score each 1-5, plus overallScore 0-100:
- Clarity — is the message easy to follow?
- Pace — too slow, balanced, or rushed? (use wording cues only)
- Filler control — impression of um/uh/like/you know (do not invent exact counts)
- Structure — opening, body, close
- Confidence — delivery impression only, not the person
- Vocal variety — energy/emphasis cues from wording only

Also produce: strengths, improvement areas with evidence, drills, nextFocusArea, and transcriptionConfidence.
Return structured coaching JSON only.`;
}

/** @deprecated kept for tests/scripts that import the old name */
export function buildSystemPrompt(): string {
  return buildCoachSystemPrompt();
}

/** @deprecated */
export function buildUserPrompt(
  speechType: SpeechType,
  goal: PracticeGoal,
): string {
  return buildCoachUserPrompt(speechType, goal, "(transcript pending)");
}

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model response was not valid JSON");
    return JSON.parse(match[0]);
  }
}

async function ollamaChat(body: Record<string, unknown>): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as {
      message?: { content?: string };
    };
    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error("Ollama returned empty content. Is think mode disabled?");
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function asrOnce(
  model: string,
  wavBase64: string,
  numPredict = 512,
): Promise<string> {
  const raw = await ollamaChat({
    model,
    stream: false,
    think: false,
    keep_alive: "20m",
    messages: [
      { role: "system", content: ASR_SYSTEM_PROMPT },
      {
        role: "user",
        content: VERBATIM_ASR_PROMPT,
        images: [wavBase64],
      },
    ],
    options: {
      temperature: 0,
      top_p: 0.8,
      top_k: 10,
      num_ctx: 8192,
      num_predict: numPredict,
      // Keep modest — high repeat_penalty suppresses um/uh
      repeat_penalty: 1.08,
    },
  });
  return stripPromptContamination(normalizeAsrOutput(raw));
}

async function transcribeChunks(
  model: string,
  wav: Buffer,
  durationSeconds: number,
): Promise<string> {
  // Longer chunks bind audio more reliably on Ollama+Gemma
  const chunkLen = 8;
  const overlap = 1.5;
  const parts: string[] = [];

  for (let start = 0; start < durationSeconds; start += chunkLen - overlap) {
    const dur = Math.min(chunkLen, durationSeconds - start);
    if (dur < 2) break;
    const slice = sliceWavPcm16Mono(wav, start, dur);
    try {
      const text = await asrOnce(
        model,
        slice.toString("base64"),
        Math.min(400, Math.ceil(dur * 14)),
      );
      const cleaned = stripPromptContamination(text);
      if (isUsableTranscript(cleaned) && !isPromptContaminated(cleaned)) {
        parts.push(cleaned);
      } else {
        console.warn(
          `[gemma-asr] drop chunk ${start.toFixed(1)}-${(start + dur).toFixed(1)}: ${cleaned.slice(0, 80)}`,
        );
      }
    } catch (error) {
      console.warn(
        `[gemma-asr] chunk ${start}-${start + dur} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return stitchChunkTranscripts(parts);
}

async function transcribeWithOllama(wav: Buffer): Promise<string> {
  let lastError: Error | null = null;
  const durationSeconds = (wav.length - 44) / 32000;
  // ~3 tokens/word, ~2.5 words/sec speech → generous budget
  const fullPredict = Math.min(1200, Math.max(256, Math.ceil(durationSeconds * 12)));

  for (const model of ASR_MODEL_CANDIDATES) {
    try {
      const candidates: string[] = [];

      // 1) Full-pass verbatim
      try {
        const full = stripPromptContamination(
          await asrOnce(model, wav.toString("base64"), fullPredict),
        );
        if (isUsableTranscript(full) && !isPromptContaminated(full)) {
          candidates.push(full);
        } else {
          throw new Error(`Unusable full ASR: ${full.slice(0, 100)}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[gemma-asr] full via ${model}:`, lastError.message);
      }

      // 2) Overlapping chunks — better for long / prompt-heavy clips
      if (durationSeconds > 6) {
        const stitched = stripPromptContamination(
          await transcribeChunks(model, wav, durationSeconds),
        );
        if (isUsableTranscript(stitched) && !isPromptContaminated(stitched)) {
          candidates.push(stitched);
        }
      }

      const best = pickBestTranscript(candidates);
      if (best) {
        const finalText = stripPromptContamination(best);
        if (isPromptContaminated(finalText)) {
          throw new Error("Transcript still contains ASR instructions");
        }
        console.info(
          `[gemma-asr] ok via ${model}; fillers≈${countFillersRough(finalText)}; words=${finalText.split(/\s+/).length}`,
        );
        return finalText;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[gemma-asr] ${model}:`, lastError.message);
    }
  }

  throw new Error(
    lastError?.message?.includes("Looped") || lastError?.message === "NO_SPEECH"
      ? "Could not reliably transcribe this audio. Re-record clearly under 28 seconds; ensure gemma4:12b is pulled in Ollama."
      : (lastError?.message ?? "Transcription failed."),
  );
}

async function coachFromTranscriptWithOllama(
  transcript: string,
  speechType: SpeechType,
  goal: PracticeGoal,
): Promise<CoachEvaluationParsed> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await ollamaChat({
        model: OLLAMA_MODEL,
        stream: false,
        think: false,
        format: ollamaFormatSchema,
        messages: [
          { role: "system", content: buildCoachSystemPrompt() },
          {
            role: "user",
            content: buildCoachUserPrompt(speechType, goal, transcript),
          },
        ],
        options: {
          temperature: 0.2,
          top_p: 0.9,
          top_k: 40,
          num_ctx: 8192,
          num_predict: 1200,
        },
      });

      const evaluation = coachEvaluationSchema.parse(extractJson(raw));
      // Always prefer the verified ASR transcript over any model rewrite
      return {
        ...evaluation,
        transcript,
        transcriptionConfidence: evaluation.transcriptionConfidence,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === MAX_RETRIES) break;
    }
  }

  throw lastError ?? new Error("Coaching evaluation failed.");
}

async function evaluateLocalTwoStage(
  wav: Buffer,
  speechType: SpeechType,
  goal: PracticeGoal,
): Promise<CoachEvaluationParsed> {
  const transcript = await transcribeWithOllama(wav);
  const evaluation = await coachFromTranscriptWithOllama(
    transcript,
    speechType,
    goal,
  );
  // Confidence from ASR richness, not the coach model's self-report
  const fillers = countFillersRough(transcript);
  const words = transcript.split(/\s+/).length;
  evaluation.transcriptionConfidence =
    words >= 20 && !isLoopedOrGibberishTranscript(transcript)
      ? fillers > 0 || words >= 40
        ? "high"
        : "medium"
      : "low";
  return evaluation;
}

async function callGoogleAiStudioOnce(
  wavBase64: string,
  speechType: SpeechType,
  goal: PracticeGoal,
): Promise<CoachEvaluationParsed> {
  if (!GOOGLE_API_KEY) {
    throw new Error(
      "Cloud fallback requested but GOOGLE_API_KEY / GEMINI_API_KEY is not set.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CLOUD_GEMMA_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

  try {
    // Cloud path: ASR-style instruction first, still ask for full JSON
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `${buildCoachSystemPrompt()}
First transcribe the audio accurately in English, then evaluate.
If transcription would loop or is unintelligible, set transcript to NO_SPEECH and transcriptionConfidence to low.`,
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "audio/wav", data: wavBase64 } },
              {
                text: `${VERBATIM_ASR_PROMPT}

Then evaluate the speech and return coaching JSON. Speech type: ${SPEECH_TYPE_LABELS[speechType]}. Goal: ${GOAL_LABELS[goal]}.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: ollamaFormatSchema,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Google AI Studio error ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const content = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!content) throw new Error("Google AI Studio returned empty content.");

    const evaluation = coachEvaluationSchema.parse(extractJson(content));
    if (isLoopedOrGibberishTranscript(evaluation.transcript)) {
      throw new Error("Cloud model returned a looped transcript.");
    }
    return evaluation;
  } finally {
    clearTimeout(timeout);
  }
}

export async function evaluateSpeechWithGemma(params: {
  wavBase64: string;
  speechType: SpeechType;
  goal: PracticeGoal;
  preferMode?: InferenceMode;
}): Promise<{
  evaluation: CoachEvaluationParsed;
  inferenceMode: InferenceMode;
  audioMeta: { amplified: boolean; trimmed: boolean; durationSeconds: number };
  preparedWav: Buffer;
}> {
  const prepared = prepareWavForGemma(Buffer.from(params.wavBase64, "base64"));
  const wavBase64 = prepared.wav.toString("base64");
  const audioMeta = {
    amplified: prepared.amplified,
    trimmed: prepared.trimmed,
    durationSeconds: prepared.durationSeconds,
  };

  const mode = params.preferMode ?? INFERENCE_MODE;

  const runLocal = async () =>
    evaluateLocalTwoStage(prepared.wav, params.speechType, params.goal);

  if (mode === "cloud") {
    const evaluation = await callGoogleAiStudioOnce(
      wavBase64,
      params.speechType,
      params.goal,
    );
    return {
      evaluation,
      inferenceMode: "cloud",
      audioMeta,
      preparedWav: prepared.wav,
    };
  }

  if (mode === "local") {
    const evaluation = await runLocal();
    return {
      evaluation,
      inferenceMode: "local",
      audioMeta,
      preparedWav: prepared.wav,
    };
  }

  try {
    const evaluation = await runLocal();
    return {
      evaluation,
      inferenceMode: "local",
      audioMeta,
      preparedWav: prepared.wav,
    };
  } catch (localError) {
    if (!GOOGLE_API_KEY) throw localError;
    const evaluation = await callGoogleAiStudioOnce(
      wavBase64,
      params.speechType,
      params.goal,
    );
    return {
      evaluation,
      inferenceMode: "cloud",
      audioMeta,
      preparedWav: prepared.wav,
    };
  }
}

export function getModelConfig() {
  return {
    inferenceMode: INFERENCE_MODE,
    local: {
      baseUrl: OLLAMA_BASE_URL,
      coachModel: OLLAMA_MODEL,
      asrModel: OLLAMA_ASR_MODEL,
      asrCandidates: ASR_MODEL_CANDIDATES,
    },
    cloud: {
      configured: Boolean(GOOGLE_API_KEY),
      model: CLOUD_GEMMA_MODEL,
    },
    timeoutMs: AI_TIMEOUT_MS,
    pipeline: "asr-then-coach",
  };
}
