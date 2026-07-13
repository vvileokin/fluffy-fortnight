"use client";

import * as React from "react";
import { Trophy, RotateCcw, Check } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTeam, type Team } from "@/lib/data";
import { cn } from "@/lib/utils";

type Slot = Team | null;

/** 4-team single-elimination stage predictor: two semis feed a final. */
export function BracketPredictor({ teamSlugs }: { teamSlugs: string[] }) {
  const seeds = teamSlugs.slice(0, 4).map(getTeam);
  const [sf1, setSf1] = React.useState<Slot>(null);
  const [sf2, setSf2] = React.useState<Slot>(null);
  const [champion, setChampion] = React.useState<Slot>(null);
  const [saved, setSaved] = React.useState(false);

  function pickSemi(which: 1 | 2, team: Team) {
    if (which === 1) {
      setSf1(team);
      if (champion && champion.slug !== team.slug && champion.slug !== sf2?.slug)
        setChampion(null);
    } else {
      setSf2(team);
      if (champion && champion.slug !== team.slug && champion.slug !== sf1?.slug)
        setChampion(null);
    }
    setSaved(false);
  }

  function pickChampion(team: Team) {
    setChampion(team);
  }

  function reset() {
    setSf1(null);
    setSf2(null);
    setChampion(null);
    setSaved(false);
  }

  const finalReady = sf1 && sf2;
  const complete = sf1 && sf2 && champion;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Обери переможців — команди просуваються далі автоматично.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <RotateCcw className="size-3.5" />
          Скинути
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        {/* Semifinals */}
        <div className="space-y-4">
          <BracketMatch
            label="Півфінал 1"
            teams={[seeds[0], seeds[1]]}
            picked={sf1}
            onPick={(t) => pickSemi(1, t)}
          />
          <BracketMatch
            label="Півфінал 2"
            teams={[seeds[2], seeds[3]]}
            picked={sf2}
            onPick={(t) => pickSemi(2, t)}
          />
        </div>

        {/* Connector */}
        <div className="hidden h-px w-8 bg-border sm:block" />

        {/* Final */}
        <div>
          <BracketMatch
            label="Гранд-фінал"
            teams={[sf1, sf2]}
            picked={champion}
            onPick={pickChampion}
            disabled={!finalReady}
            emphasis
          />
          {champion && (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-accent/40 bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] px-3.5 py-2.5">
              <Trophy className="size-5 text-accent" />
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-subtle">
                  Твій чемпіон
                </p>
                <p className="text-sm font-bold text-ink">{champion.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs text-ink-subtle">
          {complete
            ? "Симуляцію заповнено"
            : "Заповни всі стадії, щоб зберегти прогноз"}
        </span>
        <button
          disabled={!complete}
          onClick={() => setSaved(true)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
            saved
              ? "bg-success/15 text-success"
              : complete
                ? "bg-accent text-accent-ink hover:bg-accent-hover"
                : "bg-surface-3 text-ink-faint",
          )}
        >
          {saved ? (
            <>
              <Check className="size-4" strokeWidth={3} /> Збережено
            </>
          ) : (
            "Зберегти симуляцію"
          )}
        </button>
      </div>
    </div>
  );
}

function BracketMatch({
  label,
  teams,
  picked,
  onPick,
  disabled,
  emphasis,
}: {
  label: string;
  teams: [Slot, Slot];
  picked: Slot;
  onPick: (t: Team) => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-surface",
        emphasis ? "border-border-strong" : "border-border",
        disabled && "opacity-50",
      )}
    >
      <div className="border-b border-border px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-subtle">
        {label}
      </div>
      <div className="divide-y divide-border">
        {teams.map((team, i) => {
          const isPicked = team && picked?.slug === team.slug;
          return (
            <button
              key={i}
              disabled={!team || disabled}
              onClick={() => team && onPick(team)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed",
                isPicked
                  ? "bg-[color-mix(in_oklch,var(--accent)_12%,transparent)]"
                  : team
                    ? "hover:bg-surface-2"
                    : "",
              )}
            >
              {team ? (
                <>
                  <TeamLogo team={team} size="sm" />
                  <span
                    className={cn(
                      "flex-1 truncate text-sm font-semibold",
                      isPicked ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {team.name}
                  </span>
                  {isPicked && (
                    <span className="grid size-4 place-items-center rounded-full bg-accent text-accent-ink">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-ink-subtle">Очікує переможця</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
