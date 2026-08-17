"use client";

import * as React from "react";
import { Check, Loader2, Lock, Trophy, Unlock } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTeam } from "@/lib/data";
import { EWC_PLAYOFF_TEAMS } from "@/lib/ewc-bracket";
import { BRACKET_SCORING, BRACKET_ROUND_SIZES } from "@/lib/bracket-scoring";
import { cn } from "@/lib/utils";

/**
 * Who actually reached each round, entered by hand.
 *
 * The rounds are entered rather than read off finished fixtures because payout
 * is one-shot and irreversible: inferring "reached the semis" from stage labels
 * would put a wrong payout one typo away, with no round after it to correct in.
 * An admin ticking sixteen names is slower and right.
 */
const ROUNDS = [
  { key: "qf" as const, size: BRACKET_ROUND_SIZES.qf, label: "Дійшли до 1/4", per: BRACKET_SCORING.qf },
  { key: "sf" as const, size: BRACKET_ROUND_SIZES.sf, label: "Дійшли до 1/2", per: BRACKET_SCORING.sf },
  { key: "final" as const, size: BRACKET_ROUND_SIZES.final, label: "Дійшли до фіналу", per: BRACKET_SCORING.final },
  { key: "champion" as const, size: 1, label: "Чемпіон", per: BRACKET_SCORING.champion },
];

export default function BracketAdmin() {
  const [sel, setSel] = React.useState<Record<string, string[]>>({});
  const [stats, setStats] = React.useState<{
    total: number;
    scored: number;
    closed: boolean;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [locking, setLocking] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/admin/bracket/score", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (j.ok) setStats({ total: j.total, scored: j.scored, closed: j.closed });
  }, []);

  async function toggleLock() {
    if (!stats) return;
    setLocking(true);
    const res = await fetch("/api/admin/bracket/score", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ closed: !stats.closed }),
    });
    const j = await res.json().catch(() => ({}));
    setLocking(false);
    if (j.ok) await load();
    else alert(j.error || "Не вдалося змінити статус");
  }

  React.useEffect(() => {
    void load();
  }, [load]);

  function toggle(key: string, size: number, slug: string) {
    setSel((prev) => {
      const at = prev[key] ?? [];
      if (at.includes(slug)) return { ...prev, [key]: at.filter((s) => s !== slug) };
      if (at.length >= size) return prev;
      return { ...prev, [key]: [...at, slug] };
    });
  }

  const complete = ROUNDS.every((r) => (sel[r.key] ?? []).length === r.size);

  async function score() {
    if (
      !confirm(
        "Нарахувати EWC поінти за сітки? Уже нараховані сітки пропускаються, тож повторний запуск не платить двічі.",
      )
    )
      return;
    setBusy(true);
    const res = await fetch("/api/admin/bracket/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "ewc-2026",
        actual: {
          qf: sel.qf,
          sf: sel.sf,
          final: sel.final,
          champion: (sel.champion ?? [])[0],
        },
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) {
      alert(`Розраховано. Сіток нараховано: ${j.scored}.`);
      await load();
    } else {
      alert(j.error || "Помилка розрахунку");
    }
  }

  return (
    <>
      <AdminHead
        title="Сітка плей-офу EWC"
        subtitle="Познач команди, які реально дійшли до кожного раунду, і нарахуй поінти. Бали йдуть за кожну вгадану команду в раунді, незалежно від того, яким шляхом вона туди потрапила."
      />

      <div className="space-y-4">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-ink-muted">
              Заповнених сіток:{" "}
              <span className="tnum font-bold text-ink">{stats?.total ?? "—"}</span>
              {" · "}уже нараховано:{" "}
              <span className="tnum font-bold text-ink">{stats?.scored ?? "—"}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Closing is reversible on purpose — an admin who shuts it a day
                  early, or by mistake, can open it again while the playoff
                  hasn't started. The first live fixture still closes it for
                  good regardless of this switch. */}
              <button
                onClick={toggleLock}
                disabled={locking || !stats}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-50",
                  stats?.closed
                    ? "border border-success/50 bg-success/10 text-success hover:bg-success/20"
                    : "border border-border-strong text-ink hover:bg-surface-2",
                )}
              >
                {locking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : stats?.closed ? (
                  <Unlock className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
                {stats?.closed ? "Відкрити прогнози" : "Закрити прогнози"}
              </button>
              <button
                onClick={score}
                disabled={!complete || busy}
                className="inline-flex h-9 min-w-32 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
                Нарахувати
              </button>
            </div>
          </div>
        </Panel>

        {ROUNDS.map((r) => {
          // Each round is chosen out of the one before it, so a name can't
          // reach the final without having been marked into the semis first.
          const pool =
            r.key === "qf"
              ? EWC_PLAYOFF_TEAMS
              : (sel[ROUNDS[ROUNDS.findIndex((x) => x.key === r.key) - 1].key] ?? []);
          const chosen = sel[r.key] ?? [];
          return (
            <Panel key={r.key}>
              <div className="flex items-center justify-between gap-3 shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] px-4 py-3">
                <p className="text-sm font-bold text-ink">{r.label}</p>
                <p className="text-xs text-ink-subtle">
                  <span className="tnum font-bold">
                    {chosen.length}/{r.size}
                  </span>{" "}
                  · по +{r.per} за команду
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 p-4">
                {pool.length === 0 ? (
                  <p className="text-xs text-ink-subtle">Спочатку заповни попередній раунд.</p>
                ) : (
                  pool.map((slug) => {
                    const t = getTeam(slug);
                    const on = chosen.includes(slug);
                    return (
                      <button
                        key={slug}
                        onClick={() => toggle(r.key, r.size, slug)}
                        aria-pressed={on}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                          on
                            ? "border-accent/50 bg-accent/10 text-ink"
                            : "border-border bg-surface text-ink-muted hover:bg-surface-2",
                        )}
                      >
                        <TeamLogo team={t} size="xs" />
                        {t.tag}
                        {on && <Check className="size-3 text-accent" strokeWidth={3} />}
                      </button>
                    );
                  })
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
