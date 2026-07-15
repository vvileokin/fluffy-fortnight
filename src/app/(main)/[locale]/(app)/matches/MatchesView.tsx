"use client";

import * as React from "react";
import { Swords } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { FilterTabs, type FilterOption } from "@/components/ui/FilterTabs";
import { MatchCard } from "@/components/cards/MatchCard";
import { LiveBadge } from "@/components/ui/Badge";
import { type Match, type Tournament } from "@/lib/data";

function dayBucket(m: Match): "live" | "today" | "tomorrow" | "later" | "done" {
  if (m.status === "live") return "live";
  if (m.status === "finished") return "done";
  if (m.timeLabel.startsWith("Сьогодні")) return "today";
  if (m.timeLabel.startsWith("Завтра")) return "tomorrow";
  return "later";
}

const groupLabels: Record<string, string> = {
  live: "Зараз у прямому ефірі",
  today: "Сьогодні",
  tomorrow: "Завтра",
  later: "Далі",
  done: "Завершені",
};
const order = ["live", "today", "tomorrow", "later", "done"] as const;

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

  const grouped = order
    .map((key) => ({
      key,
      label: groupLabels[key],
      items: visible.filter((m) => dayBucket(m) === key),
    }))
    .filter((g) => g.items.length > 0);

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

      <div className="space-y-8">
        {grouped.map((g) => (
          <section key={g.key} className="space-y-3">
            <div className="flex items-center gap-2.5">
              {g.key === "live" ? (
                <LiveBadge />
              ) : (
                <span className="size-1.5 rounded-full bg-ink-faint" />
              )}
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                {g.label}
              </h2>
              <span className="tnum text-xs font-semibold text-ink-subtle">
                {g.items.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
