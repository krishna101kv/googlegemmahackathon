import { notFound } from "next/navigation";
import { SessionReviewView } from "@/components/SessionReviewView";
import { getSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();
  return <SessionReviewView session={session} />;
}
