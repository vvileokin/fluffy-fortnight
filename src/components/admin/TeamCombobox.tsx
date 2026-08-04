"use client";

import * as React from "react";
import { Search, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type CatalogTeam = {
  slug: string;
  name: string;
  tag: string;
  logo: string;
  brand: string;
};

/**
 * Searchable team picker. A native <select> was unusable here: the browser
 * draws its dropdown with the OS palette, so our light text landed on a white
 * popup and the options were invisible. This draws its own list, and typing
 * filters by name, tag or slug.
 */
export function TeamCombobox({
  teams,
  value,
  placeholder = "Обери команду",
  onChange,
}: {
  teams: CatalogTeam[];
  value: string;
  placeholder?: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const boxRef = React.useRef<HTMLDivElement>(null);

  const chosen = teams.find((t) => t.slug === value);

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
    ? teams.filter((t) =>
        [t.name, t.tag, t.slug].some((s) => s.toLowerCase().includes(needle)),
      )
    : teams;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQ("");
        }}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-3"
      >
        {chosen ? (
          <>
            <TeamMark team={chosen} />
            <span className="min-w-0 flex-1 truncate font-semibold">{chosen.name}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ink-subtle">{placeholder}</span>
        )}
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
              placeholder="Пошук команди…"
              className="h-9 w-full bg-transparent pl-8 pr-2.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
            />
          </div>
          <ul className="no-scrollbar max-h-60 overflow-y-auto py-1">
            {matches.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-ink-subtle">
                Нічого не знайшлося
              </li>
            )}
            {matches.map((t) => (
              <li key={t.slug}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(t.slug);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-2",
                    t.slug === value ? "text-ink" : "text-ink-muted",
                  )}
                >
                  <TeamMark team={t} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
                  <span className="shrink-0 text-[0.625rem] uppercase text-ink-faint">{t.tag}</span>
                  {t.slug === value && <Check className="size-3.5 shrink-0 text-accent" strokeWidth={3} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Small logo tile — external artwork as-is, catalog silhouettes recoloured. */
function TeamMark({ team }: { team: CatalogTeam }) {
  const external = /^https?:\/\//.test(team.logo);
  if (!team.logo) {
    return (
      <span
        className="grid size-5 shrink-0 place-items-center rounded text-[0.5625rem] font-bold"
        style={{ background: team.brand, color: "#fff" }}
      >
        {team.tag.slice(0, 2)}
      </span>
    );
  }
  return (
    <span
      className="grid size-5 shrink-0 place-items-center rounded"
      style={{ background: team.brand }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.logo}
        alt=""
        className="size-3.5 object-contain"
        style={external ? undefined : { filter: "brightness(0) invert(1)" }}
      />
    </span>
  );
}
