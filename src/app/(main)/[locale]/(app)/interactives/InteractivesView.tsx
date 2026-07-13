import { Target } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { QuestionCard } from "@/components/match/QuestionCard";
import { type Question } from "@/lib/data";

export function InteractivesView({ questions }: { questions: Question[] }) {
  // Show everything still answerable; resolved/locked ones drop off here but
  // remain visible (closed) on their match and tournament pages.
  const active = questions.filter(
    (q) => q.status === "open" || q.status === "upcoming",
  );

  return (
    <div className="space-y-6">
      <PageIntro icon={Target} title="Інтерактиви" />

      {active.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {active.map((q) => (
            <QuestionCard key={q.id} question={q} withMatch />
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
