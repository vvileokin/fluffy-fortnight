"use client";

import * as React from "react";
import {
  Users,
  Check,
  Trophy,
  Loader2,
  Lock,
  LogIn,
  Send,
  Minus,
  Plus,
  CircleAlert,
  Ticket,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Countdown } from "@/components/ui/Countdown";
import { Avatar } from "@/components/ui/Avatar";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useProfile } from "@/lib/supabase/use-profile";
import { createClient } from "@/lib/supabase/client";
import { formatInt, cn } from "@/lib/utils";
import { type Giveaway } from "@/lib/data";

type SubState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "linked"; member: boolean }
  | { phase: "unlinked" }
  | { phase: "unknown" };

/** Server error codes → one sentence each. */
const REFUSAL: Record<string, string> = {
  telegram_required: "Спершу прив'яжи Telegram у профілі.",
  not_subscribed: "Схоже, підписки ще немає. Підпишись і спробуй ще раз.",
  check_failed: "Не вдалося перевірити підписку. Спробуй за хвилину.",
  max_tickets: "Це вже максимум квитків на один акаунт.",
  insufficient: "Не вистачає поінтів на цю кількість квитків.",
  drawn: "Розіграш уже завершено.",
  ended: "Час подачі заявок вийшов.",
  not_found: "Розіграш не знайдено.",
  unauthorized: "Потрібно увійти.",
};

export function GiveawayEntry({ giveaway }: { giveaway: Giveaway }) {
  const router = useRouter();
  const { user, profile } = useProfile();

  const ewc = giveaway.skin === "ewc";
  const paid = giveaway.entryCost > 0;
  const cap = Math.max(1, giveaway.maxTickets);

  // Optimistic ticket count. The authoritative number comes back with the
  // `router.refresh()` a purchase triggers; until then `max` lets the local
  // one lead, and once the refresh lands the two agree — so there is no prop-
  // to-state effect to keep in step and no double counting either way.
  const [bought, setBought] = React.useState(0);
  const tickets = Math.max(giveaway.myTickets, bought);

  const [qty, setQty] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sub, setSub] = React.useState<SubState>({ phase: "idle" });
  // The balance the purchase route reported back, which is authoritative.
  //
  // This used to be a running total of what had been spent, subtracted from
  // whatever the profile hook held. That double-counts the moment the hook
  // refetches — it re-reads on any auth change, so a session that bought two
  // tickets could end up subtracting 200 from an already-reduced balance and
  // render -125 for someone holding 75. Take the number the server just
  // returned instead of trying to compute it.
  const [paidBalance, setPaidBalance] = React.useState<number | null>(null);

  const drawn = !!giveaway.drawnAt || giveaway.winners.length > 0;
  const closed = drawn || giveaway.status === "finished";

  /** Read the gate. `nonce` is what a manual re-check bumps to re-run it. */
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    if (!user || closed || !giveaway.requireTelegram) return;
    let cancelled = false;
    fetch("/api/telegram/subscription", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.linked) return setSub({ phase: "unlinked" });
        if (!data.ok) return setSub({ phase: "unknown" });
        setSub({ phase: "linked", member: !!data.member });
      })
      .catch(() => {
        if (!cancelled) setSub({ phase: "unknown" });
      });
    return () => {
      cancelled = true;
    };
  }, [user, closed, giveaway.requireTelegram, nonce]);

  /** The "Перевірити" button — an event, so showing pending here is fine. */
  const recheck = React.useCallback(() => {
    setSub({ phase: "checking" });
    setNonce((n) => n + 1);
  }, []);

  // `undefined` is "still asking", `null` is "no profile". Worth separating:
  // treating the pending state as a zero balance flashes "Не вистачає 10" at
  // someone who has the points, for as long as the profile query takes.
  const loadingProfile = profile === undefined;
  const balance =
    paidBalance ??
    (giveaway.entryCurrency === "ewc"
      ? (profile?.ewc_points ?? 0)
      : (profile?.points ?? 0));

  const left = Math.max(0, cap - tickets);
  const shortSeason = Math.max(0, giveaway.minPoints - (profile?.points ?? 0));
  const iWon = giveaway.winners.some((w) => w.userId === user?.id);

  // Never offer to buy more than is affordable or allowed.
  const maxQty = Math.max(
    1,
    Math.min(left, paid ? Math.floor(balance / giveaway.entryCost) : left),
  );
  // Clamped on read rather than corrected in an effect: `maxQty` moves as the
  // balance and ticket count do, and chasing it with setState would re-render
  // the card once more for a number nobody saw the wrong version of.
  const safeQty = Math.min(Math.max(1, qty), maxQty);
  const cost = giveaway.entryCost * safeQty;
  const canAfford = balance >= cost;

  async function enter() {
    if (!user) return router.push("/login");
    setBusy(true);
    setError(null);

    // A free, ungated giveaway is still a straight insert through RLS — no
    // reason to route a no-op purchase through the server.
    if (!paid && !giveaway.requireTelegram) {
      const { error: err } = await createClient()
        .from("giveaway_entries")
        .insert({ giveaway_slug: giveaway.slug, user_id: user.id });
      setBusy(false);
      if (err) {
        setError(
          err.code === "23505"
            ? "Заявку вже подано."
            : shortSeason > 0
              ? `Не вистачає ${formatInt(shortSeason)} поінтів.`
              : "Не вдалося подати заявку. Спробуй ще раз.",
        );
        return;
      }
      setBought(1);
      router.refresh();
      return;
    }

    const res = await fetch("/api/giveaways/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: giveaway.slug, qty: safeQty }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok || !data.ok) {
      setError(REFUSAL[data.error] ?? "Не вдалося купити квиток. Спробуй ще раз.");
      // A refusal for either Telegram reason means our cached view of the gate
      // is stale — re-read it so the card stops offering a button that fails.
      if (data.error === "not_subscribed" || data.error === "telegram_required") {
        recheck();
      }
      return;
    }

    setBought(data.tickets ?? tickets + safeQty);
    if (typeof data.balance === "number") setPaidBalance(data.balance);
    setQty(1);
    router.refresh();
  }

  /* ---------------------------------------------------------------- render */

  const orange = ewc ? "text-[rgb(255_154_64)]" : "text-accent";
  const buyButton = cn(
    "flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-45",
    ewc
      ? "bg-[rgb(255_122_44)] text-[#1a0a0d] hover:bg-[rgb(255_146_72)] disabled:hover:bg-[rgb(255_122_44)]"
      : "bg-accent text-accent-ink hover:bg-accent-hover disabled:hover:bg-accent",
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-5",
        ewc ? "ewc-aura-card" : "surface-1",
      )}
    >
      {!ewc && (
        /* Impeccable: Crafted Prize Well — a pool of the giveaway's own colour
           rising from the floor of the panel, so the entry card reads as part
           of the prize rather than a generic form beside it. The EWC skin
           brings its own floor, so this only lights the standard card. */
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{
            backgroundImage: `radial-gradient(80% 100% at 50% 130%, color-mix(in oklch, ${giveaway.cover} 22%, transparent), transparent 68%)`,
          }}
        />
      )}

      <div className="relative">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {closed ? "Завершено" : "Завершується"}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Users className="size-3.5 text-ink-subtle" />
            <span className="tnum font-semibold">{formatInt(giveaway.entrants)}</span>
            учасників
          </span>
        </div>

        {/* No clock without a real end date. A giveaway can carry only the
            free-text deadline ("до 24 серпня"), and rendering four boxes off a
            missing timestamp is worse than rendering none. */}
        {!closed && Number.isFinite(Date.parse(giveaway.endISO)) && (
          <div className="mt-3">
            <Countdown targetISO={giveaway.endISO} tone={ewc ? "ewc" : "default"} />
          </div>
        )}

        {drawn ? (
          <Result giveaway={giveaway} iWon={iWon} />
        ) : (
          <div className="mt-5 space-y-3">
            {/* Tickets held, as pips. A number alone ("2/5") makes you do the
                subtraction to see how many are left; the row shows it. */}
            {cap > 1 && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                  <Ticket className="size-3.5 text-ink-subtle" />
                  Твої квитки
                </span>
                <span className="flex items-center gap-1">
                  {Array.from({ length: cap }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "size-2 rounded-full transition-colors",
                        i < tickets
                          ? ewc
                            ? "bg-[rgb(255_154_64)]"
                            : "bg-accent"
                          : "bg-[color-mix(in_oklch,var(--ink)_16%,transparent)]",
                      )}
                    />
                  ))}
                  <span className="tnum ml-1.5 font-mono text-xs font-bold text-ink">
                    {tickets}/{cap}
                  </span>
                </span>
              </div>
            )}

            {paid && (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-ink-subtle">Ціна квитка</span>
                <span className={cn("tnum flex items-center gap-1 font-mono font-bold", orange)}>
                  <BrandIcon
                    name={giveaway.entryCurrency === "ewc" ? "points-ewc" : "points"}
                    className="size-4"
                  />
                  {giveaway.entryCost}
                </span>
              </div>
            )}

            <Gate
              user={user}
              closed={closed}
              giveaway={giveaway}
              sub={sub}
              onRecheck={recheck}
              ewc={ewc}
            >
              {left === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--success)_12%,transparent)] px-3.5 py-3 text-sm font-semibold text-success">
                  <Check className="size-4 shrink-0" strokeWidth={3} />
                  {cap > 1 ? "Усі квитки викуплено" : "Ти в розіграші"}
                </div>
              ) : shortSeason > 0 ? (
                <button disabled className={buyButton}>
                  <Lock className="size-4" strokeWidth={2.5} />
                  Потрібно {formatInt(giveaway.minPoints)} поінтів
                </button>
              ) : (
                <div className="space-y-2.5">
                  {/* Stepper only when there is a choice to make. */}
                  {cap > 1 && left > 1 && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-fill-1 p-1 shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_6%,transparent)_inset]">
                      <StepButton
                        onClick={() => setQty(Math.max(1, safeQty - 1))}
                        disabled={safeQty <= 1 || busy}
                        label="Менше квитків"
                      >
                        <Minus className="size-4" strokeWidth={3} />
                      </StepButton>
                      <span className="tnum font-mono text-sm font-extrabold text-ink">
                        {safeQty}
                      </span>
                      <StepButton
                        onClick={() => setQty(Math.min(maxQty, safeQty + 1))}
                        disabled={safeQty >= maxQty || busy}
                        label="Більше квитків"
                      >
                        <Plus className="size-4" strokeWidth={3} />
                      </StepButton>
                    </div>
                  )}

                  <button
                    onClick={enter}
                    disabled={busy || loadingProfile || !canAfford || closed}
                    className={buyButton}
                  >
                    {busy || loadingProfile ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {busy ? "Купуємо…" : "Хвилинку…"}
                      </>
                    ) : !canAfford ? (
                      <>
                        <Lock className="size-4" strokeWidth={2.5} />
                        Не вистачає {formatInt(cost - balance)}
                      </>
                    ) : paid ? (
                      <>
                        Взяти участь
                        <span className="tnum flex items-center gap-1 font-mono">
                          · {cost}
                          <BrandIcon
                            name={giveaway.entryCurrency === "ewc" ? "points-ewc" : "points"}
                            className="size-4"
                          />
                        </span>
                      </>
                    ) : (
                      "Взяти участь"
                    )}
                  </button>

                  {paid && !loadingProfile && (
                    <p className="text-center text-xs text-ink-muted">
                      Баланс:{" "}
                      <span className={cn("tnum font-bold", orange)}>
                        {formatInt(balance)}
                      </span>
                      {giveaway.entryCurrency === "ewc" && " EWC поінтів"}
                    </p>
                  )}
                </div>
              )}
            </Gate>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 text-xs font-semibold text-danger"
              >
                <CircleAlert className="mt-px size-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

/**
 * Everything that must be true before the buy button is worth showing, in the
 * order a person hits them: sign in, link Telegram, subscribe. Each one gets
 * the action that clears it rather than a disabled button and an explanation.
 */
function Gate({
  user,
  closed,
  giveaway,
  sub,
  onRecheck,
  ewc,
  children,
}: {
  user: ReturnType<typeof useProfile>["user"];
  closed: boolean;
  giveaway: Giveaway;
  sub: SubState;
  onRecheck: () => void;
  ewc: boolean;
  children: React.ReactNode;
}) {
  if (closed) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors",
          ewc
            ? "bg-[rgb(255_122_44)] text-[#1a0a0d] hover:bg-[rgb(255_146_72)]"
            : "bg-accent text-accent-ink hover:bg-accent-hover",
        )}
      >
        <LogIn className="size-4" strokeWidth={2.5} />
        Увійти, щоб узяти участь
      </Link>
    );
  }

  if (giveaway.requireTelegram) {
    if (sub.phase === "checking" || sub.phase === "idle") {
      return (
        <div className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-fill-1 text-sm font-semibold text-ink-subtle">
          <Loader2 className="size-4 animate-spin" />
          Перевіряємо підписку…
        </div>
      );
    }

    if (sub.phase === "unlinked") {
      return (
        <Note
          tone="warn"
          text="Цей розіграш тільки для верифікованих через Telegram. Прив'яжи Telegram у профілі — це займе 10 секунд."
        >
          <Link
            href="/profile"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-info text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <Send className="size-4" strokeWidth={2.5} />
            Верифікуватись через Telegram
          </Link>
        </Note>
      );
    }

    if (sub.phase === "linked" && !sub.member) {
      return (
        <Note tone="warn" text="Умова участі — підписка на Telegram-канал CS2UA.">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-info text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Send className="size-4" strokeWidth={2.5} />
              Підписатись
            </a>
            <button
              onClick={onRecheck}
              className="flex h-11 items-center justify-center rounded-lg bg-fill-1 text-sm font-bold text-ink transition-colors hover:bg-surface-3"
            >
              Перевірити
            </button>
          </div>
        </Note>
      );
    }

    // "unknown" falls through to the buy button on purpose: we could not
    // reach Telegram, and blocking someone on our own outage would be the
    // wrong call. The enter route checks again and is the one that decides.
  }

  return (
    <>
      {sub.phase === "unknown" && (
        <p className="mb-2.5 flex items-start gap-2 text-xs leading-snug text-warning">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          Не вдалося перевірити підписку. Спробувати можна — перевіримо ще раз
          при купівлі.
        </p>
      )}
      {children}
    </>
  );
}

function Note({
  tone,
  text,
  children,
}: {
  tone: "warn";
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <p
        className={cn(
          "flex items-start gap-2 text-xs leading-relaxed",
          tone === "warn" && "text-ink-muted",
        )}
      >
        <Send className="mt-0.5 size-3.5 shrink-0 text-info" />
        {text}
      </p>
      {children}
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-md bg-surface-2 text-ink transition-colors hover:bg-surface-3 disabled:opacity-35 disabled:hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

function Result({ giveaway, iWon }: { giveaway: Giveaway; iWon: boolean }) {
  return (
    <div className="mt-4 space-y-3">
      {iWon && (
        <div className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] px-3.5 py-3 text-sm font-bold text-accent shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_30%,transparent)]">
          <Trophy className="size-4 shrink-0" strokeWidth={2.5} />
          Ти виграв! Ми зв&apos;яжемось із тобою.
        </div>
      )}
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          <Trophy className="size-3.5" />
          {giveaway.winners.length > 1 ? "Переможці" : "Переможець"}
        </p>
        <ul className="mt-2 space-y-1.5">
          {giveaway.winners.map((w) => (
            <li
              key={w.userId}
              className="flex items-center gap-2.5 rounded-lg bg-fill-1 px-2.5 py-2"
            >
              <span className="tnum w-4 shrink-0 font-mono text-xs font-bold text-tier1">
                {w.place}
              </span>
              <Avatar name={w.handle} src={w.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {w.handle}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
