"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function diff(target: number) {
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
  className,
}: {
  targetISO: string;
  variant?: "boxes" | "inline";
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

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      {units.map((u, i) => (
        <React.Fragment key={u.label}>
          <div className="flex min-w-[3.25rem] flex-col items-center rounded-lg border border-border bg-surface-2 px-2 py-2">
            <span
              className="font-mono tnum text-2xl font-bold leading-none text-ink sm:text-3xl"
              suppressHydrationWarning
            >
              {mounted ? pad(u.value) : "--"}
            </span>
            <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-wide text-ink-subtle">
              {u.label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span className="self-center font-mono text-xl text-ink-faint">
              :
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
