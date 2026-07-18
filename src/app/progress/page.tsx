import { ProgressDashboard } from "@/components/ProgressDashboard";
import { listSessions } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ProgressPage() {
  const sessions = listSessions();
  return <ProgressDashboard sessions={sessions} />;
}
