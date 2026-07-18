/**
 * Full functionality verification for Stagecraft MVP.
 * Usage: npx tsx scripts/verify-all.ts
 */
import fs from "fs";
import path from "path";
import {
  computeObjectiveMetrics,
  countFillerWords,
  categorizePace,
  reconcileFillerScore,
} from "../src/lib/metrics";
import { coachEvaluationSchema } from "../src/lib/schema";
import {
  createSession,
  deleteSession,
  getDb,
  getSession,
  listGoals,
  listSessions,
  upsertSuggestedGoal,
} from "../src/lib/db";
import { getFillerWordList, setFillerWordList } from "../src/lib/fillers";

const BASE = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
let passed = 0;
let failed = 0;

function ok(name: string) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}

function fail(name: string, reason: string) {
  failed += 1;
  console.error(`  FAIL  ${name}: ${reason}`);
}

function assert(name: string, condition: boolean, reason = "assertion failed") {
  if (condition) ok(name);
  else fail(name, reason);
}

async function section(title: string, fn: () => Promise<void> | void) {
  console.log(`\n== ${title} ==`);
  await fn();
}

function makeSilentWav(seconds = 1, sampleRate = 16000): Buffer {
  const numSamples = sampleRate * seconds;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function main() {
  console.log("Stagecraft verification");
  console.log(`API base: ${BASE}`);

  await section("Unit: objective metrics", () => {
    const transcript =
      "So um I basically think that you know we can kind of improve. Practice practice practice helps.";
    const fillers = countFillerWords(transcript);
    assert("detects fillers", fillers.count >= 4, `count=${fillers.count}`);
    const metrics = computeObjectiveMetrics(transcript, 60);
    assert("wordCount > 0", metrics.wordCount > 0);
    assert("wpm computed", metrics.wordsPerMinute === metrics.wordCount);
    assert("pace category", categorizePace(140) === "balanced");
    assert(
      "reconcile conflict",
      reconcileFillerScore(5, 12) !== null,
      "expected conflict note",
    );
  });

  await section("Unit: schema validation", () => {
    const good = {
      transcript: "Hello toastmasters.",
      overallScore: 80,
      scores: {
        clarity: 4,
        pace: 3,
        fillerControl: 3,
        structure: 4,
        confidence: 4,
        vocalVariety: 3,
      },
      strengths: ["Clear opening"],
      improvementAreas: [
        {
          area: "Pace",
          evidence: "Rushed middle",
          suggestion: "Pause between points",
        },
      ],
      drills: ["60-second pause drill"],
      nextFocusArea: "Pace",
      transcriptionConfidence: "high",
    };
    assert("accepts valid evaluation", coachEvaluationSchema.safeParse(good).success);
    assert(
      "rejects missing transcript",
      !coachEvaluationSchema.safeParse({ ...good, transcript: "" }).success,
    );
  });

  await section("Unit/DB: sessions, goals, fillers", () => {
    getDb();
    const before = listSessions().length;
    const session = createSession({
      speechType: "prepared",
      goal: "reduce_fillers",
      audioPath: null,
      transcript: "Um hello there basically.",
      inferenceMode: "local",
      durationSeconds: 30,
      wordCount: 4,
      wordsPerMinute: 8,
      fillerWordCount: 2,
      fillerWordsPerMinute: 4,
      paceCategory: "slow",
      overallScore: 70,
      scores: {
        clarity: 3,
        pace: 3,
        fillerControl: 2,
        structure: 3,
        confidence: 3,
        vocalVariety: 3,
      },
      strengths: ["Friendly tone"],
      improvementAreas: [
        {
          area: "Fillers",
          evidence: "um/basically",
          suggestion: "Pause instead",
        },
      ],
      drills: ["Silent pause drill"],
      nextFocusArea: "Filler word control",
      transcriptionConfidence: "high",
    });
    assert("create session", Boolean(getSession(session.id)));
    assert("list sessions grows", listSessions().length === before + 1);

    upsertSuggestedGoal("Filler word control");
    assert(
      "suggested goal exists",
      listGoals().some((g) => g.title === "Filler word control"),
    );

    const custom = setFillerWordList(["um", "like", "customphrase"]);
    assert("custom fillers saved", custom.includes("customphrase"));
    assert("custom fillers loaded", getFillerWordList().includes("customphrase"));
    setFillerWordList(["um", "uh", "like", "you know", "so", "actually", "basically", "kind of", "sort of", "i mean"]);

    assert("delete session", deleteSession(session.id));
    assert("session gone", getSession(session.id) === null);
  });

  await section("HTTP: health / history / goals / settings", async () => {
    const health = await fetch(`${BASE}/api/health`);
    assert("GET /api/health", health.ok, `status ${health.status}`);
    if (health.ok) {
      const body = await health.json();
      assert("ollama reachable", body.ollama?.ok === true, String(body.ollama?.error));
    }

    const sessions = await fetch(`${BASE}/api/sessions`);
    assert("GET /api/sessions", sessions.ok);

    const goalsGet = await fetch(`${BASE}/api/goals`);
    assert("GET /api/goals", goalsGet.ok);

    const goalTitle = `Verify goal ${Date.now()}`;
    const goalsPost = await fetch(`${BASE}/api/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: goalTitle }),
    });
    assert("POST /api/goals", goalsPost.ok);
    const created = await goalsPost.json();
    const goalId = (created.goals as Array<{ id: string; title: string }>).find(
      (g) => g.title === goalTitle,
    )?.id;
    if (goalId) {
      const patch = await fetch(`${BASE}/api/goals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goalId, status: "completed" }),
      });
      assert("PATCH /api/goals", patch.ok);
    } else {
      fail("PATCH /api/goals", "created goal not found");
    }

    const fillers = await fetch(`${BASE}/api/settings/fillers`);
    assert("GET /api/settings/fillers", fillers.ok);

    for (const route of ["/", "/progress", "/history", "/goals", "/settings"]) {
      const page = await fetch(`${BASE}${route}`);
      assert(`page ${route}`, page.ok, `status ${page.status}`);
    }
  });

  await section("E2E: Gemma audio analyze pipeline", async () => {
    const demoPath = path.join(process.cwd(), "public", "demo", "sample-speech.wav");
    let wavBuffer: Buffer;
    if (fs.existsSync(demoPath)) {
      wavBuffer = fs.readFileSync(demoPath);
      ok("demo sample present");
    } else {
      fail("demo sample present", "missing public/demo/sample-speech.wav — run npm run prepare-demo");
      // Still test local gemma path with a tone if needed
      wavBuffer = makeSilentWav(2);
    }

    // Prefer real speech sample; if cookbook/TTS unavailable, synthetic tone still exercises API wiring
    const isRiff = wavBuffer.subarray(0, 4).toString("ascii") === "RIFF";
    assert("wav has RIFF header", isRiff);

    console.log("  ... calling /api/analyze via Gemma 4 (may take a few minutes)");
    try {
      const durationSeconds = Math.max(
        3,
        Math.round(wavBuffer.length / 32000),
      );
      const analyze = await fetch(`${BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: wavBuffer.toString("base64"),
          durationSeconds,
          speechType: "prepared",
          goal: "reduce_fillers",
          preferMode: "local",
        }),
      });
      const analyzeBody = await analyze.json();
      assert(
        "POST /api/analyze",
        analyze.ok,
        analyzeBody.error || `status ${analyze.status}`,
      );
      if (analyze.ok) {
        assert(
          "gemma transcript saved",
          Boolean(analyzeBody.session?.transcript),
        );
        assert(
          "code metrics present",
          typeof analyzeBody.session?.wordsPerMinute === "number",
        );
        assert(
          "inference mode local",
          analyzeBody.session?.inferenceMode === "local",
        );
        const id = analyzeBody.session.id as string;
        const review = await fetch(`${BASE}/sessions/${id}`);
        assert("session review page", review.ok);
        const audio = await fetch(`${BASE}/api/audio/${id}`);
        assert("session audio endpoint", audio.ok);
        await fetch(`${BASE}/api/sessions/${id}`, { method: "DELETE" });
        ok("cleanup analyzed session");
      }
    } catch (error) {
      fail(
        "gemma e2e",
        error instanceof Error ? error.message : String(error),
      );
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
