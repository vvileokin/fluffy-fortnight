"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Small hover/focus hint in the site's own styling.
 *
 * The bubble is `fixed` and positioned from the trigger's rect on open: several
 * of the places that need a hint (the leaderboard rows) live inside an
 * `overflow-hidden` container, which would clip an absolutely-positioned one.
 * Coordinates are clamped so a long hint can't run off either edge.
 */
export function Tooltip({
  label,
  children,
  className,
  as: Tag = "span",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  as?: "span" | "div";
}) {
  const ref = React.useRef<HTMLElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

  const show = React.useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const half = 130; // half of max-w-[16rem], for edge clamping
    const left = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
    setPos({ left, top: r.top - 8 });
  }, []);
  const hide = React.useCallback(() => setPos(null), []);

  // A scroll would leave the bubble behind, so just close it.
  React.useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos, hide]);

  return (
    <Tag
      ref={ref as React.Ref<HTMLSpanElement & HTMLDivElement>}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos && (
        <span
          role="tooltip"
          style={{ left: pos.left, top: pos.top }}
          className={cn(
            "pointer-events-none fixed z-50 max-w-[16rem] -translate-x-1/2 -translate-y-full",
            "rounded-lg border border-border bg-surface-2 px-2.5 py-1.5",
            "text-left text-[0.6875rem] font-medium leading-snug text-ink-muted",
            "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)]",
          )}
        >
          {label}
        </span>
      )}
    </Tag>
  );
}
