import { NextResponse } from "next/server";
import { z } from "zod";
import { getFillerWordList, setFillerWordList } from "@/lib/fillers";
import { DEFAULT_FILLER_WORDS } from "@/lib/metrics";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    fillers: getFillerWordList(),
    defaults: [...DEFAULT_FILLER_WORDS],
  });
}

const bodySchema = z.object({
  fillers: z.array(z.string().min(1)).min(1).max(40),
});

export async function PUT(request: Request) {
  const body = bodySchema.parse(await request.json());
  const fillers = setFillerWordList(body.fillers);
  return NextResponse.json({ fillers });
}
