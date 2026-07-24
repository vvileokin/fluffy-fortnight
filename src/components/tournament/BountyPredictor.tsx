"use client";

import * as React from "react";
import { Check, Swords, Info, ChevronRight, Lock, RotateCcw, X, LogIn } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Badge } from "@/components/ui/Badge";
import { bountyStages, getTeam } from "@/lib/data";
import { useUser } from "@/lib/supabase/use-user";
import { useRouter, Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Picks = Record<string, Record<string, string>>; // stageId -> lowSlug -> highSlug
type StageState = {
  teams: string[];
  lowSeeds: string[];
  winners: string[];
  results: Record<string, string>; // lowSlug -> actual highSlug
  seeds: Record<string, number>; // slug -> seed position
  lockedPairs: string[]; // lower seeds whose pair the admin closed on its own
  locked: boolean;
  deadlineISO: string | null;
};

function fmtDeadline(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function BountyPredictor() {
  const user = useUser();
  const router = useRouter();
  const [active, setActive] = React.useState(bountyStages[0].id);
  const [picks, setPicks] = React.useState<Picks>({});
  const [stages, setStages] = React.useState<Record<string, StageState>>({});
  const [saved, setSaved] = React.useState(false);

  const meta = bountyStages.find((s) => s.id === active)!;
  const state = stages[active];
  // Later stages seat teams by the admin's seed numbers (lower seeds 9–16,
  // higher seeds 1–8); round 32 keeps its original order.
  const seeds = state?.seeds ?? {};
  const bySeed = (a: string, b: string) =>
    (seeds[a] ?? Number.POSITIVE_INFINITY) - (seeds[b] ?? Number.POSITIVE_INFINITY);
  const useSeeds = active !== "r1" && Object.keys(seeds).length > 0;
  const rawLows = state?.lowSeeds ?? [];
  const lows = useSeeds ? [...rawLows].sort(bySeed) : rawLows;
  const rawHighs = (state?.teams ?? []).filter((t) => !rawLows.includes(t));
  const highs = useSeeds ? [...rawHighs].sort(bySeed) : rawHighs;
  const deadlinePassed = !!state?.deadlineISO && new Date(state.deadlineISO).getTime() < Date.now();
  const locked = !!state?.locked || deadlinePassed;
  // The admin can also close single pairs while the stage stays open.
  const lockedPairs = state?.lockedPairs ?? [];
  const pairLocked = (low: string) => locked || lockedPairs.includes(low);
  const openLows = lows.filter((l) => !pairLocked(l));
  const configured = (state?.teams.length ?? 0) > 0;
  const stagePicks = picks[active] ?? {};
  const made = Object.keys(stagePicks).length;
  // Completion is judged on the pairs still open — a pair closed before the
  // player picked it is out of their hands.
  const openMade = openLows.filter((l) => stagePicks[l]).length;
  const allOpenPicked = lows.length > 0 && openLows.every((l) => stagePicks[l]);
  // Draft order runs down the left column first, then the right (1-8 | 9-16).
  const lowColumns = [
    lows.slice(0, Math.ceil(lows.length / 2)),
    lows.slice(Math.ceil(lows.length / 2)),
  ].filter((col) => col.length > 0);

  // Load stage config (public) + this user's saved picks.
  React.useEffect(() => {
    let cancelled = false;
    createClient()
      .from("bounty_stages")
      // select * (not an explicit list) so an un-migrated `seeds` column can't
      // error the whole read and blank out the draft.
      .select("*")
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, StageState> = {};
        for (const r of data) {
          next[r.stage_id] = {
            teams: Array.isArray(r.teams) ? r.teams : [],
            lowSeeds: Array.isArray(r.low_seeds) ? r.low_seeds : [],
            winners: Array.isArray(r.winners) ? r.winners : [],
            results: r.results && typeof r.results === "object" && !Array.isArray(r.results) ? r.results : {},
            seeds: r.seeds && typeof r.seeds === "object" && !Array.isArray(r.seeds) ? r.seeds : {},
            lockedPairs: Array.isArray(r.locked_pairs) ? r.locked_pairs : [],
            locked: !!r.locked,
            deadlineISO: r.deadline ?? null,
          };
        }
        setStages(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    createClient()
      .from("bounty_picks")
      .select("stage_id, low_slug, high_slug")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Picks = {};
        for (const r of data) (next[r.stage_id] ??= {})[r.low_slug] = r.high_slug;
        setPicks(next);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function pick(low: string, high: string) {
    if (pairLocked(low)) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setPicks((prev) => ({ ...prev, [active]: { ...(prev[active] ?? {}), [low]: high } }));
    setSaved(false);
    createClient()
      .from("bounty_picks")
      .upsert(
        { user_id: user.id, stage_id: active, low_slug: low, high_slug: high },
        { onConflict: "user_id,stage_id,low_slug" },
      )
      .then(() => {});
  }

  /** Un-pick one pair — frees that opponent for the other pairs. */
  function clearPick(low: string) {
    if (pairLocked(low) || !user) return;
    setPicks((prev) => {
      const stage = { ...(prev[active] ?? {}) };
      delete stage[low];
      return { ...prev, [active]: stage };
    });
    setSaved(false);
    createClient()
      .from("bounty_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("stage_id", active)
      .eq("low_slug", low)
      .then(() => {});
  }

  /** Reset the still-open pairs of this stage — closed ones keep their pick. */
  function resetStage() {
    if (locked || !user) return;
    const clearable = openLows.filter((l) => stagePicks[l]);
    if (clearable.length === 0) return;
    const hasClosed = clearable.length < made;
    if (!confirm(hasClosed ? "Скинути відкриті пари? Закриті залишаться." : "Скинути весь драфт цієї стадії?")) return;
    setPicks((prev) => {
      const stage = { ...(prev[active] ?? {}) };
      for (const l of clearable) delete stage[l];
      return { ...prev, [active]: stage };
    });
    setSaved(false);
    createClient()
      .from("bounty_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("stage_id", active)
      .in("low_slug", clearable)
      .then(() => {});
  }

  return (
    <div className="space-y-5">
      {/* Stage tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden pb-1">
        {bountyStages.map((s) => {
          const on = s.id === active;
          return (
            <button
              key={s.id}
              onClick={() => {
                setActive(s.id);
                setSaved(false);
              }}
              className={cn(
                "shrink-0 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors",
                on ? "border-accent/50 bg-accent/10 text-ink" : "border-border bg-surface text-ink-muted hover:bg-surface-2",
              )}
            >
              {s.title}
            </button>
          );
        })}
      </div>

      {/* Stage header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          {locked ? <Lock className="size-4 shrink-0 text-warning" /> : <Info className="size-4 shrink-0 text-info" />}
          {locked
            ? deadlinePassed
              ? "Прийом прогнозів завершено — дедлайн минув."
              : "Голосування у цій стадії закрито."
            : lows.length > openLows.length
              ? `${meta.note} Закриті пари вже не змінити (${lows.length - openLows.length} з ${lows.length}).`
              : meta.note}
        </p>
        <div className="flex items-center gap-2">
          {state?.deadlineISO && (
            <span className="text-xs text-ink-subtle">до {fmtDeadline(state.deadlineISO)}</span>
          )}
          <Badge tone="accent">до +{meta.reward} за пару</Badge>
        </div>
      </div>

      {!configured && user ? (
        <StagePlaceholder />
      ) : (
        <div className="relative">
          <div
            className={cn(
              "space-y-5",
              // Signed-out visitors see a fixed-height blurred teaser behind the
              // gate. A fixed height (not just a cap) keeps the centred gate card
              // inside the box even when the stage is empty, so it can't spill out.
              !user && "pointer-events-none h-80 select-none overflow-hidden blur-[5px]",
            )}
            aria-hidden={!user}
          >
          {!configured ? (
            <StagePlaceholder />
          ) : (
          <>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {lowColumns.map((col, ci) => (
              <div key={ci} className="space-y-2.5">
                {col.map((low, ri) => {
                  const lowTeam = getTeam(low);
                  const chosen = stagePicks[low];
                  const actual = state.results[low];
                  const correct = !!actual && chosen === actual;
                  const closed = pairLocked(low);
                  const dropUp = col.length > 2 && ri >= col.length - 2;
                  // One team = one pair: hide high seeds already picked for other lows.
                  const takenByOthers = new Set(
                    Object.entries(stagePicks)
                      .filter(([l]) => l !== low)
                      .map(([, h]) => h),
                  );
                  const availableHighs = highs.filter((h) => !takenByOthers.has(h));
                  return (
                    <div key={low} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5">
                      <TeamLogo team={lowTeam} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{lowTeam.name}</p>
                        {actual ? (
                          <p className={cn(
                            "mt-0.5 flex items-center gap-1 text-[0.6875rem] font-semibold",
                            correct ? "text-success" : "text-danger",
                          )}>
                            {correct ? (
                              <Check className="size-3 shrink-0" strokeWidth={3} />
                            ) : (
                              <X className="size-3 shrink-0" strokeWidth={3} />
                            )}
                            <span className="truncate">обрали {getTeam(actual).tag}</span>
                          </p>
                        ) : closed && !locked ? (
                          <p className="flex items-center gap-1 text-[0.6875rem] font-semibold text-warning">
                            <Lock className="size-3 shrink-0" />
                            <span className="truncate">пару закрито</span>
                          </p>
                        ) : (
                          <p className="truncate text-[0.6875rem] text-ink-subtle">нижчий сід</p>
                        )}
                      </div>
                      <ChevronRight className="hidden size-4 shrink-0 text-ink-faint sm:block" />
                      <HighPicker
                        highs={availableHighs}
                        value={chosen}
                        disabled={closed}
                        dropUp={dropUp}
                        onPick={(h) => pick(low, h)}
                        onClear={() => clearPick(low)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {!locked && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-xs text-ink-subtle">
                Обрано <span className="tnum font-semibold text-ink">{made}</span> / {lows.length}
              </span>
              <div className="flex items-center gap-2">
              <button
                onClick={resetStage}
                disabled={openMade === 0}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <RotateCcw className="size-3.5" />
                Скинути
              </button>
              <button
                disabled={!allOpenPicked}
                onClick={() => setSaved(true)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
                  saved
                    ? "bg-success/15 text-success"
                    : allOpenPicked
                      ? "bg-accent text-accent-ink hover:bg-accent-hover"
                      : "bg-surface-3 text-ink-faint",
                )}
              >
                {saved ? <><Check className="size-4" strokeWidth={3} /> Прогноз збережено</> : "Зберегти bounty-прогноз"}
              </button>
              </div>
            </div>
          )}
          </>
          )}
          </div>
          {!user && <DraftLoginGate />}
        </div>
      )}
    </div>
  );
}

/** Overlay shown over the blurred pairs — sign in to reveal and draft. */
function DraftLoginGate() {
  return (
    <div className="absolute inset-0 grid place-items-center p-4">
      <div className="w-full max-w-xs rounded-xl border border-border bg-surface/90 p-5 text-center shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-sm">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-accent">
          <Lock className="size-5" />
        </div>
        <p className="mt-3 text-sm font-bold text-ink">Прогнози доступні після входу</p>
        <p className="mt-1 text-xs text-ink-subtle">
          Увійди, щоб побачити пари та зробити свій bounty-прогноз.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <LogIn className="size-4" />
          Увійти
        </Link>
      </div>
    </div>
  );
}

function HighPicker({
  highs,
  value,
  disabled,
  dropUp,
  onPick,
  onClear,
}: {
  highs: string[];
  value?: string;
  disabled?: boolean;
  dropUp?: boolean;
  onPick: (slug: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const team = value ? getTeam(value) : null;

  return (
    <div className="group relative shrink-0">
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex h-11 w-[8.5rem] items-center gap-2 rounded-lg border px-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 sm:w-40",
          value ? "border-accent/50 bg-accent/10" : "border-border-strong bg-surface-2 hover:bg-surface-3",
        )}
      >
        {team ? (
          <>
            <TeamLogo team={team} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{team.tag}</span>
          </>
        ) : (
          <span className="flex-1 px-1 text-sm font-semibold text-ink-muted">Обрати</span>
        )}
        <Swords
          className={cn(
            "size-4 shrink-0 text-ink-subtle transition-opacity",
            // Fades out on desktop hover so the clear-X can take its place.
            value && !disabled && "pick-swords",
          )}
        />
      </button>

      {/* Desktop: hover a chosen team → X to free it (mobile clears via the list). */}
      {value && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label="Прибрати вибір"
          className="pick-clear absolute right-1.5 top-1/2 size-7 -translate-y-1/2 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-3 hover:text-danger"
        >
          <X className="size-4" strokeWidth={2.5} />
        </button>
      )}

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute right-0 z-40 max-h-56 w-52 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)]",
              dropUp ? "bottom-[calc(100%+0.25rem)]" : "top-[calc(100%+0.25rem)]",
            )}
          >
            {highs.map((h) => {
              const t = getTeam(h);
              const sel = value === h;
              return (
                <button
                  key={h}
                  // Clicking the already-picked team frees it up again.
                  title={sel ? "Натисни, щоб звільнити команду" : undefined}
                  onClick={() => {
                    if (sel) onClear();
                    else onPick(h);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    sel ? "bg-accent/12" : "hover:bg-surface-2",
                  )}
                >
                  <TeamLogo team={t} size="sm" />
                  <span className="flex-1 truncate text-sm font-semibold text-ink">{t.name}</span>
                  {sel && <Check className="size-4 text-accent" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StagePlaceholder() {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Lock className="size-7 text-ink-faint" />
      <p className="mt-3 text-sm font-semibold text-ink">Стадію ще не налаштовано</p>
      <p className="mt-1 text-xs text-ink-subtle">Команди з’являться, щойно адмін відкриє стадію.</p>
    </div>
  );
}
