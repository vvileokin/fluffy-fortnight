"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, Loader2, Plus, X } from "lucide-react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { refreshProfile } from "@/lib/supabase/use-profile";
import { useConvertLimit, invalidateConvertLimit } from "@/lib/convert-limit";
import { cn, formatInt } from "@/lib/utils";

/**
 * Any positive whole number of points. There is deliberately no floor: a
 * minimum only ever bites the players holding the least, which is precisely
 * who a small stake matters most to.
 */
const MIN_STAKE = 1;
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
  multiplier,
  onPlaced,
}: {
  questionId: string;
  optionId: string | undefined;
  odds: number | undefined;
  balance: number;
  locked: boolean;
  bet: Bet | null;
  /** Streak multiplier, applied to winnings exactly as it is to flat rewards. */
  multiplier: number;
  onPlaced: () => void;
}) {
  const [stake, setStake] = React.useState<number>(CHIPS[0]);
  const [custom, setCustom] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [swapping, setSwapping] = React.useState(false);

  // Only asked once the stake is out of reach, and shared across every slip on
  // the page — a match carries several and they would each ask separately.
  const short = stake > balance;
  const allowance = useConvertLimit(short);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionId }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!out.ok) {
      setError(out.error === "closed" ? "Прийом уже закрито" : "Не вдалося скасувати");
      return;
    }
    refreshProfile();
    onPlaced();
  }

  /* ---- already staked ---- */
  if (bet) {
    const settled = !!bet.settled_at;
    const won = settled && (bet.payout ?? 0) > 0;
    return (
      /* Two rows, near enough the picker's height that a placed card and an
         unplaced one sit level in a grid. One cramped line left the card half
         the height of its neighbour, which is what pushed the sponsor plates
         out of line with each other. It also gives the cancel its own full
         width instead of wedging it beside the figures. */
      <div className="mt-2 space-y-1.5">
        <div className="flex h-11 items-center justify-between gap-2 rounded-lg bg-black/30 px-3">
          {/* Both marks ember: the same currency going out and coming back,
              with the arrow and the coefficient saying which is which. */}
          <span className="tnum flex min-w-0 items-center gap-1 font-mono text-sm font-bold leading-none text-[rgb(255_154_64)]">
            <BrandIcon name="points-ewc" className="size-4" />
            {formatInt(bet.stake)}
            <span className="mx-1.5 text-white/45">× {bet.odds}</span>
            <ArrowRight className="mr-1.5 size-3.5 shrink-0 text-white/35" strokeWidth={3} />
            <BrandIcon name="points-ewc" className="size-4" />
            {formatInt(Math.floor(bet.stake * bet.odds * multiplier))}
          </span>
          {/* Once settled the outcome replaces the projection — what a slip is
              worth stops mattering the moment it is decided. */}
          {settled && (
            <span
              className={cn(
                "tnum flex shrink-0 items-center gap-1 font-mono text-sm font-extrabold",
                won ? "text-success" : "text-white/40",
              )}
            >
              {won ? (
                <>
                  <BrandIcon name="points-ewc" className="size-4" />+{formatInt(bet.payout ?? 0)}
                </>
              ) : (
                "не зіграла"
              )}
            </span>
          )}
        </div>

        {/* Cancelling is offered only while the question is open — after that
            the slip is live and taking it back would be a free look. */}
        {!settled && !locked && (
          <button
            onClick={cancel}
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] text-xs font-semibold text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <X className="size-3.5 shrink-0" strokeWidth={2.5} />
            )}
            Скасувати ставку
          </button>
        )}

        {error && (
          <p role="alert" className="text-center text-[0.6875rem] font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (locked) return null;

  const affordable = stake >= MIN_STAKE && stake <= balance;
  const valid = affordable && !!optionId && !!odds;

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
          min_stake: "Вкажи суму",
        }[out.error as string] ?? "Не вдалося",
      );
      return;
    }
    // The stake has left the balance in the database; the top bar and this
    // slip are both reading a figure fetched before that happened.
    refreshProfile();
    onPlaced();
  }

  /** Exactly the gold that covers the shortfall — only offered when it does. */
  function swapCost(a: { limit: number; rate: number }) {
    return Math.max(stake - balance, 0) * a.rate;
  }

  async function swap() {
    if (!allowance) return;
    setSwapping(true);
    setError(null);
    const res = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gold: swapCost(allowance) }),
    });
    const out = await res.json().catch(() => ({}));
    setSwapping(false);
    if (!out.ok) {
      setError("Не вдалося обміняти");
      return;
    }
    invalidateConvertLimit();
    refreshProfile();
  }

  return (
    <div className="mt-2 space-y-1.5">
      {/* Stake row. Presets while the row is closed; the whole row becomes the
          field once `+` opens it, rather than squeezing an input into a quarter
          of the width where the digits never had room. One row either way. */}
      {custom ? (
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setCustom(false);
              setStake(CHIPS[0]);
            }}
            aria-label="Назад до сум"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/60 transition-colors hover:bg-white/[0.12]"
          >
            <ChevronLeft className="size-4" />
          </button>
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={stake || ""}
            placeholder="EWC Points"
            aria-label="Своя сума"
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
              setStake(digits ? Number(digits) : 0);
            }}
            className={cn(
              // `leading-none` on both the value and the placeholder: an input
              // centres its text on the line box, so a placeholder inheriting a
              // different size *and* the default line-height sat a hair above
              // the digits it stands in for.
              "tnum h-9 min-w-0 flex-1 rounded-lg bg-white/[0.06] text-center font-mono text-sm font-bold leading-none text-white transition-colors",
              "placeholder:font-sans placeholder:text-sm placeholder:font-semibold placeholder:leading-none placeholder:text-white/40",
              // No ring. The global focus outline is a 2px offset ring built for
              // controls on flat surfaces; on a recessed pill inside a card it
              // reads as a stray highlight. The fill already brightens on focus,
              // which keeps the state visible without drawing a box round it.
              //
              // Forced. The global rule is `:where(…):focus-visible`, which is
              // zero-specificity and so should already lose to a utility — but
              // it kept winning in practice, and one element opting out of a
              // site-wide default is exactly what the important modifier is
              // for. Scoped to this input; every other control keeps its ring.
              "outline-none focus:bg-white/[0.12] focus-visible:outline-none! focus-visible:rounded-lg!",
            )}
          />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c}
              disabled={c > balance}
              onClick={() => setStake(c)}
              className={cn(
                "tnum h-9 rounded-lg font-mono text-xs font-bold transition-colors",
                stake === c
                  ? "bg-[rgb(198_96_40)] text-[#1a0a0d]"
                  : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]",
                c > balance && "cursor-not-allowed opacity-35 hover:bg-white/[0.06]",
              )}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => {
              setCustom(true);
              setStake(0);
            }}
            aria-label="Своя сума"
            className="grid h-9 place-items-center rounded-lg bg-white/[0.06] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* The action says what you put in and what comes back, and nothing else.
          A verb plus "поверне" plus two figures was a sentence on a button; the
          arrow carries the same meaning wordlessly, and the accessible name
          supplies the verb for anyone who needs it read aloud.

          The ember is well below the ring orange the card outlines itself with.
          At full strength this filled a third of the card with the brightest
          thing on the page and pulled the eye off the options, which are the
          actual decision. */}
      {/* Short of points, and able to do something about it.
          Shown only when the exchange would actually close the gap. Someone
          holding 20 gold against a 100-point shortfall is not helped by a
          button that leaves them short anyway, and a way out dangled in front
          of a player who has none is worse than saying nothing. It converts
          exactly what is missing, so the next tap is the bet itself. */}
      {short && allowance && allowance.limit >= (stake - balance) * allowance.rate && (
        <button
          onClick={swap}
          disabled={swapping}
          className="tnum flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-white/[0.08] font-mono text-xs font-bold text-white/80 transition-colors hover:bg-white/[0.14] disabled:opacity-50"
        >
          {swapping ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <>
              <BrandIcon name="points" className="size-4" />
              {formatInt(swapCost(allowance))}
              <span className="mx-1.5 font-normal text-white/40">÷ {allowance.rate}</span>
              <ArrowRight className="mr-1.5 size-3 shrink-0 text-white/35" strokeWidth={3} />
              <BrandIcon name="points-ewc" className="size-4" />
              {formatInt(swapCost(allowance) / allowance.rate)}
            </>
          )}
        </button>
      )}

      <button
        onClick={place}
        disabled={!valid || busy}
        aria-label="Зробити ставку"
        className={cn(
          "flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors",
          "bg-[rgb(198_96_40)] text-[#1a0a0d] hover:bg-[rgb(219_112_52)]",
          "disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/35",
        )}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : !optionId ? (
          // The prompt lives on the control it's about. As its own line under
          // the slip it was a permanent row of chrome explaining a button the
          // player can already see is dark.
          "Обери варіант"
        ) : (
          // Just the verb. The stake is on the row above and the coefficient is
          // on the option itself, so spelling the arithmetic out again on the
          // button restated two numbers the player had already chosen.
          "Підтвердити"
        )}
      </button>

      {/* Errors only. The balance line that used to live here was permanent
          chrome under a two-row slip, and the top bar already carries it. */}
      {error && (
        <p role="alert" className="text-center text-[0.6875rem] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
