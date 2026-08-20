"use client";

import * as React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { refreshProfile } from "@/lib/supabase/use-profile";
import { invalidateConvertLimit } from "@/lib/convert-limit";
import { cn, formatInt } from "@/lib/utils";

/**
 * Impeccable: Crafted Exchange — opened from the currency it spends.
 *
 * It used to sit on the event's predictor tab, which was the wrong shelf: the
 * exchange spends *season* points, has nothing to do with the playoff, and a
 * player looking for it would have no reason to open a tournament. Hanging it
 * off the gold chip in the top bar puts it on the thing it acts upon — the
 * balance is the button.
 *
 * The amount is typed rather than dragged. A slider is for choosing roughly;
 * this is somebody deciding to spend a specific number of points they earned,
 * and the figure they have in mind deserves a field.
 */
export function ConvertModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [limit, setLimit] = React.useState<number | null>(null);
  const [rate, setRate] = React.useState(5);
  const [gold, setGold] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDone(null);
    setError(null);
    fetch("/api/convert", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setRate(d.rate ?? 5);
        setLimit(d.ready === false ? 0 : (d.limit ?? 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const amount = Number(gold || 0);
  const gain = Math.floor(amount / rate);
  const max = limit ?? 0;
  // Refused for a reason the player can act on, and only once they've typed
  // enough for the reason to be true.
  const problem =
    amount === 0
      ? null
      : amount > max
        ? `Доступно ${formatInt(max)}`
        : amount % rate !== 0
          ? `Сума має ділитись на ${rate}`
          : amount < rate
            ? `Мінімум ${rate}`
            : null;
  const valid = amount >= rate && amount <= max && amount % rate === 0;

  async function convert() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gold: amount }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!out.ok) {
      setError(out.error === "over_limit" ? `Доступно ${formatInt(out.limit ?? 0)}` : "Не вдалося обміняти");
      return;
    }
    setDone(out.gained ?? gain);
    setGold("");
    setLimit(out.limit ?? Math.max(max - amount, 0));
    invalidateConvertLimit();
    refreshProfile();
  }

  return (
    <Modal open={open} onClose={onClose} title="Обмін поінтів">
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-muted">
          {rate} поінтів сезону — 1 поінт EWC. Міняється лише те, що зароблене{" "}
          <span className="font-semibold text-ink">поза івентом</span>: вигране на EWC уже
          враховане в сезонних, тож назад не конвертується.
        </p>

        <div className="flex items-center justify-between rounded-lg surface-2 px-3 py-2.5">
          <span className="text-xs text-ink-subtle">Доступно до обміну</span>
          <span className="tnum flex items-center gap-1 font-mono text-sm font-extrabold text-accent">
            <BrandIcon name="points" className="size-4" />
            {limit === null ? "…" : formatInt(max)}
          </span>
        </div>

        {done !== null ? (
          <p className="tnum flex items-center justify-center gap-1 rounded-lg bg-success/10 px-3 py-3 text-sm font-bold text-success">
            Отримано +{formatInt(done)}
            <BrandIcon name="points-ewc" className="size-4" />
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={gold}
                placeholder="скільки золотих"
                aria-label="Скільки золотих обміняти"
                onChange={(e) => setGold(e.target.value.replace(/\D/g, "").slice(0, 7))}
                className="tnum h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 font-mono text-sm font-bold text-ink outline-none placeholder:font-sans placeholder:font-medium placeholder:text-ink-subtle focus:border-accent"
              />
              <button
                onClick={() => setGold(String(Math.floor(max / rate) * rate))}
                disabled={max < rate}
                className="h-11 shrink-0 rounded-lg border border-border px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                Усе
              </button>
            </div>

            {/* The same line a bet slip draws: what goes in, the rate between,
                what comes out. One shape for every exchange on the site means a
                player reads the second one without being taught it. */}
            {amount > 0 && (
              <p className="tnum flex h-11 items-center justify-center gap-1 rounded-lg surface-2 font-mono text-sm font-bold text-accent">
                <BrandIcon name="points" className="size-4" />
                {formatInt(amount)}
                <span className="mx-1.5 font-normal text-ink-subtle">÷ {rate}</span>
                <ArrowRight className="mr-1.5 size-3.5 shrink-0 text-ink-faint" strokeWidth={3} />
                <BrandIcon name="points-ewc" className="size-4" />
                {formatInt(gain)}
              </p>
            )}

            {(problem || error) && (
              <p role="alert" className="text-center text-xs font-semibold text-danger">
                {error ?? problem}
              </p>
            )}

            <button
              onClick={convert}
              disabled={!valid || busy}
              className={cn(
                "flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors",
                "bg-accent text-accent-ink hover:bg-accent-hover",
                "disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-faint",
              )}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Обміняти
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
