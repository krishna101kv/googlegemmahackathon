import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, saveAudioFile, upsertSuggestedGoal } from "@/lib/db";
import { getFillerWordList } from "@/lib/fillers";
import { evaluateSpeechWithGemma } from "@/lib/gemma";
import { computeObjectiveMetrics, reconcileFillerScore } from "@/lib/metrics";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  audioBase64: z.string().min(1),
  durationSeconds: z.number().positive().max(60 * 20),
  speechType: z.enum([
    "prepared",
    "table_topics",
    "evaluation",
    "interview_pitch",
  ]),
  goal: z.enum([
    "reduce_fillers",
    "improve_pacing",
    "strengthen_opening",
    "vocal_variety",
    "none",
  ]),
  preferMode: z.enum(["local", "cloud"]).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);

    const wavBuffer = Buffer.from(body.audioBase64, "base64");
    if (wavBuffer.length < 100) {
      return NextResponse.json(
        { error: "Audio payload looks empty. Please re-record." },
        { status: 400 },
      );
    }

    const header = wavBuffer.subarray(0, 4).toString("ascii");
    if (header !== "RIFF") {
      return NextResponse.json(
        {
          error:
            "Audio must be WAV (RIFF). Convert in the browser before submitting.",
        },
        { status: 400 },
      );
    }

    const { evaluation, inferenceMode, audioMeta, preparedWav } =
      await evaluateSpeechWithGemma({
        wavBase64: body.audioBase64,
        speechType: body.speechType,
        goal: body.goal,
        preferMode: body.preferMode,
      });

    const durationSeconds =
      audioMeta.durationSeconds > 0.5
        ? audioMeta.durationSeconds
        : body.durationSeconds;

    const metrics = computeObjectiveMetrics(
      evaluation.transcript,
      durationSeconds,
      getFillerWordList(),
    );

    const reconcileNote = reconcileFillerScore(
      evaluation.scores.fillerControl,
      metrics.fillerWordsPerMinute,
    );

    const sessionId = crypto.randomUUID();
    const audioPath = saveAudioFile(sessionId, preparedWav);

    const session = createSession({
      id: sessionId,
      speechType: body.speechType,
      goal: body.goal,
      audioPath,
      transcript: evaluation.transcript,
      inferenceMode,
      durationSeconds: metrics.durationSeconds,
      wordCount: metrics.wordCount,
      wordsPerMinute: metrics.wordsPerMinute,
      fillerWordCount: metrics.fillerWordCount,
      fillerWordsPerMinute: metrics.fillerWordsPerMinute,
      paceCategory: metrics.paceCategory,
      overallScore: Math.round(evaluation.overallScore),
      scores: evaluation.scores,
      strengths: evaluation.strengths,
      improvementAreas: evaluation.improvementAreas,
      drills: evaluation.drills,
      nextFocusArea: evaluation.nextFocusArea,
      transcriptionConfidence: evaluation.transcriptionConfidence,
    });

    if (evaluation.nextFocusArea) {
      upsertSuggestedGoal(evaluation.nextFocusArea);
    }

    return NextResponse.json({
      session,
      metrics,
      reconcileNote,
      inferenceMode,
      audioMeta,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed unexpectedly.";
    console.error("[analyze]", message);
    return NextResponse.json(
      {
        error: message.includes("abort")
          ? "Coaching timed out. Try a shorter clip, or check that Ollama is running."
          : message,
      },
      { status: 500 },
    );
  }
}
