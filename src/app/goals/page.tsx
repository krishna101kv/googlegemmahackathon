import { GoalsPanel } from "@/components/GoalsPanel";
import { listGoals } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  const goals = listGoals();
  return <GoalsPanel goals={goals} />;
}
