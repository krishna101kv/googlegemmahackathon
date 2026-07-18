"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionRecord } from "@/lib/types";
import { SPEECH_TYPE_LABELS } from "@/lib/types";

export function HistoryList({ sessions }: { sessions: SessionRecord[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (!confirm("Delete this session and its recording?")) return;
    setBusyId(id);
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      router.refresh();
    } else {
      alert("Delete failed.");
    }
  }

  if (sessions.length === 0) {
    return (
      <section className="empty-state">
        <h1>History</h1>
        <p>No saved sessions yet.</p>
        <Link href="/" className="btn primary">
          Start practicing
        </Link>
      </section>
    );
  }

  return (
    <section className="history">
      <header>
        <p className="eyebrow">Past sessions</p>
        <h1>History</h1>
      </header>
      <ul className="history-list">
        {sessions.map((session) => (
          <li key={session.id} className="history-item">
            <div>
              <Link href={`/sessions/${session.id}`} className="history-title">
                {SPEECH_TYPE_LABELS[session.speechType]} · score{" "}
                {session.overallScore}
              </Link>
              <p className="meta-line">
                {new Date(session.createdAt).toLocaleString()} ·{" "}
                {session.fillerWordCount} fillers · {session.wordsPerMinute} WPM
              </p>
              <p className="subtle">
                Top note: {session.improvementAreas[0]?.area ?? session.nextFocusArea}
              </p>
            </div>
            <div className="history-actions">
              <Link href={`/sessions/${session.id}`} className="btn ghost">
                Open
              </Link>
              <button
                type="button"
                className="btn danger ghost"
                disabled={busyId === session.id}
                onClick={() => onDelete(session.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
