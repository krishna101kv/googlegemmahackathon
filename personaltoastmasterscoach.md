# Personal Toastmasters Coach — Build Plan and Guardrails (Gemma 4 Edition)

## One-Line Concept

A local-first speech coaching app, built around Gemma 4's native audio understanding, that lets users record practice speeches, gets a single-model transcription-plus-evaluation, tracks improvement areas, and visualizes speaking progress over time.

## Judging Rubric Alignment

This build is being scored against four criteria. Every section below is written to serve one of them directly.

| Criteria | Weight | What judges are checking | Where this plan addresses it |
|---|---|---|---|
| Gemma Integration | 30% | Is Gemma 4 effectively utilized, and is it core to the solution — not swapped in at the end? | AI Pipeline section: audio-native single-call design, native structured output, explicit model/runtime commitment |
| Innovation & Impact | 30% | Real problem, creative and relevant approach | Primary User Problem, Why Gemma + Local-First (Differentiation) |
| Functionality | 20% | Does the prototype work, is the demo convincing | Hackathon Milestones (tiered), Demo-Day Risk Mitigation |
| Presentation & Writeup | 20% | Is the Kaggle Writeup clear, does it explain problem and solution | Kaggle Writeup Plan |

## Primary User Problem

Toastmasters members often practice alone but lack immediate, structured feedback on delivery, filler words, pacing, clarity, speech structure, and progress across sessions.

## Target Users

- Toastmasters members preparing speeches
- People practicing public speaking
- Interview or pitch presenters
- ESL speakers improving spoken communication
- Students preparing presentations

## Why Gemma 4 + Local-First (Differentiation)

This is the connective tissue between the two 30% criteria, so it needs to be said explicitly, not left implicit:

- Gemma 4's E2B/E4B/12B variants take **audio input natively**. That means transcription and coaching evaluation can happen inside the same model call instead of chaining a generic STT engine into a generic LLM — Gemma isn't a feedback layer bolted onto someone else's pipeline, it *is* the pipeline.
- Gemma 4 is open-weight (Apache 2.0) and small enough to run on-device (Ollama, or a local runtime). A practice speech is often unpolished, personal, and sometimes about sensitive topics (interview prep, personal stories for icebreaker speeches). Being able to say "your recording never has to leave your machine" is a real, credible claim here — a wrapper around a closed cloud API can't make it.
- Gemma 4's native function-calling / structured output support lets the coaching JSON schema be enforced by the model itself rather than hoped for via prompt instructions, which is both a reliability win (Functionality) and a legitimate "effective utilization" story (Gemma Integration).

State this explicitly in the writeup — it's the strongest single argument in the plan and should not be left for a judge to infer.

## Core MVP

The MVP should prove this loop:

```text
Record speech -> Gemma 4 (transcribe + evaluate) -> Code recomputes objective metrics -> Coach -> Track progress
```

MVP features:

1. Audio recording in browser
2. Audio playback
3. Gemma 4 transcription (audio-native, single call)
4. Filler word detection (code, from transcript)
5. Words-per-minute calculation (code, from transcript + duration)
6. Gemma 4 coaching feedback (same call as transcription, or chained call — see AI Pipeline)
7. Structured scoring rubric (Gemma 4 structured output)
8. Saved session history
9. Progress dashboard
10. Improvement goals

## Model Size and Runtime Decision

Commit to this now — do not leave it as "optional Ollama" or a generic "LLM API" placeholder, since judges will ask.

- **Primary (demo default): Gemma 4 E4B, run locally via Ollama.** Fits the local-first/privacy story, supports native audio input, small enough to run reliably on a laptop without depending on venue wifi.
- **Fallback: same model, hosted via Vertex AI / Google AI Studio.** If on-device inference proves too slow or unstable during testing, or the demo machine can't handle E4B comfortably, fall back to a hosted call for reliability. The architecture and prompts should be identical either way — only the endpoint changes.
- If evaluation quality from E4B feels thin during testing, consider Gemma 4 12B (still supports native audio) as a quality upgrade, run via Vertex AI rather than on-device.
- Do not treat this as a "pick later" decision. Test the local Ollama path in the first two build days — it's the highest-risk technical dependency in the whole plan.

## Recommended Screens

### 1. Practice Screen

Purpose: let the user start a speech practice session quickly.

Features:

- Start and stop recording
- Speech type selector:
  - Prepared speech
  - Table Topics
  - Evaluation practice
  - Interview or pitch practice
- Optional user goal:
  - reduce filler words
  - improve pacing
  - strengthen opening
  - improve vocal variety
- Recording timer
- Submit for analysis button

### 2. Session Review Screen

Purpose: show the user what happened in the recording and what to improve next.

Features:

- Audio playback
- Transcript (from Gemma 4)
- Overall score
- Rubric scores
- Strengths
- Improvement areas
- Suggested drills
- Key metrics (code-calculated, not AI-reported):
  - duration
  - word count
  - words per minute
  - filler word count
  - filler words per minute

### 3. Progress Dashboard

Purpose: help the user see improvement across sessions.

Features:

- Score trend over time
- Filler words over time
- Speaking pace over time
- Top recurring improvement areas
- Recent wins
- Current focus goal

### 4. Session History

Purpose: let the user revisit older recordings and feedback.

Features:

- List of previous recordings
- Date, speech type, score, and top feedback
- Ability to open a previous review
- Optional delete session action

### 5. Goals Screen

Purpose: convert feedback into a focused improvement plan.

Features:

- Current focus areas
- Suggested goals based on past sessions
- Completed goals and improvements
- Goal status tracking

## Evaluation Rubric

Use consistent scoring from either `1-5`, `0-10`, or `0-100`. For the MVP, `0-100` is easiest to chart, while category scores from `1-5` are easiest for users to understand.

Suggested categories:

- Clarity
- Pace
- Filler word control
- Structure
- Vocal variety
- Confidence
- Conciseness
- Opening strength
- Closing strength
- Audience impact

Example Gemma 4 structured output (enforced via native structured output / function calling, not free-text JSON):

```json
{
  "transcript": "Full transcript text produced by Gemma 4 from the audio input.",
  "overallScore": 78,
  "scores": {
    "clarity": 4,
    "pace": 3,
    "fillerControl": 2,
    "structure": 4,
    "confidence": 3,
    "vocalVariety": 3
  },
  "strengths": [
    "Clear opening",
    "Good organization"
  ],
  "improvementAreas": [
    {
      "area": "Filler words",
      "evidence": "Frequent filler words noticed in the middle section.",
      "suggestion": "Practice replacing filler words with a silent pause."
    }
  ],
  "drills": [
    "Record a 60-second table topic with no filler words.",
    "Pause for one second before each main point."
  ],
  "nextFocusArea": "Filler word control",
  "transcriptionConfidence": "high"
}
```

Note: the model returns `transcript` and its own qualitative scores, but exact filler word counts, WPM, and duration are **recomputed by code from the transcript**, not trusted from the model's own claims — see Guardrails and Objective Metrics.

## Technical Architecture

```text
Frontend
Browser audio recorder (MediaRecorder API)
Session UI
Progress dashboard

Gemma 4 layer
Local: Ollama running Gemma 4 E4B (primary)
Cloud fallback: Vertex AI / Google AI Studio running Gemma 4 E4B or 12B
Single audio-native call: input = audio blob, output = structured JSON (transcript + evaluation)

Code layer
Recomputes objective metrics from the returned transcript (word count, filler count, WPM)
Validates structured output against schema before saving
Session storage

Database
Users
Sessions
Transcripts
Scores
Improvement goals
```

## Possible Stack

Frontend:

- React or Next.js
- Browser `MediaRecorder` API for audio capture
- Chart library for progress views

Backend:

- Next.js API routes, or a thin Node/Express layer
- Ollama running locally for Gemma 4 E4B (primary path)
- Vertex AI / Google AI Studio client for the cloud fallback path

Storage:

- SQLite for local MVP
- Postgres for production
- IndexedDB or localStorage only for a very small demo

## AI Pipeline

```text
1. User records audio
2. App saves audio blob
3. App sends audio blob directly to Gemma 4 (no separate STT step)
4. Gemma 4 returns structured JSON: transcript + rubric scores + strengths + improvement areas + drills
5. App validates JSON against schema
6. Code recomputes objective metrics independently from the transcript
   (word count, filler word count, WPM, duration)
7. App reconciles: if code-derived metrics conflict sharply with the model's
   qualitative read (e.g. "fillerControl: 4" but code counts 20 filler words
   in 90 seconds), surface the code-derived numbers as ground truth
8. App saves session (transcript, code metrics, model evaluation stored separately)
9. Dashboard updates progress
```

If audio-native ingestion proves unreliable in testing (transcription quality too low, latency too high on-device), the fallback is to split steps 3-4 into a dedicated transcription call plus a separate Gemma 4 text-evaluation call — same model, two calls instead of one. This is a documented contingency, not the default plan.

## Objective Metrics

These should be calculated by code from the transcript, never taken as the model's self-report:

- Duration
- Word count
- Words per minute
- Filler word count
- Filler words per minute
- Long pause count, if audio timing is available
- Repeated words
- Speaking pace category:
  - slow
  - balanced
  - fast

Suggested filler words and phrases:

- um
- uh
- like
- you know
- so
- actually
- basically
- kind of
- sort of
- I mean

The list should be configurable, since filler words vary by speaker.

## AI Responsibilities

Gemma 4 should evaluate:

- Speech structure
- Strength of opening
- Strength of conclusion
- Clarity of message
- Use of examples
- Persuasiveness
- Tone of feedback
- Recommended drills
- Suggested next focus area

Gemma 4 should not calculate objective metrics if the application can calculate them directly from the transcript it returns.

## Guardrails

1. Do not let the AI invent metrics — even when Gemma 4 also produces the transcript, code recomputes WPM/filler counts from that transcript independently.
2. Use code for all measurable values.
3. Use Gemma 4's native structured output / function calling for responses, not free-text JSON parsing.
4. Validate AI output against a schema before saving; reject and retry on malformed output.
5. Keep the scoring rubric consistent between sessions.
6. Use low temperature / low "thinking" setting for evaluation calls so scoring is stable across sessions.
7. Show evidence for critiques.
8. Store the original transcript with the review.
9. Let users delete recordings and transcripts.
10. Avoid harsh language; feedback should be coach-like and specific.
11. If transcription confidence is low, mark the evaluation as uncertain in the UI.
12. Never claim medical, psychological, or diagnostic conclusions.
13. Separate objective metrics from AI coaching observations, both in the data model and in the UI.
14. Cap retries and timeouts for AI calls; fail gracefully with a clear message, not a stuck spinner.
15. Track trends over multiple sessions, not one-off judgments.
16. Avoid judging accent, identity, personality, or intelligence.
17. Do not infer emotion or confidence as fact; frame it as delivery impression.
18. Make privacy and storage behavior visible to the user — including whether a given session ran locally or via the cloud fallback.

## Privacy and Data Handling

- Default to local inference (Ollama + Gemma 4 E4B) so audio never leaves the device.
- If the cloud fallback (Vertex AI / Google AI Studio) is used, show the user clearly that audio/transcript will leave the device for that session.
- Let users delete recordings and transcripts.
- Store coaching feedback separately from raw audio so users can keep insights while deleting recordings.

## Database Model

```text
User
- id
- name
- createdAt

Session
- id
- userId
- speechType
- goal
- audioPath
- transcript
- inferenceMode (local | cloud)
- durationSeconds
- wordCount
- wordsPerMinute
- fillerWordCount
- fillerWordsPerMinute
- overallScore
- createdAt

Score
- id
- sessionId
- category
- value
- explanation

ImprovementArea
- id
- sessionId
- area
- evidence
- suggestion

Goal
- id
- userId
- title
- status
- createdAt
- completedAt
```

## Hackathon Milestones (tiered by risk)

**Tier 0 — must work for any demo to be credible**

1. Audio recording and playback in-browser.
2. Gemma 4 (Ollama, E4B) audio-native call returning a transcript, tested end-to-end.
3. Structured output validated and saved; one full session round-trip works.
4. Code-side objective metrics (WPM, filler count) computed from the transcript.
5. Session review screen showing transcript, scores, and metrics together.

**Tier 1 — strengthens the score once Tier 0 is solid**

6. Progress dashboard with trend charts.
7. Session history list.
8. Cloud fallback path (Vertex AI) wired and tested as a backup, not the headline.
9. Sample historical data pre-loaded for a richer demo.

**Tier 2 — cut first if time runs short**

10. Goals screen and goal-status tracking.
11. Configurable filler word list in settings.
12. Delete session / delete recording flows (keep if time allows; privacy story matters, but a hardcoded "MVP note" in the writeup can cover this if cut).

**Always, regardless of tier progress**

13. Write the Kaggle Writeup — start a draft on day one, don't leave it for the last hour.

## Demo-Day Risk Mitigation

Functionality is judged partly on "is the demo convincing," which means live-demo failure modes need an answer before they happen, not during:

- Pre-record one known-good sample session (audio + expected output) to fall back on if live mic access, on-device inference, or network conditions fail mid-demo.
- Pre-load 3-5 historical sessions so the Progress Dashboard has a real trend to show even if you only demo one live recording.
- Test the local Ollama path on the actual demo machine and venue network beforehand, not just on a dev machine — on-device inference speed varies by hardware.
- Have the cloud fallback (Vertex AI) tested and ready as a one-line switch, in case local inference is too slow live.
- Cap AI call timeouts and show a clear, coach-toned error state rather than a stuck spinner if something fails on stage.

## Kaggle Writeup Plan

This is 20% of the score and needs its own outline, drafted early rather than written after the build is "done":

1. **Problem** — the practice-feedback gap for Toastmasters members, ESL speakers, interview/pitch presenters.
2. **Solution overview** — the record-to-progress loop, one paragraph.
3. **Why Gemma 4, specifically** — audio-native single-call design, open-weight local-first privacy story, native structured output for reliable coaching JSON. This is the section judges will read most closely against the Gemma Integration criterion — be explicit and technical, not just "we used Gemma."
4. **Architecture** — a simple diagram: browser recorder -> Gemma 4 (local or cloud) -> code-side metrics -> storage -> dashboard.
5. **What Gemma does vs. what code does** — the objective-metrics-vs-AI-judgment separation is a real design decision worth highlighting; it shows evaluation discipline, not just a feature list.
6. **Results / demo** — screenshots or a short clip of a real session review and a progress trend.
7. **Limitations and next steps** — be honest: single-session accuracy on noisy audio, multi-speaker environments, longer speeches, accent robustness testing not yet done.

## Questions For Claude To Challenge (updated)

1. Does the audio-native single-call design actually hold up in testing, or does transcription quality force the two-call fallback — and if so, is that still a strong enough Gemma Integration story?
2. Is E4B fast enough on realistic demo hardware, or does the plan need to commit to the cloud fallback as primary instead?
3. Does the writeup make the "why Gemma, specifically" case concretely enough, or does it read as a generic AI feature list?
4. What in Tier 2 is safe to cut without weakening the Innovation & Impact story?
5. Are there failure modes in the live demo that still aren't covered by the risk mitigation section?

## Claude Review Prompt

```text
Please review this product and technical plan for a Personal Toastmasters Coach app, being
built for a hackathon judged on: Gemma Integration (30%), Innovation & Impact (30%),
Functionality (20%), and Presentation & Writeup (20%).

Challenge the MVP scope, the Gemma 4 integration design specifically, technical architecture,
AI guardrails, privacy assumptions, demo-day risk plan, and writeup outline.

Please return:

1. The strongest parts of the plan
2. The weakest or riskiest parts, especially anything that weakens the Gemma Integration score
3. What should be cut from the MVP under time pressure
4. What should be added before implementation
5. A revised MVP recommendation
6. A suggested build order
7. Any AI safety, privacy, or evaluation concerns

Be direct and practical. Assume this is for a hackathon project where speed, demo quality,
and feasibility matter, and that Gemma 4 needs to be visibly core to the solution, not
an interchangeable backend.
```