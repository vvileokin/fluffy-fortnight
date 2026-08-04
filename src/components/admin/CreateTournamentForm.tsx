"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";

export type NewTournament = { slug: string; name: string; shortName: string };

/**
 * Add a competition the site doesn't have. PandaScore brings matches from
 * tournaments we've never listed, and a match has to belong to one — so it's
 * created here instead of being filed under something unrelated. The name and
 * dates come prefilled from the match being approved.
 */
export function CreateTournamentForm({
  defaultName,
  defaultStart,
  onCreated,
  onCancel,
}: {
  defaultName: string;
  defaultStart: string | null;
  onCreated: (t: NewTournament) => void;
  onCancel: () => void;
}) {
  const day = defaultStart ? defaultStart.slice(0, 10) : "";
  const [name, setName] = React.useState(defaultName);
  const [tier, setTier] = React.useState("2");
  const [location, setLocation] = React.useState("Онлайн");
  const [prize, setPrize] = React.useState("");
  const [start, setStart] = React.useState(day);
  const [end, setEnd] = React.useState(day);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Вкажи назву турніру.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/pandascore/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        tier: Number(tier),
        location: location.trim(),
        online: !/lan/i.test(location),
        prize_usd: Number(prize) || 0,
        start_at: start || null,
        end_at: end || start || null,
        status: "live",
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) {
      setError(j?.error || "Не вдалося створити турнір.");
      return;
    }
    onCreated(j.tournament as NewTournament);
  }

  const field =
    "h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none";

  return (
    <div className="space-y-2.5 rounded-lg border border-info/40 bg-info/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Новий турнір</p>
        <button
          type="button"
          onClick={onCancel}
          className="grid size-6 place-items-center rounded text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Скасувати"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Назва турніру"
        className={`w-full ${field}`}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <select value={tier} onChange={(e) => setTier(e.target.value)} className={field}>
          <option value="2">Tier 2</option>
          <option value="1">Tier 1</option>
        </select>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Локація"
          className={field}
        />
        <input
          value={prize}
          onChange={(e) => setPrize(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Призовий, $ (не обов’язково)"
          className={field}
        />
        <div className="flex items-center gap-1.5">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`w-full ${field}`} />
          <span className="shrink-0 text-xs text-ink-subtle">–</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={`w-full ${field}`} />
        </div>
      </div>

      {error && <p className="text-xs font-medium text-danger">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        Створити турнір
      </button>
    </div>
  );
}
