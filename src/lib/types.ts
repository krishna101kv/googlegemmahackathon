export type SpeechType =
  | "prepared"
  | "table_topics"
  | "evaluation"
  | "interview_pitch";

export type PracticeGoal =
  | "reduce_fillers"
  | "improve_pacing"
  | "strengthen_opening"
  | "vocal_variety"
  | "none";

export type InferenceMode = "local" | "cloud";

export type PaceCategory = "slow" | "balanced" | "fast";

export type GoalStatus = "active" | "completed" | "suggested";

export interface RubricScores {
  clarity: number;
  pace: number;
  fillerControl: number;
  structure: number;
  confidence: number;
  vocalVariety: number;
}

export interface ImprovementArea {
  area: string;
  evidence: string;
  suggestion: string;
}

export interface ObjectiveMetrics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWordsPerMinute: number;
  fillerMatches: string[];
  paceCategory: PaceCategory;
  repeatedWords: string[];
}

export interface CoachEvaluation {
  transcript: string;
  overallScore: number;
  scores: RubricScores;
  strengths: string[];
  improvementAreas: ImprovementArea[];
  drills: string[];
  nextFocusArea: string;
  transcriptionConfidence: "high" | "medium" | "low";
}

export interface SessionRecord {
  id: string;
  userId: string;
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
  createdAt: string;
}

export const SPEECH_TYPE_LABELS: Record<SpeechType, string> = {
  prepared: "Prepared speech",
  table_topics: "Table Topics",
  evaluation: "Evaluation practice",
  interview_pitch: "Interview or pitch",
};

export const GOAL_LABELS: Record<PracticeGoal, string> = {
  reduce_fillers: "Reduce filler words",
  improve_pacing: "Improve pacing",
  strengthen_opening: "Strengthen opening",
  vocal_variety: "Improve vocal variety",
  none: "No specific goal",
};
