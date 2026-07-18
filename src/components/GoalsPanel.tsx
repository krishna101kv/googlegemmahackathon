"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Goal = {
  id: string;
  title: string;
  status: "active" | "completed" | "suggested";
  createdAt: string;
  completedAt: string | null;
};

export function GoalsPanel({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setTitle("");
    setBusy(false);
    router.refresh();
  }

  async function setStatus(id: string, status: Goal["status"]) {
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }

  const active = goals.filter((g) => g.status === "active");
  const suggested = goals.filter((g) => g.status === "suggested");
  const completed = goals.filter((g) => g.status === "completed");

  return (
    <section className="goals">
      <header>
        <p className="eyebrow">Improvement plan</p>
        <h1>Goals</h1>
        <p className="lede">
          Turn coaching feedback into a focused practice plan.
        </p>
      </header>

      <form className="goal-form" onSubmit={addGoal}>
        <label className="field">
          <span className="field-label">New focus goal</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pause instead of saying um"
            disabled={busy}
          />
        </label>
        <button type="submit" className="btn primary" disabled={busy}>
          Add goal
        </button>
      </form>

      <GoalGroup
        title="Current focus"
        empty="No active goals yet."
        goals={active}
        onComplete={(id) => setStatus(id, "completed")}
        onActivate={(id) => setStatus(id, "active")}
      />
      <GoalGroup
        title="Suggested from sessions"
        empty="Suggestions appear after a coached session."
        goals={suggested}
        onComplete={(id) => setStatus(id, "completed")}
        onActivate={(id) => setStatus(id, "active")}
      />
      <GoalGroup
        title="Completed"
        empty="Completed goals will show here."
        goals={completed}
        onComplete={(id) => setStatus(id, "completed")}
        onActivate={(id) => setStatus(id, "active")}
      />
    </section>
  );
}

function GoalGroup({
  title,
  empty,
  goals,
  onComplete,
  onActivate,
}: {
  title: string;
  empty: string;
  goals: Goal[];
  onComplete: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  return (
    <div className="block">
      <h2>{title}</h2>
      {goals.length === 0 ? (
        <p className="subtle">{empty}</p>
      ) : (
        <ul className="goal-list">
          {goals.map((goal) => (
            <li key={goal.id}>
              <span>{goal.title}</span>
              <div className="history-actions">
                {goal.status !== "active" && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => onActivate(goal.id)}
                  >
                    Activate
                  </button>
                )}
                {goal.status !== "completed" && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => onComplete(goal.id)}
                  >
                    Complete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
