import { HistoryList } from "@/components/HistoryList";
import { listSessions } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const sessions = listSessions();
  return <HistoryList sessions={sessions} />;
}
