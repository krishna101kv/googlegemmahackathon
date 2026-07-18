import fs from "fs";
import { NextResponse } from "next/server";
import { getAudioAbsolutePath, getSession } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = getSession(id);
  if (!session?.audioPath) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  const fullPath = getAudioAbsolutePath(session.audioPath);
  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "Audio file missing" }, { status: 404 });
  }

  const buffer = fs.readFileSync(fullPath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
