"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { SponsorBadge } from "@/components/ui/BetkingMark";
import { cn, formatInt } from "@/lib/utils";

const MIN_STAKE = 50;
/** Shortcuts, not the only way in — the amount is still free text underneath. */
const CHIPS = [50, 100, 250, 500];

export type Bet = {
  option_id: string;
  stake: number;
  odds: number;
  payout: number | null;
  settled_at: string | null;
};

/**
 * Impeccable: Crafted Bet Slip — the stake, the coefficient, and what it
 * returns, in that order.
 *
 * The return is shown as a running total rather than left as arithmetic. A
 * coefficient is only meaningful once it has been multiplied by *your* stake,
 * and a player deciding between 2.10 and 3.40 is really deciding between two
 * payouts — so the payout is the number that moves as they type.
 */
export function BetSlip({
  questionId,
  optionId,
  optionLabel,
  odds,
  balance,
  locked,
  bet,
  onPlaced,
}: {
  questionId: string;
  optionId: string | undefined;
  optionLabel: string | undefined;
  odds: number | undefined;
  balance: number;
  locked: boolean;
  bet: Bet | null;
  onPlaced: () => void;
}) {
  const [stake, setStake] = React.useState(MIN_STAKE);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* ---- already staked ---- */
  if (bet) {
    const settled = !!bet.settled_at;
    const won = settled && (bet.payout ?? 0) > 0;
    return (
      <div className="mt-2 space-y-2 rounded-lg bg-black/30 p-2.5 shadow-[inset_0_0_0_1px_rgb(255_120_50/0.16)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
            <Check className="size-3.5 text-[rgb(255_154_64)]" strokeWidth={3} />
            Ставка {formatInt(bet.stake)} × {bet.odds}
          </span>
          <span
            className={cn(
              "tnum flex items-center gap-1 font-mono text-xs font-extrabold",
              settled
                ? won
                  ? "text-success"
                  : "text-ink-subtle"
                : "text-[rgb(255_154_64)]",
            )}
          >
            <BrandIcon name="points-ewc" className="size-4" />
            {settled
              ? won
                ? `+${formatInt(bet.payout ?? 0)}`
                : "не зіграла"
              : `${formatInt(Math.floor(bet.stake * bet.odds))} на кону`}
          </span>
        </div>
        <SponsorBadge />
      </div>
    );
  }

  if (locked) return null;

  const max = Math.max(MIN_STAKE, balance);
  const valid = stake >= MIN_STAKE && stake <= balance && !!optionId;
  const ret = odds ? Math.floor(stake * odds) : 0;

  async function place() {
    if (!optionId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionId, option: optionId, stake }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!out.ok) {
      setError(
        {
          insufficient: "Не вистачає EWC поінтів.",
          already_placed: "Ти вже поставив на це питання.",
          closed: "Прийом ставок закрито.",
          min_stake: `Мінімальна ставка — ${MIN_STAKE}.`,
        }[out.error as string] ?? "Не вдалося прийняти ставку.",
      );
      return;
    }
    onPlaced();
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-black/30 p-2.5 shadow-[inset_0_0_0_1px_rgb(255_120_50/0.16)]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-white/70">
          {optionId ? `Ставка на ${optionLabel}` : "Обери варіант вище"}
        </span>
        <span className="tnum shrink-0 text-[0.6875rem] text-white/45">
          баланс {formatInt(balance)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.filter((c) => c <= balance).map((c) => (
          <button
            key={c}
            onClick={() => setStake(c)}
            className={cn(
              "tnum h-8 rounded-md px-2.5 font-mono text-xs font-bold transition-colors",
              stake === c
                ? "bg-[rgb(255_122_44)] text-[#1a0a0d]"
                : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]",
            )}
          >
            {c}
          </button>
        ))}
        {balance >= MIN_STAKE && (
          <button
            onClick={() => setStake(balance)}
            className="h-8 rounded-md bg-white/[0.06] px-2.5 text-xs font-bold text-white/70 transition-colors hover:bg-white/[0.12]"
          >
            Усе
          </button>
        )}
        <input
          type="number"
          inputMode="numeric"
          min={MIN_STAKE}
          max={max}
          value={stake}
          onChange={(e) => setStake(Math.floor(Number(e.target.value) || 0))}
          aria-label="Сума ставки"
          className="tnum h-8 w-20 rounded-md bg-white/[0.06] px-2 font-mono text-xs font-bold text-white outline-none focus:bg-white/[0.12]"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={place}
          disabled={!valid || busy}
          className={cn(
            "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors",
            "bg-[rgb(255_122_44)] text-[#1a0a0d] hover:bg-[rgb(255_146_72)]",
            "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[rgb(255_122_44)]",
          )}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Поставити
          {odds && valid && (
            <span className="tnum font-mono">
              · {formatInt(ret)}
            </span>
          )}
        </button>
        <SponsorBadge className="shrink-0" />
      </div>
      <p className="text-[0.6875rem] text-white/40">
        Ставку не можна змінити. Мін. {MIN_STAKE} EWC.
      </p>
    </div>
  );
}
