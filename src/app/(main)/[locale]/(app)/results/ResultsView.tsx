"use client";

import * as React from "react";
import { History } from "lucide-react";
import { SwordsGlyph } from "@/components/layout/NavGlyphs";
import { Link } from "@/i18n/navigation";
import { PageIntro } from "@/components/ui/PageIntro";
import { FilterTabs, type FilterOption } from "@/components/ui/FilterTabs";
import { MatchDayGroups } from "@/components/cards/MatchDayGroups";
import { type Match, type Tournament } from "@/lib/data";

export function ResultsView({
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
      .map((t) => ({ value: t.slug, label: t.name })),
  ];

  const visible = matches.filter(
    (m) => tour === "all" || m.tournamentSlug === tour,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <PageIntro icon={History} title="Результати" />
        <Link
          href="/matches"
          aria-label="Матчі"
          className="surface-1 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <SwordsGlyph className="size-4" />
          <span className="hidden sm:inline">Матчі</span>
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="grid place-items-center rounded-2xl well px-6 py-16 text-center">
          <History className="size-8 text-ink-faint" />
          <p className="mt-3 text-sm font-semibold text-ink">Ще немає зіграних матчів</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Щойно матчі завершаться — їхні результати зʼявляться тут.
          </p>
        </div>
      ) : (
        <>
          <FilterTabs options={options} value={tour} onChange={setTour} />
          <MatchDayGroups matches={visible} />
        </>
      )}
    </div>
  );
}
