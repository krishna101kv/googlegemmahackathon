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
// Text coaching can stay on E4B; ASR on current Ollama builds is much more
// reliable on gemma4:12b (E4B often collapses into "lo lo lo" / phrase loops).
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:latest";
const OLLAMA_ASR_MODEL =
  process.env.OLLAMA_ASR_MODEL ?? "gemma4:12b";
const ASR_MODEL_CANDIDATES = [
  ...new Set(
    [
      OLLAMA_ASR_MODEL,
      "gemma4:12b",
      OLLAMA_MODEL,
      "gemma4:latest",
      "gemma4:e4b",
    ].filter(Boolean),
  ),
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

const ASR_PROMPT = `Transcribe the following speech segment in English into English text.
Follow these specific instructions for formatting the answer:
* Only output the transcription, with no newlines.
* When transcribing numbers, write the digits, i.e. write 1.7 and not one point seven, and write 3 instead of three.
* If the audio is silent or unintelligible, output exactly: NO_SPEECH`;

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

function normalizeAsrOutput(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^transcript\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function transcribeWithOllama(wavBase64: string): Promise<string> {
  let lastError: Error | null = null;

  for (const model of ASR_MODEL_CANDIDATES) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw = await ollamaChat({
          model,
          stream: false,
          think: false,
          messages: [
            {
              role: "user",
              content: ASR_PROMPT,
              images: [wavBase64],
            },
          ],
          options: {
            temperature: 0.0,
            top_p: 0.9,
            top_k: 20,
            num_ctx: 8192,
            num_predict: 512,
            repeat_penalty: 1.4,
          },
        });

        const transcript = normalizeAsrOutput(raw);
        if (!transcript || /^no[_\s-]?speech$/i.test(transcript)) {
          throw new Error("NO_SPEECH");
        }
        if (isLoopedOrGibberishTranscript(transcript)) {
          throw new Error(
            `Looped ASR output from ${model}: ${transcript.slice(0, 80)}…`,
          );
        }
        console.info(`[gemma-asr] ok via ${model}`);
        return transcript;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[gemma-asr] ${model} attempt ${attempt}:`, lastError.message);
      }
    }
  }

  throw new Error(
    lastError?.message?.includes("Looped") || lastError?.message === "NO_SPEECH"
      ? "Could not reliably transcribe this audio. Try a clearer, louder recording under 28 seconds (local E4B ASR may loop; gemma4:12b is preferred)."
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
  wavBase64: string,
  speechType: SpeechType,
  goal: PracticeGoal,
): Promise<CoachEvaluationParsed> {
  const transcript = await transcribeWithOllama(wavBase64);
  const evaluation = await coachFromTranscriptWithOllama(
    transcript,
    speechType,
    goal,
  );
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
                text: `${ASR_PROMPT}

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

  const runLocal = async () => {
    const evaluation = await evaluateLocalTwoStage(
      wavBase64,
      params.speechType,
      params.goal,
    );
    // If ASR was weak but somehow passed, force low confidence on short text
    if (evaluation.transcript.split(/\s+/).length < 12) {
      evaluation.transcriptionConfidence = "low";
    }
    return evaluation;
  };

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
