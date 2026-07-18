import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  GoalStatus,
  InferenceMode,
  ImprovementArea,
  PaceCategory,
  PracticeGoal,
  RubricScores,
  SessionRecord,
  SpeechType,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const AUDIO_DIR = path.join(DATA_DIR, "audio");
const DB_PATH = path.join(DATA_DIR, "coach.db");

let db: Database.Database | null = null;

function ensureDirs() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

export function getDb(): Database.Database {
  if (db) return db;
  ensureDirs();
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      speech_type TEXT NOT NULL,
      goal TEXT NOT NULL,
      audio_path TEXT,
      transcript TEXT NOT NULL,
      inference_mode TEXT NOT NULL,
      duration_seconds REAL NOT NULL,
      word_count INTEGER NOT NULL,
      words_per_minute INTEGER NOT NULL,
      filler_word_count INTEGER NOT NULL,
      filler_words_per_minute REAL NOT NULL,
      pace_category TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      scores_json TEXT NOT NULL,
      strengths_json TEXT NOT NULL,
      improvement_areas_json TEXT NOT NULL,
      drills_json TEXT NOT NULL,
      next_focus_area TEXT NOT NULL,
      transcription_confidence TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const defaultUser = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get("default");
  if (!defaultUser) {
    db.prepare(
      "INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)",
    ).run("default", "Practice Speaker", new Date().toISOString());
  }

  return db;
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    speechType: row.speech_type as SpeechType,
    goal: row.goal as PracticeGoal,
    audioPath: row.audio_path ? String(row.audio_path) : null,
    transcript: String(row.transcript),
    inferenceMode: row.inference_mode as InferenceMode,
    durationSeconds: Number(row.duration_seconds),
    wordCount: Number(row.word_count),
    wordsPerMinute: Number(row.words_per_minute),
    fillerWordCount: Number(row.filler_word_count),
    fillerWordsPerMinute: Number(row.filler_words_per_minute),
    paceCategory: row.pace_category as PaceCategory,
    overallScore: Number(row.overall_score),
    scores: JSON.parse(String(row.scores_json)) as RubricScores,
    strengths: JSON.parse(String(row.strengths_json)) as string[],
    improvementAreas: JSON.parse(
      String(row.improvement_areas_json),
    ) as ImprovementArea[],
    drills: JSON.parse(String(row.drills_json)) as string[],
    nextFocusArea: String(row.next_focus_area),
    transcriptionConfidence: row.transcription_confidence as
      | "high"
      | "medium"
      | "low",
    createdAt: String(row.created_at),
  };
}

export function saveAudioFile(sessionId: string, wavBuffer: Buffer): string {
  ensureDirs();
  const filename = `${sessionId}.wav`;
  const fullPath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(fullPath, wavBuffer);
  return path.join("data", "audio", filename);
}

export function createSession(input: {
  id?: string;
  speechType: SpeechType;
  goal: PracticeGoal;
  audioPath: string | null;
  transcript: string;
  inferenceMode: InferenceMode;
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWordsPerMinute: number;
  paceCategory: PaceCategory;
  overallScore: number;
  scores: RubricScores;
  strengths: string[];
  improvementAreas: ImprovementArea[];
  drills: string[];
  nextFocusArea: string;
  transcriptionConfidence: "high" | "medium" | "low";
  createdAt?: string;
}): SessionRecord {
  const database = getDb();
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt ?? new Date().toISOString();

  database
    .prepare(
      `INSERT INTO sessions (
        id, user_id, speech_type, goal, audio_path, transcript, inference_mode,
        duration_seconds, word_count, words_per_minute, filler_word_count,
        filler_words_per_minute, pace_category, overall_score, scores_json,
        strengths_json, improvement_areas_json, drills_json, next_focus_area,
        transcription_confidence, created_at
      ) VALUES (
        @id, @user_id, @speech_type, @goal, @audio_path, @transcript, @inference_mode,
        @duration_seconds, @word_count, @words_per_minute, @filler_word_count,
        @filler_words_per_minute, @pace_category, @overall_score, @scores_json,
        @strengths_json, @improvement_areas_json, @drills_json, @next_focus_area,
        @transcription_confidence, @created_at
      )`,
    )
    .run({
      id,
      user_id: "default",
      speech_type: input.speechType,
      goal: input.goal,
      audio_path: input.audioPath,
      transcript: input.transcript,
      inference_mode: input.inferenceMode,
      duration_seconds: input.durationSeconds,
      word_count: input.wordCount,
      words_per_minute: input.wordsPerMinute,
      filler_word_count: input.fillerWordCount,
      filler_words_per_minute: input.fillerWordsPerMinute,
      pace_category: input.paceCategory,
      overall_score: input.overallScore,
      scores_json: JSON.stringify(input.scores),
      strengths_json: JSON.stringify(input.strengths),
      improvement_areas_json: JSON.stringify(input.improvementAreas),
      drills_json: JSON.stringify(input.drills),
      next_focus_area: input.nextFocusArea,
      transcription_confidence: input.transcriptionConfidence,
      created_at: createdAt,
    });

  return getSession(id)!;
}

export function getSession(id: string): SessionRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToSession(row) : null;
}

export function listSessions(limit = 50): SessionRecord[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?",
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToSession);
}

export function deleteSession(id: string): boolean {
  const session = getSession(id);
  if (!session) return false;

  if (session.audioPath) {
    const full = path.join(process.cwd(), session.audioPath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }

  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
  return true;
}

export function listGoals() {
  return getDb()
    .prepare(
      "SELECT id, user_id as userId, title, status, created_at as createdAt, completed_at as completedAt FROM goals WHERE user_id = ? ORDER BY created_at DESC",
    )
    .all("default") as Array<{
    id: string;
    userId: string;
    title: string;
    status: GoalStatus;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export function upsertSuggestedGoal(title: string) {
  const database = getDb();
  const existing = database
    .prepare(
      "SELECT id FROM goals WHERE user_id = ? AND title = ? AND status != 'completed'",
    )
    .get("default", title);
  if (existing) return;

  database
    .prepare(
      "INSERT INTO goals (id, user_id, title, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, NULL)",
    )
    .run(randomUUID(), "default", title, "suggested", new Date().toISOString());
}

export function getAudioAbsolutePath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}
