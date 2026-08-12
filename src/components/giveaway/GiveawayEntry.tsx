"use client";

import * as React from "react";
import { Users, Check, ShieldCheck, Trophy, Loader2, Lock, LogIn } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Countdown } from "@/components/ui/Countdown";
import { Avatar } from "@/components/ui/Avatar";
import { useProfile } from "@/lib/supabase/use-profile";
import { createClient } from "@/lib/supabase/client";
import { formatInt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { type Giveaway } from "@/lib/data";

export function GiveawayEntry({ giveaway }: { giveaway: Giveaway }) {
  const router = useRouter();
  const { user, profile } = useProfile();
  const [entered, setEntered] = React.useState(!!giveaway.entered);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The server already resolved this for the initial render; re-sync when auth
  // settles on the client so a signed-in reader doesn't see the signed-out CTA.
  React.useEffect(() => {
    setEntered(!!giveaway.entered);
  }, [giveaway.entered]);

  const drawn = !!giveaway.drawnAt || giveaway.winners.length > 0;
  const closed = drawn || giveaway.status === "finished";
  const points = profile?.points ?? 0;
  const shortBy = Math.max(0, giveaway.minPoints - points);
  const eligible = shortBy === 0;
  const iWon = giveaway.winners.some((w) => w.userId === user?.id);

  async function enter() {
    if (!user) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await createClient()
      .from("giveaway_entries")
      .insert({ giveaway_slug: giveaway.slug, user_id: user.id });
    setBusy(false);

    if (err) {
      // The RLS policy is the real gate, so a rejection here means the row
      // genuinely failed the eligibility check — say which one rather than
      // printing a Postgres error at someone.
      setError(
        err.code === "23505"
          ? "Заявку вже подано."
          : !eligible
            ? `Не вистачає ${formatInt(shortBy)} поінтів.`
            : "Не вдалося подати заявку. Спробуй ще раз.",
      );
      return;
    }
    setEntered(true);
    router.refresh();
  }

  return (
    <div className="relative overflow-hidden rounded-xl surface-1 p-5">
      {/* Impeccable: Crafted Prize Well — a pool of the giveaway's own colour
          rising from the floor of the panel, so the entry card reads as part of
          the prize rather than a generic form beside it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
        style={{
          backgroundImage: `radial-gradient(80% 100% at 50% 130%, color-mix(in oklch, ${giveaway.cover} 22%, transparent), transparent 68%)`,
        }}
      />

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
            free-text deadline ("до 20 лип"), and rendering four boxes off a
            missing timestamp is worse than rendering none. */}
        {!closed && Number.isFinite(Date.parse(giveaway.endISO)) && (
          <div className="mt-3">
            <Countdown targetISO={giveaway.endISO} />
          </div>
        )}

        {/* ---- Result ---- */}
        {drawn ? (
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
        ) : entered ? (
          /* ---- Entered ---- */
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--success)_12%,transparent)] px-3.5 py-3 text-sm font-semibold text-success">
              <Check className="size-4 shrink-0" strokeWidth={3} />
              Ти в розіграші
            </div>
            <p className="text-xs leading-relaxed text-ink-subtle">
              Нічого більше робити не треба. Переможця оголосимо тут і надішлемо
              сповіщення.
            </p>
          </div>
        ) : !user ? (
          /* ---- Signed out ---- */
          <div className="mt-5">
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              <LogIn className="size-4" strokeWidth={2.5} />
              Увійти, щоб узяти участь
            </Link>
          </div>
        ) : (
          /* ---- Can enter (or is short on points) ---- */
          <div className="mt-5 space-y-2.5">
            <button
              onClick={enter}
              disabled={busy || !eligible || closed}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-accent"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Надсилаємо…
                </>
              ) : !eligible ? (
                <>
                  <Lock className="size-4" strokeWidth={2.5} />
                  Потрібно {formatInt(giveaway.minPoints)} поінтів
                </>
              ) : (
                "Взяти участь"
              )}
            </button>

            {!eligible && (
              <p className="text-center text-xs text-ink-muted">
                У тебе <span className="tnum font-bold text-ink">{formatInt(points)}</span>
                {" — не вистачає "}
                <span className="tnum font-bold text-warning">{formatInt(shortBy)}</span>.{" "}
                <Link href="/interactives" className="font-semibold text-info hover:underline">
                  Заробити поінти
                </Link>
              </p>
            )}

            {error && (
              <p role="alert" className="text-center text-xs font-semibold text-danger">
                {error}
              </p>
            )}
          </div>
        )}

        <p
          className={cn(
            "mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-subtle",
            drawn && "mt-5",
          )}
        >
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-info" />
          Переможець обирається випадково серед усіх заявок. Кожен розіграш
          фіксується в журналі аудиту.
        </p>
      </div>
    </div>
  );
}
