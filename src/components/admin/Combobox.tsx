"use client";

import * as React from "react";
import { Search, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

/**
 * Searchable picker for plain options. Same reason as the team one: a native
 * <select> draws its dropdown with the OS palette, so light text on the popup's
 * white background left the options unreadable.
 */
export function Combobox({
  options,
  value,
  placeholder,
  emptyText = "Нічого не знайшлося",
  onChange,
}: {
  options: Option[];
  value: string;
  placeholder: string;
  emptyText?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const boxRef = React.useRef<HTMLDivElement>(null);

  const chosen = options.find((o) => o.value === value);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const matches = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 text-left text-sm transition-colors hover:bg-surface-3"
      >
        <span
          className={cn("min-w-0 flex-1 truncate", chosen ? "text-ink" : "text-ink-subtle")}
        >
          {chosen?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-ink-subtle transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border-strong bg-surface shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Пошук…"
              className="h-9 w-full bg-transparent pl-8 pr-2.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
            />
          </div>
          <ul className="no-scrollbar max-h-60 overflow-y-auto py-1">
            {matches.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-ink-subtle">{emptyText}</li>
            )}
            {matches.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-2",
                    o.value === value ? "text-ink" : "text-ink-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.label}</span>
                  {o.value === value && (
                    <Check className="size-3.5 shrink-0 text-accent" strokeWidth={3} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
