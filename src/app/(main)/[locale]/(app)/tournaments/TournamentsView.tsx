"use client";

import * as React from "react";
import { Trophy } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { FilterTabs, type FilterOption } from "@/components/ui/FilterTabs";
import { TournamentCard } from "@/components/cards/TournamentCard";
import { type Tournament } from "@/lib/data";

type Filter = "active" | "finished";

const isActive = (t: Tournament) => t.status === "live" || t.status === "upcoming";

export function TournamentsView({ tournaments }: { tournaments: Tournament[] }) {
  const [filter, setFilter] = React.useState<Filter>("active");

  const options: FilterOption[] = [
    { value: "active", label: "Актуальні", count: tournaments.filter(isActive).length },
    { value: "finished", label: "Завершені", count: tournaments.filter((t) => t.status === "finished").length },
  ];

  const filtered = tournaments.filter((t) =>
    filter === "active" ? isActive(t) : t.status === "finished",
  );

  return (
    <div className="space-y-6">
      <PageIntro icon={Trophy} title="Турніри" />

      <FilterTabs
        options={options}
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
      />

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TournamentCard key={t.slug} t={t} />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
          <Trophy className="size-8 text-ink-faint" />
          <p className="mt-3 text-sm font-semibold text-ink">Турнірів не знайдено</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Спробуй інший фільтр — усі активні події тут.
          </p>
        </div>
      )}
    </div>
  );
}
