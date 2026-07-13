"use client";

import * as React from "react";
import { Check, X, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type HistoryItem = {
  id: string;
  title: string;
  result: "correct" | "wrong" | "pending";
  pts: number;
};

export function PredictionHistory({ items }: { items: HistoryItem[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const collapsible = items.length > 5;
  const shown = collapsible && !expanded ? items.slice(0, 5) : items;

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-ink-subtle">
        Тут зʼявляться твої прогнози та нараховані поінти.
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {shown.map((h) => (
          <div key={h.id} className="flex items-center gap-3 px-4 py-3">
            <ResultDot r={h.result} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
              {h.title}
            </span>
            <span
              className={cn(
                "tnum shrink-0 font-mono text-sm font-bold",
                h.result === "correct"
                  ? "text-accent"
                  : h.result === "pending"
                    ? "text-ink-subtle"
                    : "text-ink-faint",
              )}
            >
              {h.result === "wrong" ? "—" : `+${h.pts}`}
            </span>
          </div>
        ))}
      </div>

      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {expanded ? "Згорнути" : `Показати всі ${items.length}`}
          <ChevronDown
            className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")}
          />
        </button>
      )}
    </div>
  );
}

function ResultDot({ r }: { r: "correct" | "wrong" | "pending" }) {
  if (r === "correct")
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (r === "pending")
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
        <Clock className="size-3" />
      </span>
    );
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
      <X className="size-3" strokeWidth={3} />
    </span>
  );
}
