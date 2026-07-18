import { getDb } from "./db";
import { DEFAULT_FILLER_WORDS } from "./metrics";

const SETTINGS_KEY = "filler_words";

export function getFillerWordList(): string[] {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(SETTINGS_KEY) as { value: string } | undefined;

  if (!row?.value) return [...DEFAULT_FILLER_WORDS];

  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed.map((item) => item.trim().toLowerCase()).filter(Boolean);
    }
  } catch {
    // fall through
  }
  return [...DEFAULT_FILLER_WORDS];
}

export function setFillerWordList(words: string[]): string[] {
  const cleaned = [
    ...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean)),
  ];
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(SETTINGS_KEY, JSON.stringify(cleaned));
  return cleaned;
}
