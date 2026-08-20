"use client";

import * as React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useUser } from "@/lib/supabase/use-user";
import { refreshProfile } from "@/lib/supabase/use-profile";
import { cn, formatInt } from "@/lib/utils";

type Api = {
  signedIn: boolean;
  ready?: boolean;
  rate: number;
  limit: number;
};

/**
 * Impeccable: Crafted Exchange — season standing, spent on a seat at the event.
 *
 * The cap is the whole idea and so it is the first thing stated, not a refusal
 * discovered on submit. Gold that came out of the event cannot be turned back
 * into event currency — otherwise the two columns print each other — so only
 * what a player earned on ordinary matches is on offer here, and saying that
 * plainly is what stops the limit reading as an arbitrary cap.
 */
export function ConvertPoints() {
  const user = useUser();
  const [data, setData] = React.useState<Api | null>(null);
  const [gold, setGold] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<number | null>(null);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/convert", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setData(d);
        // Default to the whole allowance, rounded down to a whole EWC point.
        setGold(Math.floor((d.limit ?? 0) / (d.rate || 5)) * (d.rate || 5));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  // Nothing to offer, not ready, or signed out — the card simply isn't there.
  if (!data || !data.signedIn || data.ready === false || data.limit < data.rate) return null;

  const rate = data.rate || 5;
  const gain = Math.floor(gold / rate);
  const valid = gold >= rate && gold <= data.limit;

  async function convert() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gold }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!out.ok) {
      setError(
        out.error === "over_limit"
          ? `Доступно лише ${formatInt(out.limit ?? 0)}`
          : out.error === "bad_amount"
            ? `Сума має ділитись на ${rate}`
            : "Не вдалося обміняти",
      );
      return;
    }
    setDone(out.gained ?? gain);
    refreshProfile();
    setNonce((n) => n + 1);
    window.setTimeout(() => setDone(null), 3000);
  }

  return (
    <div className="ewc-aura-card space-y-2.5 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold tracking-tight text-white">Обмін поінтів</p>
        <span className="tnum shrink-0 text-xs font-bold text-white/45">{rate} : 1</span>
      </div>

      <p className="text-xs leading-relaxed text-white/55">
        Міняти можна тільки те золото, що зароблене поза EWC — доступно{" "}
        <span className="tnum font-bold text-white">{formatInt(data.limit)}</span>. Вигране
        на івенті вже враховане в золоті, тож назад воно не конвертується.
      </p>

      {done !== null ? (
        <p className="tnum flex items-center gap-1 text-sm font-bold text-success">
          Отримано +{formatInt(done)}
          <BrandIcon name="points-ewc" className="size-4" />
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={rate}
              max={Math.floor(data.limit / rate) * rate}
              step={rate}
              value={gold}
              onChange={(e) => setGold(Number(e.target.value))}
              aria-label="Скільки золотих обміняти"
              className="h-9 flex-1 accent-[rgb(198_96_40)]"
            />
            <span className="tnum flex shrink-0 items-center gap-1 font-mono text-sm font-bold text-white">
              <BrandIcon name="points" className="size-4" />
              {formatInt(gold)}
              <ArrowRight className="mx-0.5 size-3.5 text-white/35" strokeWidth={3} />
              <BrandIcon name="points-ewc" className="size-4" />
              {formatInt(gain)}
            </span>
          </div>

          <button
            onClick={convert}
            disabled={!valid || busy}
            className={cn(
              "flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors",
              "bg-[rgb(198_96_40)] text-[#1a0a0d] hover:bg-[rgb(219_112_52)]",
              "disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/35",
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Обміняти
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
