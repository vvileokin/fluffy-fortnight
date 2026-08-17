"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { cn, formatInt } from "@/lib/utils";

const MIN_STAKE = 50;
/** Three shortcuts and a free field — the fourth slot is the player's own. */
const CHIPS = [100, 200, 300];

export type Bet = {
  option_id: string;
  stake: number;
  odds: number;
  payout: number | null;
  settled_at: string | null;
};

/**
 * Impeccable: Crafted Bet Slip — three taps wide, two rows tall.
 *
 * The first build wore a header, a balance line, four chips, a free field, a
 * note and its own sponsor badge — seven rows of chrome under a card whose
 * whole job was one tap. Every betting product worth copying does the opposite:
 * the stake row and the action are the slip, the balance is a footnote, and the
 * return is the only number given any size, because a coefficient means nothing
 * until it has been multiplied by *your* stake. So the return rides on the
 * button itself — the thing you are about to press already says what pressing
 * it gets you.
 */
export function BetSlip({
  questionId,
  optionId,
  odds,
  balance,
  locked,
  bet,
  onPlaced,
}: {
  questionId: string;
  optionId: string | undefined;
  odds: number | undefined;
  balance: number;
  locked: boolean;
  bet: Bet | null;
  onPlaced: () => void;
}) {
  const [stake, setStake] = React.useState<number>(CHIPS[0]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* ---- already staked: one line, no controls ---- */
  if (bet) {
    const settled = !!bet.settled_at;
    const won = settled && (bet.payout ?? 0) > 0;
    return (
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-black/30 px-2.5 py-2">
        <span className="tnum flex items-center gap-1.5 text-xs font-semibold text-white/70">
          <Check className="size-3.5 shrink-0 text-[rgb(255_154_64)]" strokeWidth={3} />
          {formatInt(bet.stake)} × {bet.odds}
        </span>
        <span
          className={cn(
            "tnum flex items-center gap-1 font-mono text-xs font-extrabold",
            settled ? (won ? "text-success" : "text-white/40") : "text-[rgb(255_154_64)]",
          )}
        >
          {settled && !won ? (
            "не зіграла"
          ) : (
            <>
              <BrandIcon name="points-ewc" className="size-4" />
              {settled ? `+${formatInt(bet.payout ?? 0)}` : formatInt(Math.floor(bet.stake * bet.odds))}
            </>
          )}
        </span>
      </div>
    );
  }

  if (locked) return null;

  const affordable = stake >= MIN_STAKE && stake <= balance;
  const valid = affordable && !!optionId && !!odds;
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
          insufficient: "Не вистачає поінтів",
          already_placed: "Ставку вже зроблено",
          closed: "Прийом закрито",
          min_stake: `Мінімум ${MIN_STAKE}`,
        }[out.error as string] ?? "Не вдалося",
      );
      return;
    }
    onPlaced();
  }

  return (
    <div className="mt-2 space-y-1.5">
      {/* Stake row: three presets and the player's own figure, four equal
          cells so the custom field reads as the fourth option rather than an
          afterthought bolted to the end. */}
      <div className="grid grid-cols-4 gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c}
            disabled={c > balance}
            onClick={() => setStake(c)}
            className={cn(
              "tnum h-9 rounded-lg font-mono text-xs font-bold transition-colors",
              stake === c
                ? "bg-[rgb(255_122_44)] text-[#1a0a0d]"
                : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]",
              c > balance && "cursor-not-allowed opacity-35 hover:bg-white/[0.06]",
            )}
          >
            {c}
          </button>
        ))}
        <input
          type="number"
          inputMode="numeric"
          min={MIN_STAKE}
          max={Math.max(MIN_STAKE, balance)}
          value={CHIPS.includes(stake) ? "" : stake || ""}
          placeholder="своя"
          aria-label="Своя сума"
          onChange={(e) => setStake(Math.floor(Number(e.target.value) || 0))}
          className={cn(
            "tnum h-9 w-full rounded-lg text-center font-mono text-xs font-bold outline-none transition-colors",
            "placeholder:font-sans placeholder:font-semibold placeholder:text-white/40",
            CHIPS.includes(stake)
              ? "bg-white/[0.06] text-white/70 focus:bg-white/[0.12]"
              : "bg-[rgb(255_122_44)] text-[#1a0a0d] placeholder:text-[#1a0a0d]/50",
          )}
        />
      </div>

      {/* The action carries the return, because that is the number the player
          is actually choosing between. */}
      <button
        onClick={place}
        disabled={!valid || busy}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors",
          "bg-[rgb(255_122_44)] text-[#1a0a0d] hover:bg-[rgb(255_146_72)]",
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[rgb(255_122_44)]",
        )}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            Поставити
            {valid && (
              <span className="tnum flex items-center gap-1 font-mono">
                · поверне
                <BrandIcon name="points-ewc" className="size-4" />
                {formatInt(ret)}
              </span>
            )}
          </>
        )}
      </button>

      <p className="tnum flex items-center justify-center gap-1 text-[0.6875rem] text-white/40">
        {error ? (
          <span role="alert" className="font-semibold text-danger">
            {error}
          </span>
        ) : !optionId ? (
          "Обери варіант вище"
        ) : (
          <>
            баланс
            <BrandIcon name="points-ewc" className="size-3.5" />
            {formatInt(balance)} · мін. {MIN_STAKE} · змінити не можна
          </>
        )}
      </p>
    </div>
  );
}
