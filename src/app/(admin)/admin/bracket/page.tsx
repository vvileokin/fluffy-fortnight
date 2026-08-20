"use client";

import * as React from "react";
import { Check, Loader2, Lock, Trophy, Unlock } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTeam } from "@/lib/data";
import { EWC_PLAYOFF_TEAMS } from "@/lib/ewc-bracket";
import { BRACKET_SCORING, BRACKET_ROUND_SIZES } from "@/lib/bracket-scoring";
import { underdogTier } from "@/lib/favourite-team";
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
    forceOpen: boolean;
    favourites: Record<string, number>;
  } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [locking, setLocking] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/admin/bracket/score", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (j.ok)
      setStats({
        total: j.total,
        scored: j.scored,
        closed: j.closed,
        forceOpen: j.forceOpen,
        favourites: j.favourites ?? {},
      });
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

  /**
   * Pay one round.
   *
   * Whatever is decided so far, whenever it is decided.
   *
   * The eight quarter-finalists are settled across four separate evenings, so
   * requiring all eight before paying anything put the first two nights on
   * hold. The ledger is per team: tick the ones that just went through, press,
   * come back tomorrow for the next. Teams already paid are skipped, so
   * pressing again — with the same list or a longer one — never pays twice.
   */
  async function scoreRound(key: string) {
    const teams = sel[key] ?? [];
    if (teams.length === 0) return;
    if (
      !confirm(
        `Нарахувати за позначені команди (${teams.length})? Ті, за які вже нараховано, пропускаються — решту можна дотикати пізніше.`,
      )
    )
      return;
    setBusy(key);
    const res = await fetch("/api/admin/bracket/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "ewc-2026", round: key, teams }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (j.ok) {
      alert(`Розраховано. Сіток оброблено: ${j.scored}.`);
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
              {/* Reversible in both directions. The first live fixture closes
                  the bracket automatically, which is the right default and was
                  the wrong absolute: a match set live by mistake used to shut
                  picks for the rest of the event with this button silently
                  doing nothing. Opening now overrides that. */}
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
              {/* Say so when the switch is the only reason picks are still
                  being taken — otherwise "open" during a live playoff looks
                  like the automatic close simply failed. */}
              {stats && !stats.closed && stats.forceOpen && (
                <span className="text-xs text-ink-subtle">
                  відкрито вручну, попри початок плей-офу
                </span>
              )}
            </div>
          </div>
        </Panel>

        {/* Who backed whom. Sorted by weight of money rather than by seed: the
            question an admin actually has is "where is the exposure", and the
            underdog band means a handful of picks on a ×2 can outweigh a crowd
            on a favourite. */}
        {stats && Object.keys(stats.favourites).length > 0 && (
          <Panel>
            <div className="flex items-center justify-between gap-3 shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] px-4 py-3">
              <p className="text-sm font-bold text-ink">Улюблені команди</p>
              <p className="text-xs text-ink-subtle">
                обрали{" "}
                <span className="tnum font-bold">
                  {Object.values(stats.favourites).reduce((a, b) => a + b, 0)}
                </span>{" "}
                гравців
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 p-4">
              {Object.entries(stats.favourites)
                .sort((a, b) => b[1] - a[1])
                .map(([slug, n]) => {
                  const t = getTeam(slug);
                  const band = underdogTier(slug);
                  return (
                    <span
                      key={slug}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold text-ink"
                    >
                      <TeamLogo team={t} size="xs" />
                      {t.tag}
                      <span className="tnum text-ink-muted">{n}</span>
                      {band && band.multiplier > 1 && (
                        <span className="tnum rounded bg-accent/15 px-1 py-px font-mono text-[0.625rem] font-bold text-accent">
                          ×{band.multiplier}
                        </span>
                      )}
                    </span>
                  );
                })}
            </div>
          </Panel>
        )}

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
                <div className="flex items-center gap-3">
                  <p className="text-xs text-ink-subtle">
                    <span className="tnum font-bold">
                      {chosen.length}/{r.size}
                    </span>{" "}
                    · по +{r.per} за команду
                  </p>
                  {/* Each round pays on its own, the moment it is decided. */}
                  <button
                    onClick={() => scoreRound(r.key)}
                    disabled={chosen.length === 0 || busy !== null}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-45"
                  >
                    {busy === r.key ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trophy className="size-3.5" />
                    )}
                    Нарахувати
                  </button>
                </div>
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
