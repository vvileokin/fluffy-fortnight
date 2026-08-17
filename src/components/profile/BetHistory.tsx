"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { cn, formatInt } from "@/lib/utils";

type Row = {
  question_id: string;
  option_id: string;
  stake: number;
  odds: number;
  payout: number | null;
  settled_at: string | null;
  created_at: string;
  title: string;
  option?: string;
};

/**
 * Impeccable: Crafted Ledger — folded shut, with the total on the lid.
 *
 * A profile is read for its headline numbers; a full list of every slip is
 * reference material, and reference material that is always open competes with
 * the things people actually came for. Closed, the row still answers the only
 * question most visits have — how am I doing — by carrying the count and the
 * running total, so opening it is a choice rather than a chore.
 *
 * No event mark here. On the tournament page it says "this section belongs to
 * the event", but a profile has no other tournament to be confused with, so it
 * was decoration standing in a heading's light.
 */
export function BetHistory() {
  const [bets, setBets] = React.useState<Row[] | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/bets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) setBets(d.bets ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bets || bets.length === 0) return null;

  // Won minus staked: the only figure worth putting on a closed drawer, since
  // it says whether the whole exercise has been worth it. Pending slips count
  // as neither yet.
  const net = bets.reduce(
    (sum, b) => (b.settled_at ? sum + (b.payout ?? 0) - b.stake : sum),
    0,
  );
  const pending = bets.filter((b) => !b.settled_at).length;

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl surface-1 px-3.5 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <span className="text-sm font-bold text-ink">Ставки</span>
        <span className="tnum text-xs text-ink-subtle">
          {bets.length}
          {pending > 0 && ` · ${pending} в грі`}
        </span>
        <span
          className={cn(
            "tnum ms-auto flex items-center gap-1 font-mono text-sm font-extrabold",
            net > 0 ? "text-success" : net < 0 ? "text-ink-faint" : "text-ink-muted",
          )}
        >
          {net > 0 ? "+" : ""}
          {formatInt(net)}
          <BrandIcon name="points-ewc" className="size-4" />
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-subtle transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-1.5 overflow-hidden rounded-xl surface-1">
          {bets.map((b, i) => {
            const settled = !!b.settled_at;
            const won = settled && (b.payout ?? 0) > 0;
            return (
              <div
                key={b.question_id}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2",
                  i > 0 &&
                    "shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink">{b.title}</p>
                  <p className="tnum truncate text-[0.6875rem] text-ink-subtle">
                    {b.option ? `${b.option} · ` : ""}
                    {formatInt(b.stake)} × {b.odds}
                  </p>
                </div>
                <span
                  className={cn(
                    "tnum flex shrink-0 items-center gap-1 font-mono text-xs font-extrabold",
                    !settled ? "text-ink-muted" : won ? "text-success" : "text-ink-faint",
                  )}
                >
                  {!settled ? (
                    <>
                      {formatInt(Math.floor(b.stake * b.odds))}
                      <BrandIcon name="points-ewc" className="size-3.5" />
                    </>
                  ) : won ? (
                    <>
                      +{formatInt(b.payout ?? 0)}
                      <BrandIcon name="points-ewc" className="size-3.5" />
                    </>
                  ) : (
                    <span className="text-[0.6875rem] font-semibold">не зіграла</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
