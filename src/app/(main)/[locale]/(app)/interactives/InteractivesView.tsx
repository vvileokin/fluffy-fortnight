import { Target } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { QuestionCard } from "@/components/match/QuestionCard";
import { LiveBadge } from "@/components/ui/Badge";
import { groupQuestionsByDay, type Question, type Match } from "@/lib/data";

export function InteractivesView({
  questions,
  matches = [],
}: {
  questions: Question[];
  matches?: Match[];
}) {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  // Only what's still answerable; resolved/locked ones stay on their match page.
  const active = questions.filter(
    (q) => q.status === "open" || q.status === "upcoming",
  );

  // Same day sections as the match list, so both pages read the same way.
  const sections = groupQuestionsByDay(active, matchById);

  return (
    <div className="space-y-6">
      <PageIntro icon={Target} title="Інтерактиви" />

      {sections.length > 0 ? (
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.key} className="space-y-3">
              <div className="flex items-center gap-2.5">
                {s.live ? (
                  <LiveBadge />
                ) : (
                  <span className="size-1.5 rounded-full bg-ink-faint" />
                )}
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                  {s.label}
                </h2>
                <span className="tnum text-xs font-semibold text-ink-subtle">
                  {s.items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {s.items.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    withMatch
                    match={matchById.get(q.matchId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
          <Target className="size-8 text-ink-faint" />
          <p className="mt-3 text-sm font-semibold text-ink">Тут поки порожньо</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Нові прогнози з’являться перед найближчими матчами.
          </p>
        </div>
      )}
    </div>
  );
}
