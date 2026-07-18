import { NextResponse } from "next/server";
import { getModelConfig } from "@/lib/gemma";
import { listSessions } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const config = getModelConfig();
  let ollamaOk = false;
  let ollamaError: string | null = null;

  try {
    const res = await fetch(`${config.local.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    ollamaOk = res.ok;
    if (!res.ok) ollamaError = `HTTP ${res.status}`;
  } catch (error) {
    ollamaError = error instanceof Error ? error.message : "unreachable";
  }

  return NextResponse.json({
    ok: true,
    sessions: listSessions().length,
    inference: config,
    ollama: { ok: ollamaOk, error: ollamaError },
  });
}
