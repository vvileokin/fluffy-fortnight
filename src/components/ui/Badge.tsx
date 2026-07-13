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

// Backgrounds mix the tone with the opaque --bg so badges stay solid and
// legible even over cover photos (not translucent).
const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-muted border-border-strong",
  accent: "bg-[color-mix(in_oklch,var(--accent)_22%,var(--bg))] text-accent border-[color-mix(in_oklch,var(--accent)_45%,var(--bg))]",
  live: "bg-[color-mix(in_oklch,var(--live)_26%,var(--bg))] text-live border-[color-mix(in_oklch,var(--live)_52%,var(--bg))]",
  success: "bg-[color-mix(in_oklch,var(--success)_22%,var(--bg))] text-success border-[color-mix(in_oklch,var(--success)_46%,var(--bg))]",
  warning: "bg-[color-mix(in_oklch,var(--warning)_22%,var(--bg))] text-warning border-[color-mix(in_oklch,var(--warning)_46%,var(--bg))]",
  info: "bg-[color-mix(in_oklch,var(--info)_24%,var(--bg))] text-info border-[color-mix(in_oklch,var(--info)_48%,var(--bg))]",
  tier1: "bg-[color-mix(in_oklch,var(--tier1)_22%,var(--bg))] text-tier1 border-[color-mix(in_oklch,var(--tier1)_44%,var(--bg))]",
  tier2: "bg-surface-3 text-ink-subtle border-border-strong",
  danger: "bg-[color-mix(in_oklch,var(--danger)_22%,var(--bg))] text-danger border-[color-mix(in_oklch,var(--danger)_48%,var(--bg))]",
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide leading-none",
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
