"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { blobToBase64, blobToWav16kMono } from "@/lib/wav";
import {
  GOAL_LABELS,
  SPEECH_TYPE_LABELS,
  type InferenceMode,
  type PracticeGoal,
  type SpeechType,
} from "@/lib/types";

export function PracticePanel() {
  const router = useRouter();
  const [speechType, setSpeechType] = useState<SpeechType>("prepared");
  const [goal, setGoal] = useState<PracticeGoal>("reduce_fillers");
  const [preferMode, setPreferMode] = useState<InferenceMode>("local");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onRecordingReady(nextBlob: Blob, duration: number) {
    setBlob(nextBlob);
    setDurationSeconds(duration);
    setError(null);
  }

  async function loadDemoSample() {
    setBusy(true);
    setError(null);
    setStatus("Loading known-good demo speech…");
    try {
      const res = await fetch("/demo/sample-speech.wav");
      if (!res.ok) throw new Error("Demo sample missing. Run npm run prepare-demo.");
      const demoBlob = await res.blob();
      const audioCtx = new AudioContext();
      const decoded = await audioCtx.decodeAudioData(await demoBlob.arrayBuffer());
      await audioCtx.close();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(demoBlob);
      setPreviewUrl(url);
      setBlob(demoBlob);
      setDurationSeconds(decoded.duration);
      setStatus("Demo sample loaded — submit for analysis when ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load demo sample.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function submitForAnalysis() {
    if (!blob) {
      setError("Record a speech first, or load the demo sample.");
      return;
    }
    if (durationSeconds < 2) {
      setError("Record at least a few seconds so Gemma has enough audio.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("Converting audio to 16 kHz WAV for Gemma 4…");

    try {
      const normalized = await blobToWav16kMono(blob);

      setStatus(
        preferMode === "local"
          ? "Audio → text: Gemma 4 is transcribing and coaching locally…"
          : "Audio → text: sending to cloud Gemma 4 fallback…",
      );
      const audioBase64 = await blobToBase64(normalized);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          durationSeconds,
          speechType,
          goal,
          preferMode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setStatus("Coach ready — opening your review…");
      router.push(`/sessions/${data.session.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong during analysis.",
      );
      setStatus(null);
      setBusy(false);
    }
  }

  return (
    <section className="practice-panel">
      <div className="practice-copy">
        <p className="eyebrow">Local-first coaching</p>
        <h1>Practice. Get coached. Improve.</h1>
        <p className="lede">
          Record a speech. Gemma 4 listens natively on your machine — one call
          for transcript and coaching — then the app computes objective metrics
          you can trust.
        </p>
        <p className="privacy-note">
          Gemma evaluates: clarity, pace, filler control, structure, confidence
          (delivery impression), and vocal variety. Exact WPM and filler counts
          are calculated by the app from the transcript.
        </p>
      </div>

      <div className="practice-controls">
        <ol className="flow-steps">
          <li>
            <strong>1. Record</strong> your speech with the mic
          </li>
          <li>
            <strong>2. Submit</strong> — Gemma 4 turns audio into text + coaching
          </li>
          <li>
            <strong>3. Review</strong> transcript, scores, and metrics
          </li>
        </ol>

        <div className="recorder-panel">
          <p className="field-label">Step 1 — Record audio</p>
          <AudioRecorder onRecordingReady={onRecordingReady} disabled={busy} />
        </div>

        {previewUrl && (
          <div className="playback">
            <p className="field-label">Demo sample preview</p>
            <audio controls src={previewUrl} />
          </div>
        )}

        <button
          type="button"
          className="btn ghost wide"
          onClick={loadDemoSample}
          disabled={busy}
        >
          Or load demo sample (no mic)
        </button>

        <label className="field">
          <span className="field-label">Speech type</span>
          <select
            value={speechType}
            onChange={(e) => setSpeechType(e.target.value as SpeechType)}
            disabled={busy}
          >
            {Object.entries(SPEECH_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Optional goal</span>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as PracticeGoal)}
            disabled={busy}
          >
            {Object.entries(GOAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Inference path</span>
          <select
            value={preferMode}
            onChange={(e) => setPreferMode(e.target.value as InferenceMode)}
            disabled={busy}
          >
            <option value="local">Local Ollama (default)</option>
            <option value="cloud">Cloud fallback (Google AI Studio)</option>
          </select>
        </label>

        <button
          type="button"
          className="btn primary wide"
          onClick={submitForAnalysis}
          disabled={busy || !blob}
        >
          {busy
            ? "Transcribing audio → text + coaching…"
            : "Step 2 — Submit for audio-to-text analysis"}
        </button>

        <p className="privacy-note">
          {preferMode === "local"
            ? "Local path: audio stays on this machine via Ollama + Gemma 4."
            : "Cloud path: audio/transcript will leave this device for this session."}
        </p>

        {status && <p className="status-text">{status}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>
    </section>
  );
}
