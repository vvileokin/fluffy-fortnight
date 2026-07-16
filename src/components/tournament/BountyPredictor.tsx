"use client";

import * as React from "react";
import { Check, Swords, Info, ChevronRight, Lock, Trophy } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Badge } from "@/components/ui/Badge";
import { bountyStages, getTeam } from "@/lib/data";
import { useUser } from "@/lib/supabase/use-user";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Picks = Record<string, Record<string, string>>; // stageId -> lowSlug -> highSlug
type StageState = {
  teams: string[];
  lowSeeds: string[];
  winners: string[];
  results: Record<string, string>; // lowSlug -> actual highSlug
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
  const lows = state?.lowSeeds ?? [];
  const highs = (state?.teams ?? []).filter((t) => !lows.includes(t));
  const deadlinePassed = !!state?.deadlineISO && new Date(state.deadlineISO).getTime() < Date.now();
  const locked = !!state?.locked || deadlinePassed;
  const configured = (state?.teams.length ?? 0) > 0;
  const stagePicks = picks[active] ?? {};
  const made = Object.keys(stagePicks).length;

  // Load stage config (public) + this user's saved picks.
  React.useEffect(() => {
    let cancelled = false;
    createClient()
      .from("bounty_stages")
      .select("stage_id, teams, low_seeds, winners, results, locked, deadline")
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, StageState> = {};
        for (const r of data) {
          next[r.stage_id] = {
            teams: Array.isArray(r.teams) ? r.teams : [],
            lowSeeds: Array.isArray(r.low_seeds) ? r.low_seeds : [],
            winners: Array.isArray(r.winners) ? r.winners : [],
            results: r.results && typeof r.results === "object" && !Array.isArray(r.results) ? r.results : {},
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
    if (locked) return;
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

  return (
    <div className="space-y-5">
      {/* Stage tabs */}
      <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            : meta.note}
        </p>
        <div className="flex items-center gap-2">
          {state?.deadlineISO && (
            <span className="text-xs text-ink-subtle">до {fmtDeadline(state.deadlineISO)}</span>
          )}
          <Badge tone="accent">до +{meta.reward} за пару</Badge>
        </div>
      </div>

      {!configured ? (
        <StagePlaceholder />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {lows.map((low, i) => {
              const lowTeam = getTeam(low);
              const chosen = stagePicks[low];
              const actual = state.results[low];
              const correct = !!actual && chosen === actual;
              const dropUp = lows.length > 2 && i >= lows.length - 2;
              return (
                <div key={low} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5">
                  <TeamLogo team={lowTeam} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{lowTeam.name}</p>
                    <p className="text-[0.6875rem] text-ink-subtle">
                      нижчий сід · пікає
                      {actual && (
                        <span className={cn("ml-1.5 font-semibold", correct ? "text-success" : "text-danger")}>
                          · {correct ? "вгадано" : "не вгадано"} (vs {getTeam(actual).tag})
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-ink-faint" />
                  <HighPicker highs={highs} value={chosen} disabled={locked} dropUp={dropUp} onPick={(h) => pick(low, h)} />
                </div>
              );
            })}
          </div>

          {meta.id === "sf" && <FinalBanner winners={state.winners} reward={meta.reward} />}

          {!locked && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-ink-subtle">
                Обрано <span className="tnum font-semibold text-ink">{made}</span> / {lows.length}
              </span>
              <button
                disabled={made < lows.length || lows.length === 0}
                onClick={() => setSaved(true)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
                  saved
                    ? "bg-success/15 text-success"
                    : made >= lows.length && lows.length > 0
                      ? "bg-accent text-accent-ink hover:bg-accent-hover"
                      : "bg-surface-3 text-ink-faint",
                )}
              >
                {saved ? <><Check className="size-4" strokeWidth={3} /> Прогноз збережено</> : "Зберегти bounty-прогноз"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HighPicker({
  highs,
  value,
  disabled,
  dropUp,
  onPick,
}: {
  highs: string[];
  value?: string;
  disabled?: boolean;
  dropUp?: boolean;
  onPick: (slug: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const team = value ? getTeam(value) : null;

  return (
    <div className="relative shrink-0">
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
        <Swords className="size-4 shrink-0 text-ink-subtle" />
      </button>

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
                  onClick={() => {
                    onPick(h);
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

function FinalBanner({ winners, reward }: { winners: string[]; reward: number }) {
  const finalists = winners.slice(0, 2).map(getTeam);
  if (finalists.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-sm text-ink-muted">
        <Info className="size-4 shrink-0 text-info" />
        Фінал сформується з переможців півфіналів (адмін познач «пройшов далі») — до +{reward}.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
      <Trophy className="size-5 shrink-0 text-accent" />
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-subtle">Гранд-фінал</p>
        <p className="truncate text-sm font-bold text-ink">
          {finalists.map((t) => t.name).join(" vs ")}
          {finalists.length < 2 && " · очікує 2-го фіналіста"}
        </p>
      </div>
    </div>
  );
}
