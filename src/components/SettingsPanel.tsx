"use client";

import { useEffect, useState } from "react";

export function SettingsPanel() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/fillers")
      .then((res) => res.json())
      .then((data) => {
        setText((data.fillers as string[]).join("\n"));
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load filler settings.");
        setLoading(false);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);
    const fillers = text
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter(Boolean);

    const res = await fetch("/api/settings/fillers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fillers }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setText((data.fillers as string[]).join("\n"));
    setStatus("Filler word list saved.");
  }

  async function resetDefaults() {
    const res = await fetch("/api/settings/fillers");
    const data = await res.json();
    setText((data.defaults as string[]).join("\n"));
    setStatus("Defaults loaded — click Save to persist.");
  }

  if (loading) return <p className="subtle">Loading settings…</p>;

  return (
    <section className="goals">
      <header>
        <p className="eyebrow">Configuration</p>
        <h1>Settings</h1>
        <p className="lede">
          Customize filler phrases used for code-side metrics. Gemma still
          evaluates qualitatively; counts always come from this list.
        </p>
      </header>

      <form className="block" onSubmit={save}>
        <label className="field">
          <span className="field-label">Filler words / phrases (one per line)</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            style={{
              width: "100%",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "0.75rem 0.9rem",
              font: "inherit",
              resize: "vertical",
            }}
          />
        </label>
        <div className="recorder-actions" style={{ marginTop: "1rem" }}>
          <button type="submit" className="btn primary">
            Save
          </button>
          <button type="button" className="btn ghost" onClick={resetDefaults}>
            Load defaults
          </button>
        </div>
        {status && <p className="status-text">{status}</p>}
        {error && <p className="error-text">{error}</p>}
      </form>
    </section>
  );
}
