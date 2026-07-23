"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { createClient } from "@/lib/supabase/client";
import {
  matchTeam,
  matchTimeLabel,
  slotTimeLabel,
  getTeam,
  bracketPlayoffRounds,
  type Match,
  type Team,
  type BracketSlot,
  type BracketRound,
} from "@/lib/data";
import { cn } from "@/lib/utils";

/** Confirmed pairs per bounty stage: stageId → list of [low, high] matchups. */
type StagePairs = Record<string, [string, string][]>;

/** Public read of each stage's confirmed results (the correct pairs). */
function useStagePairs(): StagePairs {
  const [pairs, setPairs] = React.useState<StagePairs>({});
  React.useEffect(() => {
    let cancelled = false;
    createClient()
      .from("bounty_stages")
      .select("stage_id, results")
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: StagePairs = {};
        for (const r of data) {
          const results = r.results && typeof r.results === "object" && !Array.isArray(r.results)
            ? (r.results as Record<string, string>)
            : {};
          const list = Object.entries(results).filter(([, high]) => !!high) as [string, string][];
          if (list.length) next[r.stage_id] = list;
        }
        setPairs(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return pairs;
}

/**
 * The playoff bracket, drawn as columns that flow left → right the way a real
 * bracket does. Stage 1 is the online run (Round of 32 from the real matches,
 * then Round of 16); Stage 2 is the LAN playoff (Quarter-finals → Semi-finals →
 * Grand final). Later rounds fill in from the admin's confirmed draft pairs as
 * they're set, and stay TBD until then. Each stage is a collapsible section,
 * closed until opened.
 */
export function TournamentBracket({ matches }: { matches: Match[] }) {
  const pairs = useStagePairs();
  // First match to last — live and finished sort by their start time too.
  const roundOf32 = [...matches].sort((a, b) =>
    (a.startISO || "").localeCompare(b.startISO || ""),
  );
  const stage1 = bracketPlayoffRounds.filter((r) => r.stage === 1);
  const stage2 = bracketPlayoffRounds.filter((r) => r.stage === 2);

  const stage1Count = roundOf32.length + stage1.reduce((n, r) => n + r.slots.length, 0);
  const stage2Count = stage2.reduce((n, r) => n + r.slots.length, 0);

  return (
    <div className="space-y-3">
      <StageSection title="Stage 1" subtitle="Онлайн-раунди" count={stage1Count}>
        <BracketTrack>
          {roundOf32.length > 0 && (
            <RoundColumn title="Раунд 32" count={roundOf32.length}>
              {roundOf32.map((m) => (
                <RealMatch key={m.id} match={m} />
              ))}
            </RoundColumn>
          )}
          {stage1.map((r) => (
            <RoundColumn key={r.key} title={r.title} count={r.slots.length}>
              <RoundSlots round={r} pairs={pairs} />
            </RoundColumn>
          ))}
        </BracketTrack>
      </StageSection>

      <StageSection title="Stage 2" subtitle="Плейоф на LAN" count={stage2Count}>
        <BracketTrack>
          {stage2.map((r) => (
            <RoundColumn key={r.key} title={r.title} count={r.slots.length}>
              <RoundSlots round={r} pairs={pairs} />
            </RoundColumn>
          ))}
        </BracketTrack>
      </StageSection>
    </div>
  );
}

/**
 * A future round's cards: the admin's confirmed pairs first (teams shown, time
 * still TBD), then blank TBD slots for the pairs not yet decided.
 */
function RoundSlots({ round, pairs }: { round: BracketRound; pairs: StagePairs }) {
  const seeded = (round.seedFrom ? pairs[round.seedFrom] : undefined) ?? [];
  const blanks = Math.max(0, round.slots.length - seeded.length);
  return (
    <>
      {seeded.map(([low, high], i) => (
        <PairMatch key={`p${i}`} low={low} high={high} format={round.slots[i]?.format ?? "BO3"} />
      ))}
      {Array.from({ length: blanks }, (_, i) => (
        <TbdMatch key={`t${i}`} slot={round.slots[seeded.length + i] ?? { format: "BO3" }} />
      ))}
    </>
  );
}

function StageSection({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-ink">{title}</span>
          <span className="truncate text-xs text-ink-subtle">{subtitle}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tnum text-xs font-semibold text-ink-subtle">{count} матчів</span>
          <ChevronDown
            className={cn("size-4 text-ink-subtle transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>
      {open && <div className="p-3 sm:p-4">{children}</div>}
    </div>
  );
}

/** Horizontal, swipeable track of round columns — the bracket flows across it. */
function BracketTrack({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
      {children}
    </div>
  );
}

function RoundColumn({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-[13.5rem] shrink-0 flex-col gap-2.5">
      <div className="flex items-center gap-2 px-0.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h3>
        <span className="tnum text-xs font-semibold text-ink-subtle">{count}</span>
      </div>
      {children}
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
        <span className="font-semibold text-ink-subtle">
          {slot.startISO ? slotTimeLabel(slot.startISO) : "TBD"}
        </span>
      </div>
      <TbdLine />
      <div className="h-px bg-border" />
      <TbdLine />
    </div>
  );
}

/** A confirmed matchup whose time isn't set yet: both teams shown, time TBD. */
function PairMatch({ low, high, format }: { low: string; high: string; format: string }) {
  const a = getTeam(high); // higher seed on top
  const b = getTeam(low);
  if (!a || !b) return <TbdMatch slot={{ format: format as BracketSlot["format"] }} />;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 px-3 pb-0.5 pt-1.5 text-[0.6875rem]">
        <span className="font-medium text-ink-subtle">{format}</span>
        <span className="font-semibold text-ink-subtle">TBD</span>
      </div>
      <TeamLine team={a} score={0} win={false} lose={false} showScore={false} />
      <div className="h-px bg-border" />
      <TeamLine team={b} score={0} win={false} lose={false} showScore={false} />
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
