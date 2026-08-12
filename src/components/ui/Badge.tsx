import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "accent"
  | "live"
  | "success"
  | "warning"
  | "info"
  | "tier1"
  | "tier2"
  | "danger";

// Backgrounds mix the tone with an opaque black so badges stay solid and
// legible even over cover photos (not translucent).
//
// They used to mix against `--bg`, which looked equivalent and wasn't: `--bg`
// carries chroma (0.022 at hue 246), so OKLCH interpolated the *hue* on every
// mix. The LIVE chip's background was computing to hue 282 — purple behind red
// text — and success to hue 226, blue behind green. Pure black is chroma 0, so
// its hue is powerless and the mix only darkens; every tone now keeps its own
// hue. Anything mixing a chromatic token with another chromatic token in oklch
// has this trap.
const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-muted border-border-strong",
  accent: "bg-[color-mix(in_oklch,var(--accent)_20%,oklch(0_0_0))] text-accent border-[color-mix(in_oklch,var(--accent)_42%,oklch(0_0_0))]",
  live: "bg-[color-mix(in_oklch,var(--live)_24%,oklch(0_0_0))] text-live border-[color-mix(in_oklch,var(--live)_50%,oklch(0_0_0))]",
  success: "bg-[color-mix(in_oklch,var(--success)_20%,oklch(0_0_0))] text-success border-[color-mix(in_oklch,var(--success)_44%,oklch(0_0_0))]",
  warning: "bg-[color-mix(in_oklch,var(--warning)_20%,oklch(0_0_0))] text-warning border-[color-mix(in_oklch,var(--warning)_44%,oklch(0_0_0))]",
  info: "bg-[color-mix(in_oklch,var(--info)_22%,oklch(0_0_0))] text-info border-[color-mix(in_oklch,var(--info)_46%,oklch(0_0_0))]",
  tier1: "bg-[color-mix(in_oklch,var(--tier1)_20%,oklch(0_0_0))] text-tier1 border-[color-mix(in_oklch,var(--tier1)_42%,oklch(0_0_0))]",
  tier2: "bg-surface-3 text-ink-subtle border-border-strong",
  danger: "bg-[color-mix(in_oklch,var(--danger)_20%,oklch(0_0_0))] text-danger border-[color-mix(in_oklch,var(--danger)_46%,oklch(0_0_0))]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        // Impeccable: Crafted Badge — a fixed 22px height on every tone, so a
        // row of statuses lines up whether or not one of them carries a dot.
        "inline-flex h-[1.375rem] shrink-0 items-center gap-1 rounded-md border px-2 text-[0.6875rem] font-bold uppercase tracking-wide leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <Badge tone="live" className={cn("gap-1.5", className)}>
      <span className="live-dot inline-block size-1.5 rounded-full bg-live" />
      LIVE
    </Badge>
  );
}

/** Points chip — always tabular, yellow signal for the value. */
export function Points({
  value,
  className,
  sign = false,
}: {
  value: number;
  className?: string;
  sign?: boolean;
}) {
  const prefix = sign && value > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "font-mono tnum font-semibold text-accent",
        className,
      )}
    >
      {prefix}
      {new Intl.NumberFormat("uk-UA").format(value)}
    </span>
  );
}
