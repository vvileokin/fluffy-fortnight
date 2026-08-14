"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function diff(target: number) {
  // An absent or unparseable date gives NaN, and NaN survives Math.max, the
  // divisions and padStart all the way to the screen as "NaN ДНІ : NaN ГОД".
  // Treat it as an expired clock; callers that know better hide the whole block.
  if (!Number.isFinite(target)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const ms = Math.max(0, target - Date.now());
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: ms === 0,
  };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

type Unit = { value: number; label: string };

/**
 * Server-safe countdown: renders a stable placeholder on the server and first
 * client paint, then ticks after mount to avoid hydration mismatch.
 */
export function Countdown({
  targetISO,
  variant = "boxes",
  tone = "default",
  className,
}: {
  targetISO: string;
  variant?: "boxes" | "inline";
  /** `ewc` burns the digits and their wells ember, for event surfaces. */
  tone?: "default" | "ewc";
  className?: string;
}) {
  const target = React.useMemo(() => new Date(targetISO).getTime(), [targetISO]);
  const [mounted, setMounted] = React.useState(false);
  const [t, setT] = React.useState(() => diff(target));

  React.useEffect(() => {
    setMounted(true);
    setT(diff(target));
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const units: Unit[] = [
    { value: t.days, label: "дні" },
    { value: t.hours, label: "год" },
    { value: t.minutes, label: "хв" },
    { value: t.seconds, label: "сек" },
  ];

  if (variant === "inline") {
    return (
      <span
        className={cn("font-mono tnum font-semibold tabular-nums", className)}
        suppressHydrationWarning
      >
        {mounted
          ? `${t.days}д ${pad(t.hours)}:${pad(t.minutes)}:${pad(t.seconds)}`
          : "—д —:—:—"}
      </span>
    );
  }

  const ewc = tone === "ewc";

  return (
    /* Centred, not left-aligned: the four wells have a fixed minimum width, so
       in any container wider than they need — a phone card especially — the
       clock used to hug the left edge with a hole beside it. */
    <div className={cn("flex items-stretch justify-center gap-2", className)}>
      {units.map((u, i) => (
        <React.Fragment key={u.label}>
          {/* On the event the wells are cut into the ember floor rather than
              raised out of the season's grey — a neutral panel here read as a
              widget borrowed from another page. */}
          <div
            className={cn(
              "flex min-w-[3.25rem] flex-col items-center rounded-lg border px-2 py-2",
              ewc
                ? "border-[rgb(var(--ewc-ring)/0.28)] bg-black/35"
                : "border-border bg-surface-2",
            )}
          >
            <span
              className={cn(
                "font-mono tnum text-2xl font-bold leading-none sm:text-3xl",
                ewc ? "text-[rgb(255_154_64)]" : "text-ink",
              )}
              suppressHydrationWarning
            >
              {mounted ? pad(u.value) : "--"}
            </span>
            <span
              className={cn(
                "mt-1 text-[0.625rem] font-medium uppercase tracking-wide",
                ewc ? "text-[rgb(255_154_64)]/55" : "text-ink-subtle",
              )}
            >
              {u.label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span
              className={cn(
                "self-center font-mono text-xl",
                ewc ? "text-[rgb(var(--ewc-ring)/0.5)]" : "text-ink-faint",
              )}
            >
              :
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
