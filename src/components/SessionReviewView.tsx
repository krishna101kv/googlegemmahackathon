"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionRecord } from "@/lib/types";
import { GOAL_LABELS, SPEECH_TYPE_LABELS } from "@/lib/types";
import {
  computeObjectiveMetrics,
  reconcileFillerScore,
} from "@/lib/metrics";
import { countFillersRough } from "@/lib/asr";

const SCORE_LABELS: Record<keyof SessionRecord["scores"], string> = {
  clarity: "Clarity",
  pace: "Pace",
  fillerControl: "Filler control",
  structure: "Structure",
  confidence: "Confidence (impression)",
  vocalVariety: "Vocal variety",
};

export function SessionReviewView({ session }: { session: SessionRecord }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const reconcileNote = reconcileFillerScore(
    session.scores.fillerControl,
    session.fillerWordsPerMinute,
  );
  const derived = computeObjectiveMetrics(
    session.transcript,
    session.durationSeconds,
  );
  const fillerHits = countFillersRough(session.transcript);

  async function onDelete() {
    if (!confirm("Delete this session, including the recording and transcript?")) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/history");
      router.refresh();
    } else {
      setDeleting(false);
      alert("Could not delete session.");
    }
  }

  return (
    <article className="review">
      <header className="review-header">
        <div>
          <p className="eyebrow">Session review</p>
          <h1>Overall score {session.overallScore}</h1>
          <p className="meta-line">
            {SPEECH_TYPE_LABELS[session.speechType]} ·{" "}
            {GOAL_LABELS[session.goal]} ·{" "}
            {new Date(session.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="badge-stack">
          <span
            className={
              session.inferenceMode === "local"
                ? "badge local"
                : "badge cloud"
            }
          >
            {session.inferenceMode === "local"
              ? "Local Gemma 4"
              : "Cloud fallback"}
          </span>
          {session.transcriptionConfidence !== "high" && (
            <span className="badge warn">
              Transcription confidence: {session.transcriptionConfidence}
            </span>
          )}
        </div>
      </header>

      {session.transcriptionConfidence === "low" && (
        <p className="callout warn">
          Transcription confidence is low — treat scores as directional, not
          definitive.
        </p>
      )}

      <section className="block">
        <h2>Audio → text (Gemma transcript)</h2>
        <p className="subtle">
          Dedicated transcription pass first, then coaching on that text.
        </p>
        <audio controls src={`/api/audio/${session.id}`} />
        {session.transcriptionConfidence !== "high" && (
          <p className="callout warn">
            Transcription confidence is {session.transcriptionConfidence}. If
            this text looks wrong or repeats, re-record closer to the mic in a
            quieter room (under ~28 seconds).
          </p>
        )}
        <p className="transcript">{session.transcript || "(No transcript returned.)"}</p>
        <p className="subtle" style={{ marginTop: "0.75rem" }}>
          Verbatim ASR keeps fillers in the text (um/uh/like…). Spotted in
          transcript: ~{fillerHits}. Code metric count: {session.fillerWordCount}.
        </p>
      </section>

      <section className="block metrics">
        <h2>Objective metrics</h2>
        <p className="subtle">Computed by code from the transcript above</p>
        <dl className="metric-list">
          <div>
            <dt>Duration</dt>
            <dd>{session.durationSeconds}s</dd>
          </div>
          <div>
            <dt>Word count</dt>
            <dd>{session.wordCount}</dd>
          </div>
          <div>
            <dt>Words / min</dt>
            <dd>
              {session.wordsPerMinute}{" "}
              <span className="pill">{session.paceCategory}</span>
            </dd>
          </div>
          <div>
            <dt>Filler words</dt>
            <dd>
              {session.fillerWordCount} ({session.fillerWordsPerMinute}/min)
            </dd>
          </div>
          <div>
            <dt>Repeated words</dt>
            <dd>
              {derived.repeatedWords.length > 0
                ? derived.repeatedWords.join(", ")
                : "None noted"}
            </dd>
          </div>
        </dl>
        {reconcileNote && <p className="callout soft">{reconcileNote}</p>}
      </section>

      <section className="block">
        <h2>Rubric</h2>
        <ul className="score-grid">
          {(
            Object.keys(SCORE_LABELS) as Array<keyof SessionRecord["scores"]>
          ).map((key) => (
            <li key={key}>
              <span>{SCORE_LABELS[key]}</span>
              <strong>{session.scores[key]}/5</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="two-col">
        <div className="block">
          <h2>Strengths</h2>
          <ul>
            {session.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="block">
          <h2>Improvement areas</h2>
          <ul className="improve-list">
            {session.improvementAreas.map((item) => (
              <li key={`${item.area}-${item.evidence}`}>
                <strong>{item.area}</strong>
                <p>
                  <em>Evidence:</em> {item.evidence}
                </p>
                <p>
                  <em>Try:</em> {item.suggestion}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="block">
        <h2>Suggested drills</h2>
        <ol>
          {session.drills.map((drill) => (
            <li key={drill}>{drill}</li>
          ))}
        </ol>
        <p className="focus-line">
          Next focus: <strong>{session.nextFocusArea}</strong>
        </p>
      </section>

      <footer className="review-actions">
        <Link href="/" className="btn primary">
          Practice again
        </Link>
        <Link href="/progress" className="btn ghost">
          View progress
        </Link>
        <button
          type="button"
          className="btn danger ghost"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete session"}
        </button>
      </footer>
    </article>
  );
}
