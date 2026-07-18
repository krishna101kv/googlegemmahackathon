import { NextResponse } from "next/server";
import { listSessions } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = listSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
