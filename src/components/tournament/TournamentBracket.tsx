"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TeamLogo } from "@/components/ui/TeamLogo";
import {
  matchTeam,
  matchTimeLabel,
  slotTimeLabel,
  bracketPlayoffRounds,
  type Match,
  type Team,
  type BracketSlot,
} from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The playoff bracket: Stage 1 (the opening Round of 32 filled from real matches,
 * in play order, then the Quarter-finals) and Stage 2 (Semi-finals → Grand final).
 * Only the opening round has teams yet; later rounds are TBD slots with a time.
 */
export function TournamentBracket({ matches }: { matches: Match[] }) {
  // First match to last — live and finished sort by their start time too.
  const roundOf32 = [...matches].sort((a, b) =>
    (a.startISO || "").localeCompare(b.startISO || ""),
  );
  const stage1 = bracketPlayoffRounds.filter((r) => r.stage === 1);
  const stage2 = bracketPlayoffRounds.filter((r) => r.stage === 2);

  return (
    <div className="space-y-4">
      <StageSection title="Stage 1" defaultOpen>
        {roundOf32.length > 0 && (
          <RoundBlock title="Раунд 32" count={roundOf32.length}>
            {roundOf32.map((m) => (
              <RealMatch key={m.id} match={m} />
            ))}
          </RoundBlock>
        )}
        {stage1.map((r) => (
          <RoundBlock key={r.key} title={r.title} count={r.slots.length}>
            {r.slots.map((s, i) => (
              <TbdMatch key={i} slot={s} />
            ))}
          </RoundBlock>
        ))}
      </StageSection>

      <StageSection title="Stage 2" defaultOpen>
        {stage2.map((r) => (
          <RoundBlock key={r.key} title={r.title} count={r.slots.length}>
            {r.slots.map((s, i) => (
              <TbdMatch key={i} slot={s} />
            ))}
          </RoundBlock>
        ))}
      </StageSection>
    </div>
  );
}

function StageSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-3"
      >
        <span className="text-sm font-bold uppercase tracking-wide text-ink">{title}</span>
        <ChevronDown
          className={cn("size-4 text-ink-subtle transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && <div className="space-y-5 p-4">{children}</div>}
    </div>
  );
}

function RoundBlock({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h3>
        <span className="tnum text-xs font-semibold text-ink-subtle">{count}</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function RealMatch({ match }: { match: Match }) {
  const a = matchTeam(match, "a");
  const b = matchTeam(match, "b");
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;
  const aWin = isFinished && match.scoreA > match.scoreB;
  const bWin = isFinished && match.scoreB > match.scoreA;

  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        "block overflow-hidden rounded-lg border transition-colors hover:border-border-strong",
        isLive ? "border-live/40 bg-surface" : "border-border bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-0.5 pt-1.5 text-[0.6875rem]">
        <span className="font-medium text-ink-subtle">{match.format}</span>
        {isLive ? (
          <LiveTag />
        ) : (
          <span className={cn("font-semibold", isFinished ? "text-ink-subtle" : "text-info")}>
            {matchTimeLabel(match)}
          </span>
        )}
      </div>
      <TeamLine team={a} score={match.scoreA} win={aWin} lose={bWin} showScore={showScore} />
      <div className="h-px bg-border" />
      <TeamLine team={b} score={match.scoreB} win={bWin} lose={aWin} showScore={showScore} />
    </Link>
  );
}

function TeamLine({
  team,
  score,
  win,
  lose,
  showScore,
}: {
  team: Team;
  score: number;
  win: boolean;
  lose: boolean;
  showScore: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <TeamLogo team={team} size="xs" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs font-semibold",
          lose ? "text-ink-subtle" : "text-ink",
        )}
      >
        {team.name}
      </span>
      {showScore && (
        <span
          className={cn(
            "tnum font-mono text-sm font-bold leading-none",
            win ? "text-accent" : lose ? "text-ink-subtle" : "text-ink",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function TbdMatch({ slot }: { slot: BracketSlot }) {
  return (
    <div className="overflow-hidden rounded-lg border border-dashed border-border bg-surface/50">
      <div className="flex items-center justify-between gap-2 px-3 pb-0.5 pt-1.5 text-[0.6875rem]">
        <span className="font-medium text-ink-subtle">{slot.format}</span>
        <span className="font-semibold text-info">{slotTimeLabel(slot.startISO)}</span>
      </div>
      <TbdLine />
      <div className="h-px bg-border" />
      <TbdLine />
    </div>
  );
}

/** Compact live marker — plain red text on the same line as the time label. */
function LiveTag() {
  return (
    <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-live">
      <span className="live-dot inline-block size-1.5 rounded-full bg-live" />
      LIVE
    </span>
  );
}

function TbdLine() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="grid size-5 shrink-0 place-items-center rounded bg-surface-2 text-[0.625rem] font-bold text-ink-faint">
        ?
      </span>
      <span className="text-xs font-semibold text-ink-faint">TBD</span>
    </div>
  );
}
