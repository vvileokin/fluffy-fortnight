"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, Minus, Swords } from "lucide-react";
import { formatInt } from "@/lib/utils";
import { type LeaderRow } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { BrandIcon, type BrandIconName } from "@/components/ui/BrandIcon";
import { BlastMark } from "@/components/ui/BlastMark";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

/** Shown on hover (native tooltip, so the table's overflow-hidden container
 *  can't clip it). */
export const STREAK_HINT = "Рахуються лише прогнози на матчі";

const STREAK_HINT_BOUNTY = "Рахуються лише прогнози на матчі BLAST";

function RankMedal({
  rank,
  rankEnd,
  inPill,
}: {
  rank: number;
  rankEnd?: number;
  inPill?: boolean;
}) {
  // Impeccable: Crafted Podium Marks — colour alone. The glows here were doing
  // the podium's job a second time, one row down.
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
        tied ? "text-[0.6875rem]" : "text-[0.8125rem]",
        // Inside the filled "you" pill the medal colours would fight the yellow.
        inPill ? "text-accent-ink" : (styles[rank] ?? "text-ink-muted"),
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

/** The event's own accent, standing in for the brand yellow on every cue.
    Reads the palette rather than naming a colour, so the board takes whichever
    event it is sitting inside. */
const EVENT_INK = "text-[rgb(var(--skin-ring))]";

function Row({
  row,
  blastPoints,
  pointsIcon,
  showStreak,
  ewc = false,
  onChallenge,
}: {
  row: LeaderRow;
  blastPoints: boolean;
  pointsIcon: BrandIconName;
  showStreak: boolean;
  ewc?: boolean;
  onChallenge?: (row: LeaderRow) => void;
}) {
  return (
    /* Impeccable: Crafted Board Row — each place is its own rounded slab with
       the rank riding in a pill on the left, instead of a divided table row.
       The board reads as a stack of players; a ruled grid read as a
       spreadsheet of them. */
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] sm:gap-3",
        ewc
          ? row.isYou
            ? "skin-row-you"
            : "skin-row"
          : row.isYou
            ? "bg-[color-mix(in_oklch,var(--accent)_8%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_24%,transparent)]"
            : "bg-surface hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "flex h-7 shrink-0 items-center gap-1 rounded-lg pl-2 pr-2",
          row.isYou
            ? ewc
              ? "bg-[rgb(var(--skin-ring))] text-black"
              : "bg-accent text-accent-ink"
            : ewc
              ? "bg-white/[0.07]"
              : "bg-fill-2",
        )}
      >
        <RankMedal rank={row.rank} rankEnd={row.rankEnd} inPill={row.isYou} />
        <Delta delta={row.delta} />
      </span>
      <Avatar name={row.handle} src={row.avatarUrl} size="sm" ring={row.isYou} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-semibold",
          row.isYou ? (ewc ? EVENT_INK : "text-accent") : "text-ink",
        )}
      >
        {row.handle}
        {row.isYou && (
          <span className="ml-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-ink-subtle">
            це ти
          </span>
        )}
      </span>
      {/* Impeccable: Crafted Streak Cell — mark and count share one colour and
          both sit at `leading-none`, so their boxes are the same height and the
          pair centres against each other instead of the glyph floating above
          the digit. It stays on phones: a streak is the one stat that rewards
          checking the board daily, and hiding it under 640px was the width
          budget of the "правильних" column talking. */}
      {/* Both stats are the same yellow now, so colour can't tell them apart —
          shape has to. The streak sits in a recessed capsule and reads as a
          badge you're carrying; the points figure below is bare, brighter and
          larger, and reads as the number that ranks you. Same hue, different
          object. */}
      {showStreak && (
        <Tooltip
          label={blastPoints ? STREAK_HINT_BOUNTY : STREAK_HINT}
          className="flex w-12 shrink-0 cursor-help items-center justify-end sm:w-14"
        >
          {row.streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-fill-2 py-0.5 pl-1 pr-1.5 text-[0.6875rem] text-accent/85">
              <BrandIcon name="streak" className="size-3.5" />
              <span className="tnum font-mono font-bold leading-none">
                {row.streak}
              </span>
            </span>
          )}
        </Tooltip>
      )}
      {/* The "N правильних" column is gone. It was the widest thing on the row
          and the least looked-at: points already encode accuracy, and the
          space it held is what pushed the streak off phones. */}
      <span
        className={cn(
          "tnum flex w-[5.25rem] shrink-0 items-center justify-end gap-1.5 font-mono text-sm font-bold sm:w-24",
          ewc ? EVENT_INK : "text-accent",
        )}
      >
        {blastPoints && <BlastMark className="size-3.5 text-accent" />}
        <BrandIcon name={pointsIcon} className="size-4" />
        {formatInt(row.points)}
      </span>
      {/* Only on other people, and only where the board was given a handler —
          a swords icon beside your own name would be an invitation to duel
          yourself. */}
      {onChallenge && row.userId && !row.isYou && (
        <button
          onClick={() => onChallenge(row)}
          aria-label={`Викликати ${row.handle}`}
          title={`Викликати ${row.handle}`}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-white/[0.08] hover:text-[rgb(var(--skin-ring))]"
        >
          <Swords className="size-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Impeccable: Crafted Podium — the head of the board stops being three more
 * table rows. First place stands centre and taller on its own lit plinth, the
 * runners-up flank it lower; the ranking is legible from the silhouette before
 * a single number is read. Deliberately not the reference's floating avatars on
 * a purple wash: this keeps the product's own dark plate + single yellow
 * signal, and the medal colours already in the design system.
 */
/* One colour on the podium, not three.
   It used to run gold / silver / bronze, which imported a medal metaphor the
   rest of the product doesn't use and put two off-brand hues (a grey and an
   orange) on the most looked-at block on the site. All three places now wear
   the brand yellow; rank is carried by size, height and light instead. The
   ring simply fades back for second and third, and only first throws a glow —
   so the eye still lands on the winner without a second colour doing the job. */
const PODIUM_TONE = [
  { ring: "var(--accent)", pad: "sm:pt-0" },
  { ring: "color-mix(in oklch, var(--accent) 55%, transparent)", pad: "sm:pt-7" },
  { ring: "color-mix(in oklch, var(--accent) 38%, transparent)", pad: "sm:pt-9" },
] as const;

function Podium({
  rows,
  blastPoints,
  pointsIcon,
  showStreak,
  ewc = false,
}: {
  rows: LeaderRow[];
  blastPoints: boolean;
  pointsIcon: BrandIconName;
  showStreak: boolean;
  ewc?: boolean;
}) {
  // Visual order puts 2 – 1 – 3 across, while the DOM keeps 1 – 2 – 3 so screen
  // readers and keyboard order still get the real ranking.
  const order = ["order-2", "order-1", "order-3"];
  // At the event the podium's rank light is the ember, not the brand yellow.
  const ringOf = (i: number) =>
    ewc
      ? ["rgb(255 122 44)", "rgb(255 122 44 / 0.55)", "rgb(255 122 44 / 0.38)"][i]
      : PODIUM_TONE[i].ring;
  return (
    <div
      className={cn(
        "relative isolate rounded-2xl px-3 pb-5 pt-7 sm:px-6",
        ewc ? "skin-aura-card" : "bg-surface",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-2xl",
          ewc
            ? "bg-[radial-gradient(52%_62%_at_50%_34%,rgb(255_96_20/0.12),transparent_70%)]"
            : "bg-[radial-gradient(52%_62%_at_50%_34%,color-mix(in_oklch,var(--accent)_8%,transparent),transparent_70%)]",
        )}
      />
      <ol className="relative flex items-end justify-center gap-2 sm:gap-6">
        {rows.map((row, i) => {
          const tone = PODIUM_TONE[i];
          const first = i === 0;
          return (
            <li
              key={`${i}-${row.handle}`}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:max-w-[11rem]",
                order[i],
                tone.pad,
              )}
            >
              <span
                className="relative inline-flex rounded-full"
                style={{
                  // Only the winner is lit. Second and third get the ring alone,
                  // so the glow reads as a rank signal rather than decoration.
                  boxShadow: first
                    ? `0 0 0 2px ${ringOf(i)}, 0 8px 30px -14px ${ewc ? "rgb(255 122 44 / 0.75)" : "color-mix(in oklch, var(--accent) 75%, transparent)"}`
                    : `0 0 0 1.5px ${ringOf(i)}`,
                }}
              >
                <Avatar name={row.handle} src={row.avatarUrl} size={first ? "xl" : "lg"} />
                <span
                  className={cn(
                    "tnum absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-md px-1.5 text-[0.625rem] font-extrabold leading-4",
                    first
                      ? ewc
                        ? "bg-[rgb(var(--skin-ring))] text-black"
                        : "bg-accent text-accent-ink"
                      : ewc
                        ? `bg-black/45 ${EVENT_INK}`
                        : "bg-surface-3 text-accent",
                  )}
                >
                  {row.rank}
                </span>

                {/* Impeccable: Crafted Podium Streak — the board rows carry the
                    streak in a column, but the podium has no columns, so it
                    rides the portrait instead: a flame burning off the top-right
                    of the frame, count in the flame's own colour. Sitting on the
                    avatar rather than under the points keeps the three-line
                    stack (face → name → score) intact, and it's diagonally
                    opposite the rank badge so the two never collide. Hidden at
                    zero — an unlit flame would just be noise. */}
                {showStreak && row.streak > 0 && (
                  <Tooltip
                    label={blastPoints ? STREAK_HINT_BOUNTY : STREAK_HINT}
                    className="absolute -right-1.5 -top-1.5 flex cursor-help items-center gap-0.5 rounded-full bg-surface-2 py-0.5 pl-1 pr-1.5 text-accent shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_10%,transparent)]"
                  >
                    <BrandIcon name="streak" className={first ? "size-3.5" : "size-3"} />
                    <span
                      className={cn(
                        "tnum font-mono font-extrabold leading-none",
                        first ? "text-[0.6875rem]" : "text-[0.625rem]",
                      )}
                    >
                      {row.streak}
                    </span>
                  </Tooltip>
                )}
              </span>
              <span
                className={cn(
                  "mt-1 max-w-full truncate text-center font-bold tracking-tight",
                  first ? "text-base text-ink" : "text-sm text-ink-muted",
                )}
              >
                {row.handle}
              </span>
              <span
                className={cn(
                  "tnum flex items-center gap-1.5 font-mono font-extrabold",
                  ewc ? EVENT_INK : "text-accent",
                  first ? "text-sm" : "text-xs",
                )}
              >
                {blastPoints && <BlastMark className="size-3.5" />}
                <BrandIcon name={pointsIcon} className={first ? "size-4" : "size-3.5"} />
                {formatInt(row.points)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LeaderboardTable({
  rows,
  topN,
  blastPoints = false,
  pointsIcon = "points",
  showStreak = true,
  ewc = false,
  expandable = false,
  podium = false,
  onChallenge,
  className,
}: {
  rows: LeaderRow[];
  /** Show only the top N; if "you" rank beyond it, append your row after a gap. */
  topN?: number;
  /** Prefix points with the BLAST mark (bounty/event leaderboard). */
  blastPoints?: boolean;
  /** Which currency mark sits beside the points figure. */
  pointsIcon?: BrandIconName;
  /** EWC keeps no event streak, so its board hides the column entirely. */
  showStreak?: boolean;
  /** Dress the whole board in the event's ember instead of the brand yellow. */
  ewc?: boolean;
  /** Let the "· · ·" gap expand the board to the full list. */
  expandable?: boolean;
  /** Lift the top three onto a podium above the list (season board). */
  podium?: boolean;
  /**
   * Offered on a row that is somebody else. The board is the one page that
   * already answers "who is above me", so a challenge belongs here rather than
   * on a list of fixtures — you are not shopping for a match, you are looking
   * at a person you want to beat.
   */
  onChallenge?: (row: LeaderRow) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const you = rows.find((r) => r.isYou);
  // The podium takes the first three off the top; everything below is the list.
  const onPodium = podium && rows.length >= 3 ? rows.slice(0, 3) : [];
  const board = onPodium.length ? rows.slice(3) : rows;
  const collapsed = !!topN && !expanded;
  const top = collapsed ? board.filter((r) => r.rank <= topN!) : board;
  const youBelow =
    collapsed && you && you.rank > topN! && !onPodium.some((r) => r.isYou);
  // When you're in the top slice you stay highlighted in place; otherwise you're appended.
  const inline = youBelow ? top.filter((r) => !r.isYou) : top;
  const hasMore = !!topN && board.some((r) => r.rank > topN);

  const Dots = ({ onClick }: { onClick?: () => void }) =>
    onClick ? (
      <button
        onClick={onClick}
        aria-label="Показати весь рейтинг"
        className="flex w-full items-center justify-center rounded-xl py-1.5 text-ink-faint transition-colors hover:bg-fill-2 hover:text-ink-muted"
      >
        <span className="text-xs tracking-widest">· · ·</span>
      </button>
    ) : (
      <div className="flex items-center justify-center py-1 text-ink-faint">
        <span className="text-xs tracking-widest">· · ·</span>
      </div>
    );

  if (onPodium.length) {
    return (
      /* 6px, the same step the rows use between themselves — the podium was
         sitting 12px off the list, which read as a stray gap rather than a
         group break. */
      <div className={cn("space-y-1.5", className)}>
        <Podium rows={onPodium} blastPoints={blastPoints} pointsIcon={pointsIcon} showStreak={showStreak} ewc={ewc} />
        <div className="flex flex-col gap-1.5">
          {inline.map((row, i) => (
            <Row key={`${i}-${row.handle}`} row={row} blastPoints={blastPoints} pointsIcon={pointsIcon} showStreak={showStreak} ewc={ewc} onChallenge={onChallenge} />
          ))}
          {youBelow && you && (
            <>
              <Dots onClick={expandable && hasMore ? () => setExpanded(true) : undefined} />
              <Row row={you} blastPoints={blastPoints} pointsIcon={pointsIcon} showStreak={showStreak} ewc={ewc} onChallenge={onChallenge} />
            </>
          )}
          {collapsed && !youBelow && expandable && hasMore && (
            <Dots onClick={() => setExpanded(true)} />
          )}
          {expandable && expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-ink-subtle transition-colors hover:bg-fill-2 hover:text-ink"
            >
              Згорнути
              <ChevronUp className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        className,
      )}
    >
      {/* Handles aren't unique (two players can share a display name), so the
          key has to include the position. */}
      {inline.map((row, i) => (
        <Row key={`${i}-${row.handle}`} row={row} blastPoints={blastPoints} pointsIcon={pointsIcon} showStreak={showStreak} ewc={ewc} onChallenge={onChallenge} />
      ))}

      {/* You rank below the visible top — dots, then your highlighted row. */}
      {youBelow && you && (
        <>
          <Dots onClick={expandable && hasMore ? () => setExpanded(true) : undefined} />
          <Row row={you} blastPoints={blastPoints} pointsIcon={pointsIcon} showStreak={showStreak} ewc={ewc} onChallenge={onChallenge} />
        </>
      )}

      {/* You're inside the top but there's more board to see. */}
      {collapsed && !youBelow && expandable && hasMore && (
        <Dots onClick={() => setExpanded(true)} />
      )}

      {expandable && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-ink-subtle transition-colors hover:bg-fill-2 hover:text-ink"
        >
          Згорнути
          <ChevronUp className="size-3.5" />
        </button>
      )}
    </div>
  );
}
