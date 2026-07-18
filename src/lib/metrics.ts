import type { ObjectiveMetrics, PaceCategory } from "./types";

export const DEFAULT_FILLER_WORDS = [
  "um",
  "uh",
  "like",
  "you know",
  "so",
  "actually",
  "basically",
  "kind of",
  "sort of",
  "i mean",
] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function tokenizeWords(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function countFillerWords(
  transcript: string,
  fillerList: readonly string[] = DEFAULT_FILLER_WORDS,
): { count: number; matches: string[] } {
  const normalized = ` ${transcript.toLowerCase().replace(/[^\w\s'-]/g, " ")} `;
  const matches: string[] = [];

  // Longer phrases first so "you know" wins over single tokens
  const sorted = [...fillerList].sort((a, b) => b.length - a.length);

  let working = normalized;
  for (const filler of sorted) {
    const pattern = new RegExp(`\\b${escapeRegex(filler)}\\b`, "gi");
    const found = working.match(pattern);
    if (found) {
      matches.push(...found.map((m) => m.toLowerCase()));
      working = working.replace(pattern, " ");
    }
  }

  return { count: matches.length, matches };
}

export function findRepeatedWords(
  words: string[],
  minRepeats = 3,
): string[] {
  const counts = new Map<string, number>();
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "is",
    "are",
    "was",
    "were",
    "i",
    "we",
    "you",
    "it",
    "that",
    "this",
    "with",
    "as",
    "at",
    "be",
    "my",
    "our",
  ]);

  for (const word of words) {
    if (stop.has(word) || word.length < 3) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minRepeats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => `${word} (${count}x)`);
}

export function categorizePace(wpm: number): PaceCategory {
  if (wpm < 120) return "slow";
  if (wpm > 160) return "fast";
  return "balanced";
}

/**
 * Objective metrics are always recomputed from transcript + duration.
 * Never trust model-reported WPM / filler counts.
 */
export function computeObjectiveMetrics(
  transcript: string,
  durationSeconds: number,
  fillerList: readonly string[] = DEFAULT_FILLER_WORDS,
): ObjectiveMetrics {
  const words = tokenizeWords(transcript);
  const wordCount = words.length;
  const safeDuration = Math.max(durationSeconds, 1);
  const wordsPerMinute = Math.round((wordCount / safeDuration) * 60);
  const { count: fillerWordCount, matches: fillerMatches } = countFillerWords(
    transcript,
    fillerList,
  );
  const fillerWordsPerMinute =
    Math.round((fillerWordCount / safeDuration) * 60 * 10) / 10;

  return {
    durationSeconds: Math.round(safeDuration),
    wordCount,
    wordsPerMinute,
    fillerWordCount,
    fillerWordsPerMinute,
    fillerMatches,
    paceCategory: categorizePace(wordsPerMinute),
    repeatedWords: findRepeatedWords(words),
  };
}

/**
 * If code-derived filler pressure conflicts with a high fillerControl score,
 * return a note so the UI can surface code metrics as ground truth.
 */
export function reconcileFillerScore(
  fillerControl: number,
  fillerWordsPerMinute: number,
): string | null {
  if (fillerWordsPerMinute >= 8 && fillerControl >= 4) {
    return "Code measured a high filler rate; treat the filler-control score as optimistic.";
  }
  if (fillerWordsPerMinute <= 1 && fillerControl <= 2) {
    return "Code measured a low filler rate; the filler-control score may be too harsh.";
  }
  return null;
}
