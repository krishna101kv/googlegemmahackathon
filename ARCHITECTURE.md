# GemmaProject: Architecture Documentation

**Project:** Stagecraft — Personal Toastmasters Coach  
**Version:** 0.1.0  
**Last Updated:** 2026-07-18

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Diagram](#architecture-diagram)
4. [Technology Stack](#technology-stack)
5. [Directory Structure](#directory-structure)
6. [Core Components](#core-components)
7. [Data Flow](#data-flow)
8. [Database Schema](#database-schema)
9. [API Routes & Endpoints](#api-routes--endpoints)
10. [Audio Processing Pipeline](#audio-processing-pipeline)
11. [Inference Engines](#inference-engines)
12. [Deployment & Configuration](#deployment--configuration)
13. [Error Handling & Recovery](#error-handling--recovery)
14. [Performance Considerations](#performance-considerations)
15. [Security & Privacy](#security--privacy)

---

## Executive Summary

**Stagecraft** is a local-first speech coaching application built with Next.js and powered by Gemma 4 native audio understanding. It records user speeches, transcribes them, and provides real-time AI-driven coaching feedback using Toastmasters-standard rubrics. The application prioritizes privacy by running on local infrastructure (Ollama) while maintaining optional cloud fallback capabilities.

### Key Features
- 🎤 Browser-based audio recording with real-time visualization
- 🤖 Dual-inference support (local Ollama + cloud Gemini fallback)
- 📊 Objective metrics (WPM, filler words, pace category)
- 📈 Progress tracking with historical session review
- 🎯 Goal-based coaching with personalized focus areas
- 💾 Local SQLite storage with WAV audio archiving

---

## System Overview

### High-Level Flow

```
User Records Speech
        ↓
Browser MediaRecorder (WebM/Ogg)
        ↓
Client-side WAV Conversion (16kHz mono)
        ↓
POST /api/analyze (base64 WAV payload)
        ↓
Server: Audio Preparation (normalization, amplification, trimming)
        ↓
Branch: Local Ollama OR Cloud Gemini
        ├→ Ollama: Transcribe + Evaluate (two-stage)
        └→ Gemini: Transcribe + Evaluate (unified)
        ↓
Structured Coaching Evaluation (Zod validated)
        ↓
Objective Metrics Computation
        ↓
SQLite Session + Goal Storage
        ↓
Return Coaching Data to UI
        ↓
Display Results & Progress Tracking
```

### Core Responsibilities

| Component | Responsibility |
|-----------|-----------------|
| **Frontend (React)** | Audio capture, real-time visualization, session review UI |
| **Next.js API Routes** | Request validation, orchestration, response formatting |
| **Audio Processing** | WAV encoding, normalization, quality checks |
| **LLM Inference** | Transcription, coaching evaluation, structured output |
| **Database (SQLite)** | Session persistence, goal tracking, user preferences |
| **Storage** | WAV file archiving, session history |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Web Browser (Client)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Next.js App Router (React Server + Client Components)    │ │
│  │                                                             │ │
│  │  UI Pages:                                                  │ │
│  │  • /                    (Practice Panel)                    │ │
│  │  • /sessions/:id        (Session Review)                   │ │
│  │  • /progress            (Metrics & Trends)                 │ │
│  │  • /history             (Past Sessions)                    │ │
│  │  • /goals               (Goal Management)                  │ │
│  │  • /settings            (Preferences & Config)             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │        Client-Side Audio Components                        │ │
│  │  • AudioRecorder (MediaRecorder + MediaStream)             │ │
│  │  • blobToWav16kMono (WebM → 16kHz PCM-16 WAV)            │ │
│  │  • AudioPreview (Playback visualization)                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓ (Fetch POST)
┌─────────────────────────────────────────────────────────────────┐
│                  Next.js Backend Server                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               API Routes (Node.js Runtime)                 │ │
│  │  POST /api/analyze              (Main coaching endpoint)   │ │
│  │  GET  /api/sessions/:id         (Session retrieval)        │ │
│  │  GET  /api/goals                (Goal listing)             │ │
│  │  POST /api/goals                (Goal creation)            │ │
│  │  GET  /api/progress             (Metrics aggregation)      │ │
│  │  GET  /api/health               (Liveness check)           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │    Core Processing Libraries (TypeScript/Node.js)         │ │
│  │                                                             │ │
│  │  Audio Pipeline:                                            │ │
│  │  ├─ audioPrep.ts      (WAV normalization & amplification)  │ │
│  │  ├─ wav.ts            (WAV parsing & encoding)             │ │
│  │  └─ asr.ts            (Transcription utilities)            │ │
│  │                                                             │ │
│  │  AI Inference:                                              │ │
│  │  ├─ gemma.ts          (Ollama/Google orchestration)        │ │
│  │  ├─ schema.ts         (Zod validation schemas)             │ │
│  │  └─ transcriptQuality.ts (Gibberish detection)             │ │
│  │                                                             │ │
│  │  Business Logic:                                            │ │
│  │  ├─ metrics.ts        (WPM, filler%, pace analysis)        │ │
│  │  ├─ fillers.ts        (Filler word lexicon)                │ │
│  │  └─ db.ts             (Database operations)                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            ↙ (Local Inference)        ↘ (Cloud Fallback)
┌──────────────────────────────┐   ┌──────────────────────────────┐
│   Ollama + Gemma 4 E4B       │   │  Google AI Studio (Gemini)   │
│                              │   │                              │
│  /api/chat (multimodal)      │   │  generateContent API         │
│  • Audio → Image embedding   │   │  • Audio inlining            │
│  • Text prompt               │   │  • Structured JSON output    │
│  • Streaming disabled        │   │  • Fallback for reliability  │
└──────────────────────────────┘   └──────────────────────────────┘
            ↓                               ↓
        [Transcription + Coaching Evaluation JSON]
            ↓                               ↓
            └──────────────┬────────────────┘
                           ↓
         ┌─────────────────────────────────┐
         │   Server-Side Validation        │
         │   (Zod Schema Enforcement)      │
         └─────────────────────────────────┘
                           ↓
         ┌─────────────────────────────────┐
         │    Compute Objective Metrics    │
         │  • WPM / Filler Rate / Duration │
         │  • Pace categorization          │
         │  • Confidence reconciliation    │
         └─────────────────────────────────┘
                           ↓
         ┌─────────────────────────────────┐
         │   Persist to SQLite Database    │
         │  • Session record storage       │
         │  • Goal tracking updates        │
         │  • Audio file archiving         │
         └─────────────────────────────────┘
                           ↓
         ┌─────────────────────────────────┐
         │   Response to Client UI         │
         │   (Coaching + Metrics JSON)     │
         └─────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework:** Next.js 16.2.10 (App Router, React 19.2.4)
- **Styling:** Tailwind CSS v4 with PostCSS
- **Data Visualization:** Recharts 3.9.2
- **Type System:** TypeScript 5.x
- **Validation:** Zod 4.4.3

### Backend
- **Runtime:** Node.js (Next.js ServerFunctions + API Routes)
- **Database:** SQLite 3 with WAL (better-sqlite3 12.11.1)
- **Audio Processing:** Web Audio API (browser) + WAV parsing (Node.js)
- **LLM Orchestration:** Ollama + Google Generative AI SDK

### Infrastructure
- **Local Inference:** Ollama (gemma4:e4b or gemma4:12b)
- **Cloud Fallback:** Google AI Studio (Gemini models)
- **Storage:** Local filesystem (data/audio/) + SQLite

### DevOps & Tooling
- **Package Manager:** npm
- **Build Tool:** Turbopack (built into Next.js)
- **Linting:** ESLint 9
- **Scripting:** TSX (TypeScript executor)

---

## Directory Structure

```
GemmaProject/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Home (Practice Panel)
│   │   ├── globals.css               # Global styles
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   │   └── route.ts          # Main coaching endpoint
│   │   │   ├── audio/
│   │   │   │   └── [id]/route.ts     # Audio file serving
│   │   │   ├── goals/
│   │   │   │   └── route.ts          # Goal CRUD
│   │   │   ├── health/
│   │   │   │   └── route.ts          # Liveness check
│   │   │   ├── sessions/
│   │   │   │   ├── route.ts          # List sessions
│   │   │   │   └── [id]/route.ts     # Get session details
│   │   │   └── settings/
│   │   │       └── fillers/
│   │   │           └── route.ts      # Filler word settings
│   │   ├── goals/
│   │   │   └── page.tsx              # Goal management UI
│   │   ├── history/
│   │   │   └── page.tsx              # Session history UI
│   │   ├── progress/
│   │   │   └── page.tsx              # Metrics & trends UI
│   │   ├── sessions/
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Session review UI
│   │   └── settings/
│   │       └── page.tsx              # User settings UI
│   │
│   ├── components/                   # Reusable React components
│   │   ├── AppNav.tsx                # Navigation header
│   │   ├── AudioRecorder.tsx         # MediaRecorder wrapper
│   │   ├── GoalsPanel.tsx            # Goal creation/editing
│   │   ├── HistoryList.tsx           # Session list view
│   │   ├── PracticePanel.tsx         # Main recording UI
│   │   ├── ProgressDashboard.tsx     # Metrics visualization
│   │   ├── SessionReviewView.tsx     # Detailed feedback UI
│   │   └── SettingsPanel.tsx         # User preferences UI
│   │
│   └── lib/                          # Shared utilities & business logic
│       ├── asr.ts                    # Transcription prompts & utilities
│       ├── audioPrep.ts              # WAV preprocessing
│       ├── db.ts                     # SQLite operations
│       ├── fillers.ts                # Filler word lexicon
│       ├── gemma.ts                  # LLM orchestration
│       ├── metrics.ts                # Objective metric computation
│       ├── schema.ts                 # Zod validation schemas
│       ├── transcriptQuality.ts      # Quality heuristics
│       ├── types.ts                  # TypeScript interfaces
│       └── wav.ts                    # WAV encoding/decoding
│
├── scripts/                          # Development & automation scripts
│   ├── seed-demo.ts                  # Load demo sessions
│   ├── prepare-demo.ts               # Fetch sample audio
│   ├── chunk-asr.ts                  # Test chunked transcription
│   ├── verify-all.ts                 # Integration test suite
│   └── ... (10+ additional test/debug scripts)
│
├── public/
│   └── demo/                         # Demo audio files
│
├── data/                             # Runtime data (git-ignored)
│   ├── coach.db                      # SQLite database
│   └── audio/                        # Session WAV files
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── .env.example
├── .env.local                        # (user-created)
├── README.md
└── ARCHITECTURE.md (this file)
```

---

## Core Components

### 1. AudioRecorder Component (`src/components/AudioRecorder.tsx`)

**Responsibility:** Capture audio from user's microphone via `MediaRecorder` API.

**Key Features:**
- Automatic codec selection (WebM Opus → fallback to generic WebM)
- Real-time elapsed time display
- Error handling for microphone permission denial
- Cleanup of resources on unmount

**Props:**
```typescript
type Props = {
  onRecordingReady: (blob: Blob, durationSeconds: number) => void;
  disabled?: boolean;
};
```

**Flow:**
1. Request microphone access
2. Create MediaRecorder with optimal codec
3. Collect data chunks every 250ms
4. On stop, create Blob and pass duration to parent
5. Clean up streams and timers

---

### 2. PracticePanel Component (`src/components/PracticePanel.tsx`)

**Responsibility:** Orchestrate the main recording & submission UI.

**Key Features:**
- Selection of speech type (prepared, table_topics, evaluation, interview_pitch)
- Optional coaching goal selection
- Inference mode toggle (local/cloud/auto)
- Real-time audio preview playback
- Loading state with animations
- Error display and retry logic

**Data Flow:**
1. User fills in form (speech type, goal, mode preference)
2. Click "Record" → AudioRecorder captures blob
3. Convert blob to 16kHz mono WAV via `blobToWav16kMono()`
4. Encode as base64 → POST to `/api/analyze`
5. On success, display SessionReviewView
6. On error, show error message with retry

---

### 3. SessionReviewView Component (`src/components/SessionReviewView.tsx`)

**Responsibility:** Display coaching feedback and objective metrics.

**Key Features:**
- Transcript display with filler word highlighting
- Rubric scores (1-5 scales)
- Strengths, improvement areas, and suggested drills
- Historical comparison (if available)
- Audio playback controls
- Navigation to full session details

---

### 4. ProgressDashboard Component (`src/components/ProgressDashboard.tsx`)

**Responsibility:** Visualize trends over time.

**Key Features:**
- Line chart: Overall scores over sessions
- Bar chart: Rubric category performance
- Statistics: Improvement rate, consistency metrics
- Filters by goal or speech type
- Export/sharing options (future)

---

### 5. GoalsPanel Component (`src/components/GoalsPanel.tsx`)

**Responsibility:** Goal creation, editing, and tracking.

**Key Features:**
- Suggested goals from `nextFocusArea` field
- Manual goal creation
- Mark goals as complete/active
- Link goals to coaching sessions
- Progress toward goal (sessions completed, etc.)

---

## Data Flow

### End-to-End Recording → Coaching Feedback

```
1. USER INTERFACE (Browser)
   └─ PracticePanel: User selects speech type, goal, mode
   └─ User clicks "Record"
   └─ AudioRecorder captures WebM/Ogg blob
   └─ onRecordingReady callback triggered

2. AUDIO CONVERSION (Browser)
   └─ blobToWav16kMono(blob) called
   └─ Decode WebM via AudioContext.decodeAudioData()
   └─ Resample to 16kHz mono
   └─ Encode as 44-byte RIFF header + PCM-16 samples
   └─ Return Blob

3. REQUEST SUBMISSION (Browser → Server)
   └─ Convert WAV Blob to base64
   └─ Build POST body:
      {
        audioBase64: "UklGRi4A...",
        durationSeconds: 42.5,
        speechType: "prepared",
        goal: "reduce_fillers",
        preferMode: "local"
      }
   └─ POST /api/analyze

4. SERVER VALIDATION (Node.js)
   └─ Parse & validate request body (Zod)
   └─ Decode base64 to Buffer
   └─ Verify RIFF header
   └─ Check payload size > 100 bytes

5. AUDIO PREPROCESSING (Node.js)
   └─ prepareWavForGemma():
      • Parse RIFF/fmt/data chunks
      • Extract channels, sample rate, bit depth
      • Mix to mono if needed
      • Measure peak amplitude
      • Amplify if quiet (< 55% of target)
      • Trim to maxSeconds (28s default)
      • Normalize to PCM-16
      • Write new WAV file with header

6. LLM INFERENCE (Branching)
   └─ Determine mode: local (Ollama) or cloud (Gemini)

   LOCAL PATH (Ollama):
   ├─ Full-pass transcription:
   │  └─ asrOnce(model, wavBase64, numPredict)
   │     └─ ollamaChat() to /api/chat
   │     └─ Gemma4 processes audio as image embedding
   │     └─ Returns raw text transcript
   │
   ├─ Validate transcript:
   │  ├─ Check for ASR prompt contamination
   │  ├─ Detect gibberish / looped audio
   │  └─ Ensure min word count (>= 5 words)
   │
   ├─ Chunked transcription (if full fails or > 6s):
   │  ├─ Split audio into 8s chunks with 1.5s overlap
   │  ├─ Transcribe each chunk independently
   │  ├─ Stitch using context windows
   │  └─ Pick best (longest, lowest contamination)
   │
   └─ Coaching evaluation:
      ├─ Send transcript to coachFromTranscriptWithOllama()
      ├─ Send coaching prompt + transcript to /api/chat
      ├─ Gemma4 returns structured JSON (enforced via format schema)
      ├─ Parse & validate against coachEvaluationSchema
      └─ Override transcript field with verified ASR text

   CLOUD PATH (Gemini):
   ├─ callGoogleAiStudioOnce(wavBase64, speechType, goal)
   ├─ POST to https://generativelanguage.googleapis.com/.../generateContent
   ├─ Include audio as inlineData + coaching prompt
   ├─ Gemini performs transcription + evaluation in one call
   ├─ Parse response and validate against schema
   └─ Set transcriptionConfidence based on response

7. METRICS COMPUTATION (Node.js)
   └─ computeObjectiveMetrics(transcript, durationSeconds):
      ├─ Word count from transcript
      ├─ WPM = wordCount / (durationSeconds / 60)
      ├─ Scan for filler words (um, uh, like, you know, etc.)
      ├─ FW_per_min = fillerCount / (durationSeconds / 60)
      ├─ Categorize pace (slow < 130, balanced 130-180, fast > 180 WPM)
      └─ Return ObjectiveMetrics struct

8. RESULT RECONCILIATION (Node.js)
   └─ Merge AI-generated scores with objective metrics
   └─ reconcileFillerScore():
      ├─ AI estimated fillerControl (1-5)
      ├─ Computed filler_words_per_minute
      ├─ If filler_wpm > 3 but AI_score >= 4: note discrepancy
      └─ Return reconciliation message for UI

9. DATABASE PERSISTENCE (Node.js)
   └─ saveAudioFile(sessionId, wavBuffer):
      ├─ Write to data/audio/{sessionId}.wav
      └─ Return relative path
   
   └─ createSession(data):
      ├─ Generate UUID for session.id
      ├─ Insert into sessions table
      ├─ Extract userId from context (or use 'default')
      └─ Return SessionRecord

   └─ upsertSuggestedGoal(nextFocusArea):
      ├─ Check if goal title already exists
      ├─ If new: INSERT with status='suggested'
      ├─ If exists: UPDATE status (de-duplicate)

10. RESPONSE TO CLIENT (JSON)
    └─ Return 200 with:
       {
         session: SessionRecord,
         metrics: ObjectiveMetrics,
         reconcileNote: string,
         inferenceMode: "local" | "cloud",
         audioMeta: { durationSeconds, format }
       }

11. UI RENDERING (Browser)
    └─ Display SessionReviewView with:
       ├─ Transcript
       ├─ Overall score + rubric scores
       ├─ Strengths & improvement areas with evidence
       ├─ Suggested drills
       ├─ Objective metrics (WPM, filler rate, duration)
       └─ Playback controls
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```
- **Single row per user** (default user ID = 'default')
- Future: Multi-user support

### Sessions Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  speech_type TEXT NOT NULL,           -- 'prepared' | 'table_topics' | 'evaluation' | 'interview_pitch'
  goal TEXT NOT NULL,                  -- 'reduce_fillers' | 'improve_pacing' | 'strengthen_opening' | 'vocal_variety' | 'none'
  audio_path TEXT,                     -- Relative path to WAV file
  transcript TEXT NOT NULL,
  inference_mode TEXT NOT NULL,        -- 'local' | 'cloud'
  duration_seconds REAL NOT NULL,
  word_count INTEGER NOT NULL,
  words_per_minute INTEGER NOT NULL,
  filler_word_count INTEGER NOT NULL,
  filler_words_per_minute REAL NOT NULL,
  pace_category TEXT NOT NULL,         -- 'slow' | 'balanced' | 'fast'
  overall_score INTEGER NOT NULL,      -- 0-100
  scores_json TEXT NOT NULL,           -- JSON: { clarity, pace, fillerControl, structure, confidence, vocalVariety }
  strengths_json TEXT NOT NULL,        -- JSON array of strings
  improvement_areas_json TEXT NOT NULL,-- JSON array of { area, evidence, suggestion }
  drills_json TEXT NOT NULL,           -- JSON array of strings
  next_focus_area TEXT NOT NULL,
  transcription_confidence TEXT NOT NULL, -- 'high' | 'medium' | 'low'
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Goals Table
```sql
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,                -- 'active' | 'completed' | 'suggested'
  created_at TEXT NOT NULL,
  completed_at TEXT,                   -- NULL until marked complete
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Settings Table
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```
- Flexible key-value store for user preferences
- Examples: `preferInferenceMode`, `defaultSpeechType`, etc.

---

## API Routes & Endpoints

### POST /api/analyze

**Purpose:** Main coaching endpoint. Accepts audio, processes it, and returns evaluation.

**Request Body:**
```typescript
{
  audioBase64: string;           // WAV file encoded as base64
  durationSeconds: number;       // User-measured duration (0.5-1200s)
  speechType: SpeechType;        // 'prepared' | 'table_topics' | 'evaluation' | 'interview_pitch'
  goal: PracticeGoal;            // 'reduce_fillers' | 'improve_pacing' | 'strengthen_opening' | 'vocal_variety' | 'none'
  preferMode?: InferenceMode;    // 'local' | 'cloud' | undefined (auto)
}
```

**Response (200 OK):**
```typescript
{
  session: SessionRecord;
  metrics: ObjectiveMetrics;
  reconcileNote: string;
  inferenceMode: 'local' | 'cloud';
  audioMeta: { durationSeconds: number };
}
```

**Error Responses:**
- `400 Bad Request` — Invalid payload, no audio, non-WAV format
- `500 Internal Server Error` — LLM timeout, Ollama unavailable, parse failure

**Implementation:** `src/app/api/analyze/route.ts`

---

### GET /api/sessions

**Purpose:** List all sessions (paginated).

**Query Parameters:**
```
?limit=50&offset=0&order=desc
```

**Response (200 OK):**
```typescript
{
  sessions: SessionRecord[];
  total: number;
}
```

**Implementation:** `src/app/api/sessions/route.ts`

---

### GET /api/sessions/:id

**Purpose:** Retrieve a single session with full details.

**Response (200 OK):**
```typescript
{
  session: SessionRecord;
  audioUrl?: string;  // Relative URL to audio file
}
```

**Error Responses:**
- `404 Not Found` — Session does not exist

**Implementation:** `src/app/api/sessions/[id]/route.ts`

---

### GET /api/audio/:id

**Purpose:** Serve session audio file.

**Response (200 OK):** WAV file (audio/wav)

**Caching:** Cache-Control: public, max-age=86400

**Implementation:** `src/app/api/audio/[id]/route.ts`

---

### GET /api/goals

**Purpose:** List all goals (active, completed, suggested).

**Query Parameters:**
```
?status=active&userId=default
```

**Response (200 OK):**
```typescript
{
  goals: GoalRecord[];
}
```

**Implementation:** `src/app/api/goals/route.ts`

---

### POST /api/goals

**Purpose:** Create or update a goal.

**Request Body:**
```typescript
{
  title: string;
  status: GoalStatus;  // 'active' | 'completed' | 'suggested'
}
```

**Response (201 Created):**
```typescript
{
  goal: GoalRecord;
}
```

**Implementation:** `src/app/api/goals/route.ts`

---

### GET /api/progress

**Purpose:** Aggregate metrics across sessions.

**Query Parameters:**
```
?timeframe=7d&speechType=prepared&goal=reduce_fillers
```

**Response (200 OK):**
```typescript
{
  averageScore: number;
  scoresTrend: { date: string; score: number }[];
  improvementRate: number;  // % change over timeframe
  totalSessions: number;
  consistency: number;  // Std dev of scores
}
```

**Implementation:** `src/app/api/progress/route.ts`

---

### GET /api/health

**Purpose:** Liveness check for orchestration (K8s, load balancers).

**Response (200 OK):**
```typescript
{
  status: 'ok';
  timestamp: string;
  ollamaAvailable?: boolean;
  databaseAvailable?: boolean;
}
```

**Implementation:** `src/app/api/health/route.ts`

---

### GET /api/settings/fillers

**Purpose:** Retrieve filler word lexicon.

**Response (200 OK):**
```typescript
{
  fillers: string[];
  version: string;
}
```

**Implementation:** `src/app/api/settings/fillers/route.ts`

---

## Audio Processing Pipeline

### Stage 1: Browser-Side Conversion

**Input:** MediaRecorder Blob (WebM/Ogg/etc.)  
**Output:** WAV Blob (16kHz mono, PCM-16)

```typescript
// src/lib/wav.ts → blobToWav16kMono()
async function blobToWav16kMono(blob: Blob): Promise<Blob> {
  // 1. Decode WebM/Ogg using AudioContext API
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  // 2. Resample to 16kHz
  const targetRate = 16000;
  const offline = new OfflineAudioContext(
    1,                                              // 1 channel (mono)
    Math.ceil(decoded.duration * targetRate),       // Output frame count
    targetRate
  );

  // 3. Mix to mono if needed
  const monoBuffer = offline.createBuffer(1, decoded.length, decoded.sampleRate);
  const mixed = monoBuffer.getChannelData(0);
  for (let i = 0; i < decoded.length; i++) {
    let sum = 0;
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      sum += decoded.getChannelData(c)[i];
    }
    mixed[i] = sum / decoded.numberOfChannels;
  }

  // 4. Render to target sample rate
  const source = offline.createBufferSource();
  source.buffer = monoBuffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  // 5. Encode as WAV
  return encodeWav(samples, targetRate);
}
```

### Stage 2: Server-Side Preparation

**Input:** Base64-encoded WAV (16kHz mono, PCM-16)  
**Output:** Normalized & amplified WAV Buffer

```typescript
// src/lib/audioPrep.ts → prepareWavForGemma()
export function prepareWavForGemma(
  input: Buffer,
  options: { maxSeconds?: number; targetPeak?: number } = {}
): { wav: Buffer; durationSeconds: number; amplified: boolean; trimmed: boolean } {
  // 1. Validate RIFF header
  if (input.subarray(0, 4).toString("ascii") !== "RIFF") {
    throw new Error("Audio is not a RIFF/WAV file.");
  }

  // 2. Parse RIFF chunks (fmt, data)
  let offset = 12;
  let channels = 1, sampleRate = 16000, bitsPerSample = 16;
  let dataOffset = -1, dataSize = 0;

  while (offset + 8 <= input.length) {
    const id = input.subarray(offset, offset + 4).toString("ascii");
    const size = input.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (id === "fmt ") {
      channels = input.readUInt16LE(chunkStart + 2);
      sampleRate = input.readUInt32LE(chunkStart + 4);
      bitsPerSample = input.readUInt16LE(chunkStart + 14);
    } else if (id === "data") {
      dataOffset = chunkStart;
      dataSize = size;
      break;
    }
    offset = chunkStart + size + (size % 2);
  }

  // 3. Validate bit depth
  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported bit depth: ${bitsPerSample}. Expected 16-bit.`);
  }

  // 4. Mix to mono & measure peak
  const bytesPerFrame = channels * 2;
  let frameCount = Math.floor(dataSize / bytesPerFrame);
  const maxFrames = Math.floor((options.maxSeconds ?? 28) * sampleRate);
  let trimmed = false;

  if (frameCount > maxFrames) {
    frameCount = maxFrames;
    trimmed = true;
  }

  const mono = new Int16Array(frameCount);
  let peak = 0;
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      sum += input.readInt16LE(dataOffset + i * bytesPerFrame + c * 2);
    }
    const sample = Math.round(sum / channels);
    mono[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  // 5. Amplify if quiet
  const targetPeak = options.targetPeak ?? 24000;
  let amplified = false;
  let gain = 1;
  if (peak > 0 && peak < targetPeak * 0.55) {
    gain = Math.min(12, targetPeak / peak);  // Max 12x gain
    amplified = gain > 1.05;
  }

  // 6. Write new WAV file
  const outDataSize = frameCount * 2;
  const out = Buffer.alloc(44 + outDataSize);

  // RIFF header
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + outDataSize, 4);
  out.write("WAVE", 8);

  // fmt chunk
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);          // PCM
  out.writeUInt16LE(1, 22);          // 1 channel
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);

  // data chunk
  out.write("data", 36);
  out.writeUInt32LE(outDataSize, 40);

  // PCM samples with gain + clipping
  for (let i = 0; i < frameCount; i++) {
    let s = Math.round(mono[i] * gain);
    s = Math.max(-32768, Math.min(32767, s));
    out.writeInt16LE(s, 44 + i * 2);
  }

  return {
    wav: out,
    durationSeconds: frameCount / sampleRate,
    amplified,
    trimmed,
  };
}
```

### Stage 3: Quality Validation

```typescript
// src/lib/asr.ts → isUsableTranscript(), isPromptContaminated()

export function isUsableTranscript(text: string): boolean {
  if (!text || text.length < 10) return false;
  const words = text.split(/\s+/).length;
  return words >= 5;  // Minimum 5 words
}

export function isPromptContaminated(text: string): boolean {
  const contaminationPatterns = [
    /transcribe the audio/i,
    /repeat what you hear/i,
    /ASR system/i,
    /VERBATIM/i,
  ];
  return contaminationPatterns.some(re => re.test(text));
}

export function stripPromptContamination(text: string): string {
  // Remove leading/trailing system messages
  return text
    .replace(/^[^A-Za-z0-9]*/g, '')
    .replace(/[^A-Za-z0-9.!?]*$/g, '')
    .trim();
}
```

---

## Inference Engines

### Local Inference (Ollama)

**Supported Models:**
- `gemma4:e4b` (default, faster)
- `gemma4:12b` (more accurate for ASR)

**Two-Stage Process:**

1. **Transcription (ASR):**
   - Model: `gemma4:12b` or env var `OLLAMA_ASR_MODEL`
   - Prompt: `VERBATIM_ASR_PROMPT` (system + user)
   - Endpoint: `POST http://localhost:11434/api/chat`
   - Full-pass: Send entire WAV as base64, get transcript
   - Fallback: If full fails, chunk into 8s overlapping segments
   - Output: Raw text → strip contamination → validate

2. **Coaching Evaluation:**
   - Model: `gemma4:latest` (E4B) or env var `OLLAMA_MODEL`
   - Prompt: `buildCoachUserPrompt()` + system instruction
   - Format: JSON schema enforced via Ollama native format parameter
   - Output: Structured JSON matching `coachEvaluationSchema`

**Timeout:** 180s (configurable via `AI_TIMEOUT_MS`)

**Retry:** 1 attempt on failure (configurable via `AI_MAX_RETRIES`)

---

### Cloud Inference (Google Gemini)

**Prerequisite:** `GOOGLE_API_KEY` or `GEMINI_API_KEY` environment variable

**Model:** `gemma-4-e4b-it` (configurable via `CLOUD_GEMMA_MODEL`)

**Unified Process:**
- Single API call combines transcription + coaching evaluation
- Audio sent as `inlineData` (mimeType: audio/wav)
- System instruction includes ASR + coaching prompts
- Response: JSON structured with `responseSchema` enforcement
- Output: Validated against `coachEvaluationSchema`

**Timeout:** 180s

**Error Handling:**
- If local mode fails and cloud fallback enabled → retry with Gemini
- If both fail → return 500 with appropriate error message

---

## Deployment & Configuration

### Environment Variables

Create `.env.local` file in project root:

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:latest
OLLAMA_ASR_MODEL=gemma4:12b

# Google AI Studio (optional, for cloud fallback)
GOOGLE_API_KEY=<your-api-key>

# Inference Mode
INFERENCE_MODE=local              # 'local' | 'cloud' | 'auto'
AI_TIMEOUT_MS=180000               # Timeout per request (ms)
AI_MAX_RETRIES=1                   # Retry failed inferences

# Database
DATABASE_PATH=data/coach.db

# Node Environment
NODE_ENV=development               # 'development' | 'production'
PORT=3000
```

### Running Locally

```bash
# 1. Start Ollama
ollama serve

# 2. In another terminal, pull model
ollama pull gemma4:latest
# Optionally pull ASR model
ollama pull gemma4:12b

# 3. Clone & setup
git clone <repo>
cd GemmaProject
npm install

# 4. Copy environment
cp .env.example .env.local
# Edit .env.local with your settings

# 5. Seed demo data (optional)
npm run seed

# 6. Run dev server
npm run dev

# 7. Open browser
open http://localhost:3000
```

### Production Deployment

**Docker:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start
ENV NODE_ENV=production
CMD ["npm", "start"]
```

**Notes:**
- Ollama must be running on accessible network (not inside container)
- SQLite database persists to `/app/data/` (mount as volume)
- Audio files stored in `/app/data/audio/` (mount as volume)

---

## Error Handling & Recovery

### Audio Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| "Microphone access is required" | User denied mic permission | Prompt user to enable in browser settings |
| "Audio is not a RIFF/WAV file" | Codec not supported | Retry with different codec, use fallback audio |
| "Unable to decode audio data" | Corrupted or unsupported format | Clear browser cache, re-record |
| "Audio is not a RIFF/WAV file" (server) | Base64 decode issue | Validate encoding on client |

### LLM Inference Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| "Ollama error 404: model not found" | Model not pulled | Pull model: `ollama pull gemma4:12b` |
| "Connection refused" | Ollama not running | Start Ollama: `ollama serve` |
| "Timeout / abort" | Inference too slow | Increase `AI_TIMEOUT_MS`, use chunked ASR |
| "Model response was not valid JSON" | Malformed LLM output | Retry (1 attempt), fallback to cloud |
| "Transcript still contains ASR instructions" | Prompt leakage | Filter contamination, stricter validation |

### Graceful Degradation

```typescript
// src/lib/gemma.ts
try {
  // Try local inference
  return await evaluateLocalTwoStage(wav, speechType, goal);
} catch (error) {
  if (INFERENCE_MODE === 'auto' && GOOGLE_API_KEY) {
    console.warn("Local inference failed, falling back to cloud:", error);
    return await callGoogleAiStudioOnce(wavBase64, speechType, goal);
  }
  throw error;
}
```

---

## Performance Considerations

### Bottlenecks

1. **LLM Inference** (dominant)
   - Transcription: 5-30s (depends on audio length)
   - Coaching evaluation: 3-10s
   - Total: ~10-40s per session

2. **Audio Processing**
   - Browser WAV encoding: < 500ms
   - Server WAV parsing & normalization: < 100ms
   - Negligible overhead

3. **Database Operations**
   - Session insert: < 10ms
   - Query by ID: < 5ms
   - Aggregate query (progress): 20-100ms (depends on session count)

### Optimization Strategies

1. **Caching:**
   - Cache transcripts for identical audio hashes (future)
   - Cache rubric scores if re-evaluating same transcript

2. **Chunked ASR:**
   - For audio > 6s, enable chunked processing
   - Parallel chunk processing (future)

3. **Database Indexing:**
   - Add index on `(user_id, created_at)` for history queries
   - Add index on `(goal, status)` for goal queries

4. **Frontend:**
   - Lazy load charts in ProgressDashboard
   - Paginate session history (50 per page)
   - Cache session data in React Context / TanStack Query (future)

---

## Security & Privacy

### Privacy by Design

1. **Local-First Processing:**
   - Audio never leaves user's machine (by default)
   - Ollama runs locally (no cloud transmission)
   - Database stored locally (SQLite file)

2. **Optional Cloud:**
   - User opt-in via environment variable
   - Explicit fallback only if local fails
   - Google Gemini API key required (user-managed)

3. **Audio Storage:**
   - WAV files stored in `data/audio/{sessionId}.wav`
   - File permissions: owner-readable only (future: implement)
   - Clear command to delete old audio (future feature)

### Input Validation

```typescript
// All requests validated with Zod
const bodySchema = z.object({
  audioBase64: z.string().min(1),
  durationSeconds: z.number().positive().max(60 * 20),  // Max 20 min
  speechType: z.enum([...]),
  goal: z.enum([...]),
  preferMode: z.enum(['local', 'cloud']).optional(),
});

// Audio buffer size check
if (wavBuffer.length < 100) {
  throw new Error("Audio payload too small");
}
if (wavBuffer.length > 50 * 1024 * 1024) {  // 50MB max
  throw new Error("Audio payload too large");
}
```

### Output Validation

```typescript
// LLM outputs validated against strict schema
const evaluation = coachEvaluationSchema.parse(extractJson(raw));

// Scores clamped to valid ranges
evaluation.scores.clarity = Math.min(5, Math.max(1, evaluation.scores.clarity));
evaluation.overallScore = Math.min(100, Math.max(0, evaluation.overallScore));

// Transcript verified to be verbatim (not rewritten)
if (evaluation.transcript !== providedTranscript) {
  console.warn("Transcript mismatch detected, using verified ASR version");
  evaluation.transcript = providedTranscript;
}
```

### Future Security Enhancements

1. **Authentication:** Multi-user support with OAuth/SAML
2. **Encryption:** AES-256 for audio files at rest
3. **Audit Logging:** Track all API access & data mutations
4. **Rate Limiting:** Per-user request throttling
5. **HTTPS/TLS:** Enforce in production
6. **CORS:** Restrict API to whitelisted origins

---

## Appendix: Quick Reference

### Key Files by Responsibility

| Task | Files |
|------|-------|
| **Add new speech type** | `src/lib/types.ts`, prompts in `src/lib/asr.ts` |
| **Add new coaching goal** | `src/lib/types.ts`, `src/lib/fillers.ts` |
| **Add filler word** | `src/lib/fillers.ts` (lexicon) |
| **Modify coaching rubric** | `src/lib/schema.ts`, `src/lib/gemma.ts` (prompts) |
| **Adjust audio normalization** | `src/lib/audioPrep.ts` (peak, gain, trimming) |
| **Add new UI page** | `src/app/{feature}/page.tsx` + route in `src/app/api/` |
| **Modify database schema** | `src/lib/db.ts` (migration needed) |
| **Add visualization** | `src/components/ProgressDashboard.tsx` (Recharts) |

### Test Scripts

```bash
npm run seed              # Load 4 demo sessions
npm run verify            # Integration test suite
npm run prepare-demo      # Download sample audio
npm run dev               # Local dev server
npm run build             # Production build
npm run lint              # ESLint
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-07-18 | Initial release |

---

## Support & Contact

- **GitHub Issues:** <repo-url>/issues
- **Documentation:** [README.md](README.md)
- **Local Inference:** [Ollama Docs](https://ollama.ai)
- **Cloud Fallback:** [Google Gemini API](https://ai.google.dev)
