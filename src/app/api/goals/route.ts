import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, listGoals } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ goals: listGoals() });
}

const createSchema = z.object({
  title: z.string().min(2).max(120),
});

export async function POST(request: Request) {
  const body = createSchema.parse(await request.json());
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO goals (id, user_id, title, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, NULL)",
    )
    .run(id, "default", body.title, "active", createdAt);
  return NextResponse.json({ goals: listGoals() });
}

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["active", "completed", "suggested"]),
});

export async function PATCH(request: Request) {
  const body = patchSchema.parse(await request.json());
  const completedAt =
    body.status === "completed" ? new Date().toISOString() : null;
  getDb()
    .prepare(
      "UPDATE goals SET status = ?, completed_at = ? WHERE id = ? AND user_id = ?",
    )
    .run(body.status, completedAt, body.id, "default");
  return NextResponse.json({ goals: listGoals() });
}
