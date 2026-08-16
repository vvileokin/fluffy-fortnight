"use client";

import * as React from "react";
import { X, Check, Loader2 } from "lucide-react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useUser } from "@/lib/supabase/use-user";
import { DAILY_REWARDS, dailyIcon } from "@/lib/daily";
import { formatInt, cn } from "@/lib/utils";

type Status = { nextDay: number; available: boolean; amount: number };

/**
 * Impeccable: Crafted Daily Ladder — ten days of returning, shown as a run.
 *
 * The whole point of a ladder is that you can see the rung above the one you're
 * on, so every day renders at once rather than only today's. Days already taken
 * recede, today is lit, and the rest sit plainly ahead — the shape of the run is
 * the argument for coming back tomorrow.
 *
 * It opens by itself, but only when there is something to take: a modal that
 * appears to tell you it has nothing for you is just a thing to close.
 */
export function DailyReward() {
  const user = useUser();
  const [status, setStatus] = React.useState<Status | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [claimed, setClaimed] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/daily", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setStatus({ nextDay: d.nextDay, available: d.available, amount: d.amount });
        if (d.available) setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function claim() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/daily", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!data.ok) {
      // A second tap from another tab lands here. It isn't a failure — the day
      // is genuinely taken — so the ladder just moves on rather than shouting.
      if (data.error === "already_claimed") {
        setStatus((s) => (s ? { ...s, available: false } : s));
        setClaimed(null);
        return;
      }
      setError("Не вдалося отримати нагороду. Спробуй ще раз.");
      return;
    }

    setClaimed(data.amount ?? 0);
    setStatus({ nextDay: data.day ?? 1, available: false, amount: data.amount ?? 0 });
  }

  if (!open || !status) return null;

  const current = status.nextDay;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Щоденна нагорода"
        className={cn(
          "relative w-full max-w-lg rounded-t-2xl surface-1 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5",
          "sm:rounded-2xl sm:p-6",
        )}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Закрити"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4.5" />
        </button>

        <h2 className="text-center text-lg font-extrabold tracking-tight text-ink">
          Щоденна нагорода
        </h2>
        <p className="mx-auto mt-1 max-w-[22rem] text-balance text-center text-xs leading-relaxed text-ink-subtle">
          Заходь щодня — нагорода росте. Пропустиш день, і драбина почнеться
          спочатку.
        </p>

        {/* Ten tiles: four across on a phone, five on anything wider, so the
            run reads as two even rows instead of a ragged tail. */}
        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-2.5">
          {DAILY_REWARDS.map((amount, i) => {
            const day = i + 1;
            const isTaken = day < current || (day === current && !status.available);
            const isToday = day === current && status.available;
            return (
              <div
                key={day}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-colors",
                  isToday
                    ? "bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_55%,transparent)]"
                    : "bg-fill-1 shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_6%,transparent)]",
                  isTaken && "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "text-[0.625rem] font-bold uppercase tracking-wide",
                    isToday ? "text-accent" : "text-ink-subtle",
                  )}
                >
                  {day} день
                </span>
                <span className="relative grid place-items-center">
                  <BrandIcon name={dailyIcon(day)} className="size-8" />
                  {isTaken && (
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45">
                      <Check className="size-4 text-success" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "tnum font-mono text-xs font-extrabold leading-none",
                    isToday ? "text-accent" : "text-ink-muted",
                  )}
                >
                  {formatInt(amount)}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-center text-xs font-semibold text-danger">
            {error}
          </p>
        )}

        <button
          onClick={status.available ? claim : () => setOpen(false)}
          disabled={busy}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Отримуємо…
            </>
          ) : claimed !== null ? (
            <>
              <Check className="size-4" strokeWidth={3} />
              Отримано +{formatInt(claimed)}
            </>
          ) : status.available ? (
            <>
              Отримати
              <span className="tnum flex items-center gap-1 font-mono">
                +{formatInt(status.amount)}
                <BrandIcon name="points" className="size-4" />
              </span>
            </>
          ) : (
            "Завтра буде більше"
          )}
        </button>
      </div>
    </div>
  );
}
