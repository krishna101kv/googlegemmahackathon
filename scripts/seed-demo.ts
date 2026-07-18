/**
 * Pre-load sample historical sessions so Progress/History demos look real
 * even before multiple live recordings exist.
 *
 * Usage: npx tsx scripts/seed-demo.ts
 */
import { createSession, getDb, listSessions } from "../src/lib/db";

getDb();

if (listSessions().length >= 4) {
  console.log("Seed skipped — sessions already present.");
  process.exit(0);
}

const samples = [
  {
    daysAgo: 12,
    speechType: "prepared" as const,
    goal: "strengthen_opening" as const,
    transcript:
      "Good evening fellow toastmasters. Today I want to talk about the quiet courage of starting over. When I moved cities last year, I um lost my routine, my community, and basically my confidence. But the first club meeting reminded me that growth starts with one shaky sentence.",
    overallScore: 68,
    scores: {
      clarity: 3,
      pace: 3,
      fillerControl: 2,
      structure: 4,
      confidence: 3,
      vocalVariety: 3,
    },
    strengths: ["Clear theme", "Relatable personal story"],
    improvementAreas: [
      {
        area: "Filler words",
        evidence: "Several um/basically moments in the middle.",
        suggestion: "Replace fillers with a one-second pause.",
      },
    ],
    drills: ["60-second opener with zero fillers"],
    nextFocusArea: "Filler word control",
    durationSeconds: 95,
  },
  {
    daysAgo: 8,
    speechType: "table_topics" as const,
    goal: "improve_pacing" as const,
    transcript:
      "If I could invent one gadget it would be a meeting timer that gently taps your wrist when you start rushing. I tend to speed up when I get excited, so like I need a physical cue to breathe and land the point.",
    overallScore: 72,
    scores: {
      clarity: 4,
      pace: 2,
      fillerControl: 3,
      structure: 3,
      confidence: 3,
      vocalVariety: 3,
    },
    strengths: ["Clever premise", "Honest self-awareness"],
    improvementAreas: [
      {
        area: "Pacing",
        evidence: "Delivery accelerates near the punchline.",
        suggestion: "Pause before the final sentence.",
      },
    ],
    drills: ["Read a paragraph aloud at 140 WPM"],
    nextFocusArea: "Speaking pace",
    durationSeconds: 70,
  },
  {
    daysAgo: 4,
    speechType: "interview_pitch" as const,
    goal: "vocal_variety" as const,
    transcript:
      "I lead cross-functional projects by clarifying the outcome first, then negotiating tradeoffs early. In my last role I reduced handoff delays by mapping owners for every dependency. I am looking for a team that values clear communication under pressure.",
    overallScore: 81,
    scores: {
      clarity: 4,
      pace: 4,
      fillerControl: 4,
      structure: 5,
      confidence: 4,
      vocalVariety: 3,
    },
    strengths: ["Tight structure", "Concrete result mentioned"],
    improvementAreas: [
      {
        area: "Vocal variety",
        evidence: "Tone stayed even across the three beats.",
        suggestion: "Lift energy on the result sentence.",
      },
    ],
    drills: ["Pitch the same story in three emotional colors"],
    nextFocusArea: "Vocal variety",
    durationSeconds: 55,
  },
  {
    daysAgo: 1,
    speechType: "evaluation" as const,
    goal: "reduce_fillers" as const,
    transcript:
      "Thank you for that speech. Your opening image was vivid and I stayed with you. One opportunity is to land the conclusion with a clearer call back to the opening. Overall you connected with the room and made the lesson practical.",
    overallScore: 86,
    scores: {
      clarity: 5,
      pace: 4,
      fillerControl: 5,
      structure: 4,
      confidence: 4,
      vocalVariety: 4,
    },
    strengths: ["Balanced praise and critique", "Specific recommendation"],
    improvementAreas: [
      {
        area: "Closing strength",
        evidence: "The final sentence could echo the opening image more tightly.",
        suggestion: "Write the last line before you evaluate.",
      },
    ],
    drills: ["Evaluate a 2-minute clip using sandwich structure"],
    nextFocusArea: "Closing strength",
    durationSeconds: 80,
  },
];

for (const sample of samples) {
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - sample.daysAgo);

  const words = sample.transcript.split(/\s+/).filter(Boolean);
  const durationSeconds = sample.durationSeconds;
  const wordCount = words.length;
  const wordsPerMinute = Math.round((wordCount / durationSeconds) * 60);

  // Lightweight filler estimate for seed consistency with metrics module intent
  const fillerWordCount = (
    sample.transcript.toLowerCase().match(/\b(um|uh|like|basically)\b/g) ?? []
  ).length;

  createSession({
    speechType: sample.speechType,
    goal: sample.goal,
    audioPath: null,
    transcript: sample.transcript,
    inferenceMode: "local",
    durationSeconds,
    wordCount,
    wordsPerMinute,
    fillerWordCount,
    fillerWordsPerMinute:
      Math.round((fillerWordCount / durationSeconds) * 60 * 10) / 10,
    paceCategory:
      wordsPerMinute < 120
        ? "slow"
        : wordsPerMinute > 160
          ? "fast"
          : "balanced",
    overallScore: sample.overallScore,
    scores: sample.scores,
    strengths: sample.strengths,
    improvementAreas: sample.improvementAreas,
    drills: sample.drills,
    nextFocusArea: sample.nextFocusArea,
    transcriptionConfidence: "high",
    createdAt: createdAt.toISOString(),
  });
}

console.log(`Seeded ${samples.length} demo sessions.`);
