/**
 * Detect failed ASR outputs: word/phrase loops like
 * "The more the more the more…" or "lo lo lo lo".
 */
export function isLoopedOrGibberishTranscript(transcript: string): boolean {
  const cleaned = transcript.trim().replace(/\s+/g, " ");
  if (cleaned.length < 8) return true;

  const lower = cleaned.toLowerCase();
  if (/^(no[_\s-]?speech|unintelligible)\b/i.test(cleaned)) return true;

  const words = lower.split(" ").filter(Boolean);
  if (words.length < 4) return true;

  // Single-token domination: "more more more…"
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const top = Math.max(...counts.values());
  if (top / words.length >= 0.45 && words.length >= 8) return true;

  // Bigram loop: "the more the more…"
  if (words.length >= 8) {
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
    const biCounts = new Map<string, number>();
    for (const b of bigrams) biCounts.set(b, (biCounts.get(b) ?? 0) + 1);
    const topBi = Math.max(...biCounts.values());
    if (topBi / bigrams.length >= 0.35) return true;
  }

  // Character-level stutter: "lllllll" or spaced "l l l l"
  if (/^(.{1,3})(\s+\1){8,}$/i.test(cleaned)) return true;

  return false;
}

export function summarizeTranscriptIssue(transcript: string): string {
  if (!transcript.trim()) return "empty transcript";
  if (isLoopedOrGibberishTranscript(transcript)) {
    return "looped/gibberish transcript";
  }
  return "ok";
}
