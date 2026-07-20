"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, Minus, Flame } from "lucide-react";
import { formatInt } from "@/lib/utils";
import { type LeaderRow } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { BlastMark } from "@/components/ui/BlastMark";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

/** Shown on hover (native tooltip, so the table's overflow-hidden container
 *  can't clip it). */
export const STREAK_HINT = "Рахуються лише прогнози на матчі";

const STREAK_HINT_BOUNTY = "Рахуються лише прогнози на матчі BLAST";

function RankMedal({ rank, rankEnd }: { rank: number; rankEnd?: number }) {
  const styles: Record<number, string> = {
    1: "text-tier1",
    2: "text-ink",
    3: "text-warning",
  };
  // Tied scores share a span of positions, e.g. "3—5".
  const tied = rankEnd !== undefined && rankEnd > rank;
  return (
    <span
      className={cn(
        "tnum whitespace-nowrap font-mono font-bold",
        tied ? "text-[0.6875rem]" : "text-sm",
        styles[rank] ?? "text-ink-subtle",
      )}
    >
      {tied ? `${rank}—${rankEnd}` : rank}
    </span>
  );
}

function Delta({ delta }: { delta?: number }) {
  if (delta === undefined || delta === 0)
    return <Minus className="size-3 text-ink-faint" />;
  if (delta > 0)
    return (
      <span className="flex items-center text-success">
        <ChevronUp className="size-3" />
        <span className="tnum text-[0.625rem] font-bold">{delta}</span>
      </span>
    );
  return (
    <span className="flex items-center text-danger">
      <ChevronDown className="size-3" />
      <span className="tnum text-[0.625rem] font-bold">{Math.abs(delta)}</span>
    </span>
  );
}

function Row({
  row,
  showCorrect,
  blastPoints,
}: {
  row: LeaderRow;
  showCorrect: boolean;
  blastPoints: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors",
        row.isYou
          ? "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]"
          : "hover:bg-surface-2",
      )}
    >
      <span className="grid w-10 shrink-0 place-items-center">
        <RankMedal rank={row.rank} rankEnd={row.rankEnd} />
      </span>
      <span className="w-5 shrink-0">
        <Delta delta={row.delta} />
      </span>
      <Avatar name={row.handle} src={row.avatarUrl} size="sm" ring={row.isYou} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-semibold",
          row.isYou ? "text-accent" : "text-ink",
        )}
      >
        {row.handle}
        {row.isYou && (
          <span className="ml-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-ink-subtle">
            це ти
          </span>
        )}
      </span>
      <Tooltip
        label={blastPoints ? STREAK_HINT_BOUNTY : STREAK_HINT}
        className="hidden w-9 shrink-0 cursor-help items-center justify-end gap-0.5 text-xs text-warning sm:flex"
      >
        {row.streak > 0 && (
          <>
            <Flame className="size-3.5" />
            <span className="tnum font-semibold">{row.streak}</span>
          </>
        )}
      </Tooltip>
      {showCorrect && (
        <span className="tnum hidden w-24 shrink-0 text-right text-xs text-ink-muted sm:block">
          {row.correct}
          <span className="text-ink-subtle"> правильних</span>
        </span>
      )}
      <span className="tnum flex w-20 shrink-0 items-center justify-end gap-1 font-mono text-sm font-bold text-accent">
        {blastPoints && <BlastMark className="size-3.5 text-accent" />}
        {formatInt(row.points)}
      </span>
    </div>
  );
}

export function LeaderboardTable({
  rows,
  showCorrect = true,
  topN,
  blastPoints = false,
  expandable = false,
  className,
}: {
  rows: LeaderRow[];
  showCorrect?: boolean;
  /** Show only the top N; if "you" rank beyond it, append your row after a gap. */
  topN?: number;
  /** Prefix points with the BLAST mark (bounty/event leaderboard). */
  blastPoints?: boolean;
  /** Let the "· · ·" gap expand the board to the full list. */
  expandable?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const you = rows.find((r) => r.isYou);
  const collapsed = !!topN && !expanded;
  const top = collapsed ? rows.filter((r) => r.rank <= topN!) : rows;
  const youBelow = collapsed && you && you.rank > topN!;
  // When you're in the top slice you stay highlighted in place; otherwise you're appended.
  const inline = youBelow ? top.filter((r) => !r.isYou) : top;
  const hasMore = !!topN && rows.some((r) => r.rank > topN);

  const Dots = ({ onClick }: { onClick?: () => void }) =>
    onClick ? (
      <button
        onClick={onClick}
        aria-label="Показати весь рейтинг"
        className="flex w-full items-center justify-center py-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-muted"
      >
        <span className="text-xs tracking-widest">· · ·</span>
      </button>
    ) : (
      <div className="flex items-center justify-center py-1 text-ink-faint">
        <span className="text-xs tracking-widest">· · ·</span>
      </div>
    );

  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      {/* Handles aren't unique (two players can share a display name), so the
          key has to include the position. */}
      {inline.map((row, i) => (
        <Row key={`${i}-${row.handle}`} row={row} showCorrect={showCorrect} blastPoints={blastPoints} />
      ))}

      {/* You rank below the visible top — dots, then your highlighted row. */}
      {youBelow && you && (
        <>
          <Dots onClick={expandable && hasMore ? () => setExpanded(true) : undefined} />
          <Row row={you} showCorrect={showCorrect} blastPoints={blastPoints} />
        </>
      )}

      {/* You're inside the top but there's more board to see. */}
      {collapsed && !youBelow && expandable && hasMore && (
        <Dots onClick={() => setExpanded(true)} />
      )}

      {expandable && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Згорнути
          <ChevronUp className="size-3.5" />
        </button>
      )}
    </div>
  );
}
