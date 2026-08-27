"use client";

import * as React from "react";
import { Check, Loader2, Skull, Trophy } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTeam } from "@/lib/data";
import { PORTO_GROUP_SCORING, PORTO_GROUP_SIZES } from "@/lib/porto-groups";
import { cn } from "@/lib/utils";

type GroupStats = {
  total: number;
  scored: number;
  paid: number;
  teams: string[];
  advance: Record<string, number>;
  zeroTwo: Record<string, number>;
};

const GROUPS = [
  { id: "a", label: "Група A" },
  { id: "b", label: "Група B" },
];

/**
 * Settling the 0-2 club.
 *
 * The result is entered by hand rather than read off the ladder. The three
 * qualifiers could be inferred, but "went out without a single series win"
 * cannot: a team eliminated at 1-2 looks identical from the outside unless
 * every one of its matches is checked. Payout is one-shot, so a wrong
 * inference has no round after it to correct in.
 */
export default function PortoAdmin() {
  const [stats, setStats] = React.useState<Record<string, GroupStats> | null>(null);
  const [sel, setSel] = React.useState<Record<string, { advance: string[]; zeroTwo: string[] }>>({
    a: { advance: [], zeroTwo: [] },
    b: { advance: [], zeroTwo: [] },
  });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [closed, setClosed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/admin/porto-group", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setStats(j.groups);
      setClosed(!!j.closed);
    }
  }, []);

  /**
   * Close the club ahead of the fixtures, or put it back.
   *
   * Separate from settling: closing stops cards being written, settling pays
   * the ones that are in, and an admin normally does the first well before the
   * second. Reversible, because the switch only ever shuts things earlier than
   * the clock would — a group whose match has started stays shut whatever this
   * says, so a mistaken close costs only the minutes until it is undone.
   */
  async function toggleClosed() {
    setBusy("lock");
    const res = await fetch("/api/admin/porto-group", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closed: !closed }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!j.ok) {
      setError(String(j.error ?? "Не вдалося"));
      window.setTimeout(() => setError(null), 4000);
      return;
    }
    setClosed(!!j.closed);
  }

  React.useEffect(() => {
    void load();
  }, [load]);

  /** Same one-tap cycle the players' card uses, so both read the same way. */
  function cycle(g: string, slug: string) {
    setSel((prev) => {
      const cur = prev[g] ?? { advance: [], zeroTwo: [] };
      if (cur.advance.includes(slug)) {
        const advance = cur.advance.filter((s) => s !== slug);
        const zeroTwo =
          cur.zeroTwo.length < PORTO_GROUP_SIZES.zeroTwo ? [...cur.zeroTwo, slug] : cur.zeroTwo;
        return { ...prev, [g]: { advance, zeroTwo } };
      }
      if (cur.zeroTwo.includes(slug)) {
        return { ...prev, [g]: { ...cur, zeroTwo: cur.zeroTwo.filter((s) => s !== slug) } };
      }
      if (cur.advance.length < PORTO_GROUP_SIZES.advance) {
        return { ...prev, [g]: { ...cur, advance: [...cur.advance, slug] } };
      }
      if (cur.zeroTwo.length < PORTO_GROUP_SIZES.zeroTwo) {
        return { ...prev, [g]: { ...cur, zeroTwo: [...cur.zeroTwo, slug] } };
      }
      return prev;
    });
  }

  async function settle(g: string) {
    const cur = sel[g];
    if (!cur) return;
    if (
      !confirm(
        `Розрахувати групу ${g.toUpperCase()}? Виплата одноразова — картки, які вже нараховані, пропускаються.`,
      )
    )
      return;
    setBusy(g);
    const res = await fetch("/api/admin/porto-group", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group: g, advance: cur.advance, zeroTwo: cur.zeroTwo }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (j.ok) {
      alert(`Розраховано карток: ${j.scored}.`);
      await load();
    } else {
      alert(j.error || "Помилка розрахунку");
    }
  }

  return (
    <>
      <AdminHead
        title="Клуб 0-2 · BLAST Porto"
        subtitle={`Познач трьох, хто справді вийшов, і двох, хто вилетів 0-2. ${PORTO_GROUP_SCORING.advance} за вихід, ${PORTO_GROUP_SCORING.zeroTwo} за виліт, ${PORTO_GROUP_SCORING.perfect} за повну групу.`}
      />

      <div className="space-y-4">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">
                {closed ? "Клуб закрито" : "Клуб приймає картки"}
              </p>
              <p className="text-xs text-ink-muted">
                {closed
                  ? "Нові картки не приймаються в жодній групі."
                  : "Кожна група закривається сама на своєму першому матчі. Це — закрити раніше."}
              </p>
            </div>
            <button
              onClick={toggleClosed}
              disabled={busy !== null}
              className={cn(
                "h-9 shrink-0 rounded-lg px-3 text-sm font-bold transition-colors disabled:opacity-50",
                closed
                  ? "border border-border text-ink-muted hover:bg-surface-2"
                  : "bg-danger text-white hover:brightness-110",
              )}
            >
              {busy === "lock" ? "…" : closed ? "Відкрити назад" : "Закрити клуб"}
            </button>
          </div>
          {error && (
            <p role="alert" className="px-4 pb-3 text-xs font-semibold text-danger">
              {error}
            </p>
          )}
        </Panel>

        {GROUPS.map((g) => {
          const s = stats?.[g.id];
          const cur = sel[g.id] ?? { advance: [], zeroTwo: [] };
          const ready =
            cur.advance.length === PORTO_GROUP_SIZES.advance &&
            cur.zeroTwo.length === PORTO_GROUP_SIZES.zeroTwo;
          return (
            <Panel key={g.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-ink">{g.label}</p>
                  <p className="text-xs text-ink-muted">
                    карток:{" "}
                    <span className="tnum font-bold text-ink">{s?.total ?? "—"}</span>
                    {" · "}нараховано:{" "}
                    <span className="tnum font-bold text-ink">{s?.scored ?? "—"}</span>
                    {" · "}видано:{" "}
                    <span className="tnum font-bold text-accent">{s?.paid ?? "—"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-ink-subtle">
                    <span className="tnum font-bold">
                      {cur.advance.length}/{PORTO_GROUP_SIZES.advance}
                    </span>{" "}
                    вихід{" · "}
                    <span className="tnum font-bold">
                      {cur.zeroTwo.length}/{PORTO_GROUP_SIZES.zeroTwo}
                    </span>{" "}
                    виліт
                  </p>
                  <button
                    onClick={() => settle(g.id)}
                    disabled={!ready || busy !== null}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-45"
                  >
                    {busy === g.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trophy className="size-3.5" />
                    )}
                    Нарахувати
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 p-4">
                {(s?.teams ?? []).map((slug) => {
                  const t = getTeam(slug);
                  const isUp = cur.advance.includes(slug);
                  const isOut = cur.zeroTwo.includes(slug);
                  // How the field called this team — the consensus an admin
                  // wants in front of them before deciding, not after.
                  const forUp = s?.advance[slug] ?? 0;
                  const forOut = s?.zeroTwo[slug] ?? 0;
                  return (
                    <button
                      key={slug}
                      onClick={() => cycle(g.id, slug)}
                      aria-pressed={isUp || isOut}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm font-semibold transition-colors",
                        isUp
                          ? "border-success/50 bg-success/10 text-success"
                          : isOut
                            ? "border-danger/50 bg-danger/10 text-danger"
                            : "border-border bg-surface text-ink-muted hover:bg-surface-2",
                      )}
                    >
                      <TeamLogo team={t} size="xs" />
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      <span className="tnum shrink-0 text-[0.6875rem] font-medium text-ink-subtle">
                        {forUp} вихід · {forOut} виліт
                      </span>
                      {isUp && <Trophy className="size-3.5 shrink-0" />}
                      {isOut && <Skull className="size-3.5 shrink-0" />}
                      {!isUp && !isOut && <Check className="size-3.5 shrink-0 opacity-0" />}
                    </button>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
