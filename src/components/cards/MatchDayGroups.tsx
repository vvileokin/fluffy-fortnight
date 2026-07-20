import { MatchCard } from "@/components/cards/MatchCard";
import { LiveBadge } from "@/components/ui/Badge";
import { groupMatchesByDay, type Match } from "@/lib/data";

/** Matches split into day sections (live / today / tomorrow / dates / played). */
export function MatchDayGroups({ matches }: { matches: Match[] }) {
  const groups = groupMatchesByDay(matches);

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <div className="flex items-center gap-2.5">
            {g.live ? (
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
  );
}
