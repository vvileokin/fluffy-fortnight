"use client";

import * as React from "react";
import { Swords } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { FilterTabs, type FilterOption } from "@/components/ui/FilterTabs";
import { MatchDayGroups } from "@/components/cards/MatchDayGroups";
import { type Match, type Tournament } from "@/lib/data";

export function MatchesView({
  matches,
  tournaments,
}: {
  matches: Match[];
  tournaments: Tournament[];
}) {
  const [tour, setTour] = React.useState<string>("all");

  const options: FilterOption[] = [
    { value: "all", label: "Усі турніри" },
    ...tournaments
      .filter((t) => matches.some((m) => m.tournamentSlug === t.slug))
      .map((t) => ({ value: t.slug, label: t.shortName })),
  ];

  const visible = matches.filter(
    (m) => tour === "all" || m.tournamentSlug === tour,
  );

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <PageIntro icon={Swords} title="Матчі" />
        <div className="grid place-items-center rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
          <Swords className="size-8 text-ink-faint" />
          <p className="mt-3 text-sm font-semibold text-ink">Наразі матчів немає</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Щойно з’являться найближчі матчі — вони будуть тут.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro icon={Swords} title="Матчі" />

      <FilterTabs options={options} value={tour} onChange={setTour} />

      <MatchDayGroups matches={visible} />
    </div>
  );
}
