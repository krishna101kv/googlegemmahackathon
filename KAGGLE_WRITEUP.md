# Stagecraft — Personal Toastmasters Coach (Gemma 4)

## 1. Problem

Toastmasters members, ESL speakers, and interview/pitch presenters often practice alone. They can record themselves, but they rarely get immediate, structured feedback on delivery, filler words, pacing, clarity, structure, and progress across sessions. Closed cloud coaching tools also raise privacy concerns for personal stories and interview prep.

## 2. Solution overview

**Stagecraft** is a local-first speech coaching loop:

1. Record a practice speech in the browser
2. Send audio directly to **Gemma 4** (no separate STT engine)
3. Receive transcript + rubric coaching in one structured response
4. Recompute objective metrics (WPM, filler counts) in code from the transcript
5. Save the session and visualize improvement over time

## 3. Why Gemma 4, specifically

This is not a generic LLM wrapper.

- **Audio-native single call:** Gemma 4 E2B/E4B take audio input natively. Transcription and coaching evaluation happen inside the same model call instead of chaining a third-party STT service into a text-only model. Gemma *is* the pipeline.
- **Open-weight, local-first privacy:** Apache 2.0 weights run on-device via Ollama. Practice audio about interviews, icebreakers, or sensitive personal stories does not need to leave the machine.
- **Native structured output:** Coaching JSON (transcript, scores, strengths, improvement areas, drills) is enforced with Ollama’s `format` / schema support rather than fragile free-text JSON parsing.
- **Demo default model:** `gemma4:latest` / `gemma4:e4b` locally. Cloud fallback (Vertex AI / Google AI Studio) is architected as an endpoint swap, not a redesign.

## 4. Architecture

```text
Browser MediaRecorder
  -> convert to 16 kHz mono WAV
  -> Next.js API
  -> Gemma 4 via Ollama (local) [or cloud fallback]
  -> Zod schema validation
  -> code-side metrics (WPM, fillers)
  -> SQLite session store
  -> Review / Progress / History / Goals UI
```

## 5. What Gemma does vs. what code does

| Responsibility | Owner |
|---|---|
| Transcript from audio | Gemma 4 |
| Qualitative rubric scores, strengths, drills | Gemma 4 |
| Duration, word count, WPM, filler counts | Application code |
| Schema validation / retries / storage | Application code |

Exact filler counts and WPM are never trusted from the model’s self-report. If qualitative scores conflict sharply with code metrics, the UI surfaces the code numbers as ground truth.

## 6. Results / demo

- Practice screen with speech type + goal selectors and live recording
- Session review with playback, transcript, rubric, objective metrics
- Progress dashboard with score / filler / WPM trends
- Session history and goals tracking
- Privacy badge showing whether inference ran locally or via cloud fallback

*(Add screenshots / short clip before submission.)*

## 7. Limitations and next steps

- Single-speaker practice clips perform best; multi-speaker / noisy rooms are not yet stress-tested
- On-device E4B latency varies by laptop GPU/CPU — cloud fallback exists for demo reliability
- Accent robustness and long-form speeches need broader evaluation
- Configurable filler lexicon and richer pause detection are planned Tier-2 polish

## Guardrails (summary)

Coach-like tone only; no accent/identity/intelligence judgments; no medical claims; low temperature for stable scoring; users can delete recordings and transcripts; inference mode is visible in the UI.
