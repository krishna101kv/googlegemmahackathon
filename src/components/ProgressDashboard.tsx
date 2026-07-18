"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SessionRecord } from "@/lib/types";

function chartRows(sessions: SessionRecord[]) {
  return [...sessions]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((s, index) => ({
      index: index + 1,
      label: new Date(s.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      score: s.overallScore,
      fillers: s.fillerWordCount,
      wpm: s.wordsPerMinute,
    }));
}

export function ProgressDashboard({ sessions }: { sessions: SessionRecord[] }) {
  const rows = chartRows(sessions);
  const recurring = topImprovementAreas(sessions);
  const recentWins = sessions
    .flatMap((s) => s.strengths.map((strength) => ({ strength, at: s.createdAt })))
    .slice(0, 5);
  const focus = sessions[0]?.nextFocusArea ?? "Record a session to set a focus";

  if (sessions.length === 0) {
    return (
      <section className="empty-state">
        <h1>Progress</h1>
        <p>No sessions yet. Complete a practice round to see trends.</p>
      </section>
    );
  }

  return (
    <section className="progress">
      <header>
        <p className="eyebrow">Across sessions</p>
        <h1>Progress</h1>
        <p className="lede">Trends from code metrics and Gemma coaching scores.</p>
      </header>

      <div className="focus-banner">
        Current focus: <strong>{focus}</strong>
      </div>

      <div className="chart-grid">
        <ChartCard title="Overall score">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows}>
              <CartesianGrid stroke="rgba(20,36,40,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#0f6b5c"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Filler words">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows}>
              <CartesianGrid stroke="rgba(20,36,40,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="fillers"
                stroke="#b45309"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Speaking pace (WPM)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows}>
              <CartesianGrid stroke="rgba(20,36,40,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="wpm"
                stroke="#1d4e89"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="two-col">
        <div className="block">
          <h2>Top recurring improvement areas</h2>
          <ul>
            {recurring.map((item) => (
              <li key={item.area}>
                {item.area} <span className="pill">{item.count}x</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="block">
          <h2>Recent wins</h2>
          <ul>
            {recentWins.map((win) => (
              <li key={`${win.strength}-${win.at}`}>{win.strength}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="block chart-card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function topImprovementAreas(sessions: SessionRecord[]) {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const area of session.improvementAreas) {
      counts.set(area.area, (counts.get(area.area) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
