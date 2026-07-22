"use client";

import * as React from "react";
import { Swords, History } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageIntro } from "@/components/ui/PageIntro";
import { FilterTabs, type FilterOption } from "@/components/ui/FilterTabs";
import { MatchDayGroups } from "@/components/cards/MatchDayGroups";
import { type Match, type Tournament } from "@/lib/data";

/** "Результати" link — the full archive of finished matches. */
function ResultsLink() {
  return (
    <Link
      href="/results"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <History className="size-4" />
      <span className="hidden sm:inline">Результати</span>
    </Link>
  );
}

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
        <div className="flex items-center justify-between gap-3">
          <PageIntro icon={Swords} title="Матчі" />
          <ResultsLink />
        </div>
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
      <div className="flex items-center justify-between gap-3">
        <PageIntro icon={Swords} title="Матчі" />
        <ResultsLink />
      </div>

      <FilterTabs options={options} value={tour} onChange={setTour} />

      <MatchDayGroups matches={visible} />
    </div>
  );
}
