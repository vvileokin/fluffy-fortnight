"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; count?: number };

export function FilterTabs({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      aria-label="Фільтр"
      /* Impeccable: Crafted Segmented Control — the strip is a recessed
         channel; the live segment is lit from inside rather than merely
         filled, so the switch reads as a physical throw. */
      className={cn(
        "no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl bg-[color-mix(in_oklch,var(--bg)_70%,var(--surface))] p-1",
        "shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_7%,transparent),0_2px_5px_-2px_oklch(0_0_0/0.6)_inset]",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold",
              "transition-[background-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "active:translate-y-px motion-reduce:active:translate-y-0",
              size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm",
              active
                ? "seg-on bg-accent text-accent-ink"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {opt.label}
            {typeof opt.count === "number" && (
              <span
                className={cn(
                  "tnum rounded-full px-1.5 text-[0.6875rem] font-bold leading-tight",
                  active
                    ? "bg-[color-mix(in_oklch,var(--accent-ink)_16%,transparent)] text-accent-ink"
                    : "bg-surface-3 text-ink-subtle",
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
