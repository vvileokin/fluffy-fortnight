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
 * Impeccable: Crafted Ledger — the three numbers, then the receipts.
 *
 * A single net figure on a closed drawer was honest and nearly useless: −40
 * reads the same whether it came off one unlucky call or thirty, and it can't
 * say whether the player is bad at this or simply hasn't finished yet. Staked,
 * returned and settled-record are the three facts that answer that, and they
 * are cheap enough to keep on screen permanently.
 *
 * The list stays folded. It is reference material — worth having, not worth
 * the room it takes on a page read for its headline numbers.
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

  const settled = bets.filter((b) => b.settled_at);
  const staked = bets.reduce((s, b) => s + b.stake, 0);
  const returned = settled.reduce((s, b) => s + (b.payout ?? 0), 0);
  const won = settled.filter((b) => (b.payout ?? 0) > 0).length;
  const live = bets.length - settled.length;
  const net = returned - settled.reduce((s, b) => s + b.stake, 0);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Ставки</h2>

      <div className="overflow-hidden rounded-xl surface-1">
        {/* Staked and returned are the whole story; the record underneath says
            how it was arrived at. Pending stakes are counted as spent, because
            they are — they have left the balance. */}
        <div className="grid grid-cols-3 divide-x divide-[color-mix(in_oklch,var(--ink)_7%,transparent)]">
          <Figure label="Поставлено" value={staked} />
          <Figure label="Повернулось" value={returned} tone={net >= 0 ? "up" : "down"} />
          <div className="px-3 py-2.5">
            <p className="text-[0.6875rem] leading-none text-ink-subtle">Зіграло</p>
            <p className="tnum mt-1.5 font-mono text-sm font-extrabold leading-none text-ink">
              {won}
              <span className="text-ink-subtle">/{settled.length || 0}</span>
              {live > 0 && (
                <span className="ml-1.5 font-sans text-[0.6875rem] font-semibold text-ink-subtle">
                  +{live} в грі
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-center gap-1 px-3 py-2 text-[0.6875rem] font-semibold text-ink-subtle shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {open ? "Згорнути" : `Усі ставки · ${bets.length}`}
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
          />
        </button>

        {open && (
          <div className="shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)_inset]">
            {bets.map((b) => {
              const done = !!b.settled_at;
              const win = done && (b.payout ?? 0) > 0;
              return (
                <div
                  key={b.question_id}
                  className="flex items-center gap-3 px-3.5 py-2 shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_6%,transparent)]"
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      !done ? "bg-accent" : win ? "bg-success" : "bg-ink-faint",
                    )}
                  />
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
                      !done ? "text-ink-muted" : win ? "text-success" : "text-ink-faint",
                    )}
                  >
                    {done && !win ? (
                      <span className="text-[0.6875rem] font-semibold">—</span>
                    ) : (
                      <>
                        {done ? "+" : ""}
                        {formatInt(done ? (b.payout ?? 0) : Math.floor(b.stake * b.odds))}
                        <BrandIcon name="points-ewc" className="size-3.5" />
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "up" | "down";
}) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[0.6875rem] leading-none text-ink-subtle">{label}</p>
      <p
        className={cn(
          "tnum mt-1.5 flex items-center gap-1 font-mono text-sm font-extrabold leading-none",
          tone === "up" ? "text-success" : tone === "down" ? "text-ink" : "text-ink",
        )}
      >
        {formatInt(value)}
        <BrandIcon name="points-ewc" className="size-3.5" />
      </p>
    </div>
  );
}
