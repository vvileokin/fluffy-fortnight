import { Target } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { QuestionCard } from "@/components/match/QuestionCard";
import {
  questionMaxReward,
  sortQuestionsByMatch,
  type Question,
  type Match,
} from "@/lib/data";

/** Predictions paying +40 or more are the "Full Buy" tier; the rest are "Eco". */
const FULL_BUY_FROM = 40;

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

  // Within each tier, the earliest match comes first.
  const ordered = sortQuestionsByMatch(active, matchById);
  const sections = [
    {
      key: "full-buy",
      title: "Full Buy",
      hint: `від +${FULL_BUY_FROM}`,
      items: ordered.filter((q) => questionMaxReward(q) >= FULL_BUY_FROM),
    },
    {
      key: "eco",
      title: "Eco",
      hint: `до +${FULL_BUY_FROM}`,
      items: ordered.filter((q) => questionMaxReward(q) < FULL_BUY_FROM),
    },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-6">
      <PageIntro icon={Target} title="Інтерактиви" />

      {sections.length > 0 ? (
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.key} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-ink-faint" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                  {s.title}
                </h2>
                <span className="text-xs font-semibold text-accent">{s.hint}</span>
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
