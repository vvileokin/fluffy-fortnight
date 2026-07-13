"use client";

import * as React from "react";
import { Check, Swords, Info, ChevronRight, Lock } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Badge } from "@/components/ui/Badge";
import {
  bountyHighSeeds,
  bountyLowSeeds,
  bountyStages,
  getTeam,
} from "@/lib/data";
import { useUser } from "@/lib/supabase/use-user";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Picks = Record<string, Record<string, string>>; // stageId -> lowSlug -> highSlug

export function BountyPredictor() {
  const user = useUser();
  const router = useRouter();
  const [active, setActive] = React.useState(bountyStages[0].id);
  const [picks, setPicks] = React.useState<Picks>({});
  const [saved, setSaved] = React.useState(false);

  const stage = bountyStages.find((s) => s.id === active)!;
  const lows = bountyLowSeeds.slice(0, stage.pairCount);
  const highs = bountyHighSeeds.slice(0, stage.pairCount);
  const stagePicks = picks[stage.id] ?? {};
  const made = Object.keys(stagePicks).length;

  // Load this user's saved bounty picks.
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
        for (const r of data) {
          (next[r.stage_id] ??= {})[r.low_slug] = r.high_slug;
        }
        setPicks(next);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function pick(low: string, high: string) {
    if (!user) {
      router.push("/login");
      return;
    }
    setPicks((prev) => ({
      ...prev,
      [stage.id]: { ...(prev[stage.id] ?? {}), [low]: high },
    }));
    setSaved(false);
    createClient()
      .from("bounty_picks")
      .upsert(
        { user_id: user.id, stage_id: stage.id, low_slug: low, high_slug: high },
        { onConflict: "user_id,stage_id,low_slug" },
      )
      .then(() => {});
  }

  return (
    <div className="space-y-5">
      {/* Stage tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                on
                  ? "border-accent/50 bg-accent/10 text-ink"
                  : "border-border bg-surface text-ink-muted hover:bg-surface-2",
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
          {stage.locked ? (
            <Lock className="size-4 shrink-0 text-warning" />
          ) : (
            <Info className="size-4 shrink-0 text-info" />
          )}
          {stage.note}
        </p>
        <Badge tone="accent">до +{stage.reward} за пару</Badge>
      </div>

      {stage.locked ? (
        <LockedStage pairs={stage.pairCount} />
      ) : stage.kind === "picks" ? (
        <>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {lows.map((low) => {
              const lowTeam = getTeam(low);
              const chosen = stagePicks[low];
              return (
                <div
                  key={low}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5"
                >
                  <TeamLogo team={lowTeam} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{lowTeam.name}</p>
                    <p className="text-[0.6875rem] text-ink-subtle">нижчий сід · пікає</p>
                  </div>

                  <ChevronRight className="size-4 shrink-0 text-ink-faint" />

                  <HighPicker
                    highs={highs}
                    value={chosen}
                    onPick={(h) => pick(low, h)}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-ink-subtle">
              Обрано <span className="tnum font-semibold text-ink">{made}</span> / {stage.pairCount}
            </span>
            <button
              disabled={made < stage.pairCount}
              onClick={() => setSaved(true)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
                saved
                  ? "bg-success/15 text-success"
                  : made >= stage.pairCount
                    ? "bg-accent text-accent-ink hover:bg-accent-hover"
                    : "bg-surface-3 text-ink-faint",
              )}
            >
              {saved ? (
                <>
                  <Check className="size-4" strokeWidth={3} /> Прогноз збережено
                </>
              ) : (
                "Зберегти bounty-прогноз"
              )}
            </button>
          </div>
        </>
      ) : (
        <BracketStage reward={stage.reward} />
      )}
    </div>
  );
}

function HighPicker({
  highs,
  value,
  onPick,
}: {
  highs: string[];
  value?: string;
  onPick: (slug: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const team = value ? getTeam(value) : null;

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-[8.5rem] items-center gap-2 rounded-lg border px-2 text-left transition-colors sm:w-40",
          value
            ? "border-accent/50 bg-accent/10"
            : "border-border-strong bg-surface-2 hover:bg-surface-3",
        )}
      >
        {team ? (
          <>
            <TeamLogo team={team} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {team.tag}
            </span>
          </>
        ) : (
          <span className="flex-1 px-1 text-sm font-semibold text-ink-muted">
            Обрати
          </span>
        )}
        <Swords className="size-4 shrink-0 text-ink-subtle" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+0.25rem)] z-40 max-h-64 w-52 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)]">
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
                  <span className="flex-1 truncate text-sm font-semibold text-ink">
                    {t.name}
                  </span>
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

function LockedStage({ pairs }: { pairs: number }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      {Array.from({ length: pairs }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-2.5 opacity-70"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-faint">
            <Lock className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-subtle">TBD</p>
            <p className="text-[0.6875rem] text-ink-faint">очікує попередню стадію</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-ink-faint" />
          <span className="flex h-11 w-[8.5rem] items-center justify-center rounded-lg border border-dashed border-border bg-surface-2 text-sm font-semibold text-ink-faint sm:w-40">
            TBD
          </span>
        </div>
      ))}
    </div>
  );
}

function BracketStage({ reward }: { reward: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {["Півфінал 1", "Півфінал 2"].map((label) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-subtle">
              {label}
            </p>
            <div className="mt-3 space-y-2">
              {["Переможець ЧФ", "Переможець ЧФ"].map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2.5 text-sm text-ink-subtle"
                >
                  <span className="size-6 rounded-md border border-border bg-surface" />
                  {s} · навхрест
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-sm text-ink-muted">
        <Info className="size-4 shrink-0 text-info" />
        Пари півфіналів формуються системою навхрест після чвертьфіналів. Прогноз
        переможців відкриється тут — до +{reward} за вгадану стадію.
      </div>
    </div>
  );
}
