"use client";

import * as React from "react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { EwcMark } from "@/components/ui/EwcMark";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTeam } from "@/lib/data";
import { underdogTier } from "@/lib/favourite-team";
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
 * Impeccable: Crafted Ledger — every slip, and what it did to the balance.
 *
 * Both blocks carry the event mark. These are EWC points: a separate currency,
 * earned and spent only at this one tournament, sitting on a profile whose
 * other numbers are all season-long. Without the mark a reader would reasonably
 * read the figures as their ordinary balance and wonder why it doesn't add up.
 */
export function BetHistory() {
  const [bets, setBets] = React.useState<Row[] | null>(null);
  const [team, setTeam] = React.useState<string | null>(null);
  const [earned, setEarned] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/bets", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/favourite", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([b, f]) => {
        if (cancelled) return;
        if (b.ok) setBets(b.bets ?? []);
        if (f.ok) {
          setTeam(f.team ?? null);
          setEarned(f.earned ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const t = team ? getTeam(team) : undefined;
  const band = team ? underdogTier(team) : null;
  // Nothing staked and nobody backed — an empty ledger is noise on a profile.
  if (!team && (!bets || bets.length === 0)) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
        <EwcMark className="h-2.5 w-auto shrink-0 text-[rgb(var(--ewc-ring))]" />
        Ставки та команда
      </h2>

      {t && (
        <div className="flex items-center gap-2.5 rounded-xl surface-1 p-3.5">
          <TeamLogo team={t} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{t.name}</p>
            <p className="text-xs text-ink-subtle">
              Улюблена команда на EWC
              {band && band.multiplier > 1 && ` · ×${band.multiplier} за андердога`}
            </p>
          </div>
          {earned > 0 && (
            <span className="tnum flex shrink-0 items-center gap-1 font-mono text-sm font-extrabold text-success">
              +{formatInt(earned)}
              <BrandIcon name="points-ewc" className="size-4" />
            </span>
          )}
        </div>
      )}

      {bets && bets.length > 0 && (
        <div className="overflow-hidden rounded-xl surface-1">
          {bets.map((b, i) => {
            const settled = !!b.settled_at;
            const won = settled && (b.payout ?? 0) > 0;
            return (
              <div
                key={b.question_id}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5",
                  i > 0 &&
                    "shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{b.title}</p>
                  <p className="tnum truncate text-xs text-ink-subtle">
                    {b.option ? `${b.option} · ` : ""}
                    {formatInt(b.stake)} × {b.odds}
                  </p>
                </div>
                <span
                  className={cn(
                    "tnum flex shrink-0 items-center gap-1 font-mono text-sm font-extrabold",
                    !settled ? "text-ink-muted" : won ? "text-success" : "text-ink-faint",
                  )}
                >
                  {!settled ? (
                    <>
                      {formatInt(Math.floor(b.stake * b.odds))}
                      <BrandIcon name="points-ewc" className="size-4" />
                    </>
                  ) : won ? (
                    <>
                      +{formatInt(b.payout ?? 0)}
                      <BrandIcon name="points-ewc" className="size-4" />
                    </>
                  ) : (
                    <span className="text-xs font-semibold">не зіграла</span>
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
