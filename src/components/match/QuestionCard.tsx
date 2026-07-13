"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { Clock, Check, Lock, CircleHelp, Trophy } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getMatch, getTeam, type Question } from "@/lib/data";
import { cn } from "@/lib/utils";

export function QuestionCard({
  question,
  withMatch = false,
}: {
  question: Question;
  withMatch?: boolean;
}) {
  const [picked, setPicked] = React.useState<string | undefined>(
    question.answered,
  );
  const [justSaved, setJustSaved] = React.useState(false);

  const locked = question.status === "locked" || question.status === "resolved";
  const upcoming = question.status === "upcoming";
  const match = withMatch ? getMatch(question.matchId) : undefined;

  function choose(id: string) {
    if (locked || upcoming) return;
    setPicked(id);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1600);
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      {match && (
        <Link
          href={`/matches/${match.id}`}
          className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-ink-muted transition-colors hover:text-ink"
        >
          <TeamLogo team={getTeam(match.a)} size="xs" />
          <span className="font-semibold">{getTeam(match.a).tag}</span>
          <span className="text-ink-faint">vs</span>
          <span className="font-semibold">{getTeam(match.b).tag}</span>
          <TeamLogo team={getTeam(match.b)} size="xs" />
          <span className="ml-auto truncate text-ink-subtle">{match.stage}</span>
        </Link>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-accent">
            <QuestionIcon kind={question.kind} />
          </span>
          <h3 className="text-sm font-bold leading-snug text-ink text-balance">
            {question.title}
          </h3>
        </div>

        {/* Options */}
        <div
          className={cn(
            "mt-3.5 grid gap-2",
            question.options.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {question.options.map((opt) => {
            const selected = picked === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => choose(opt.id)}
                disabled={locked || upcoming}
                aria-pressed={selected}
                className={cn(
                  "group/opt relative flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "disabled:cursor-not-allowed",
                  selected
                    ? "border-accent bg-[color-mix(in_oklch,var(--accent)_12%,transparent)]"
                    : "border-border bg-surface-2 hover:border-border-strong enabled:hover:bg-surface-3",
                  (locked || upcoming) && !selected && "opacity-60",
                )}
              >
                {/* label + sublabel on one line, flush left */}
                <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                  <span
                    className={cn(
                      "truncate text-sm font-semibold",
                      selected ? "text-ink" : "text-ink-muted group-hover/opt:text-ink",
                    )}
                  >
                    {opt.label}
                  </span>
                  {opt.sublabel && (
                    <span className="shrink-0 text-[0.6875rem] text-ink-subtle">
                      {opt.sublabel}
                    </span>
                  )}
                </span>
                {/* reserved selection slot on the right keeps rewards aligned */}
                <span className="grid size-4 shrink-0 place-items-center">
                  {selected && (
                    <span className="grid size-4 place-items-center rounded-full bg-accent text-accent-ink">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="tnum w-11 shrink-0 text-right font-mono text-xs font-bold text-accent">
                  +{opt.reward}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span
            className={cn(
              "flex items-center gap-1.5 font-medium",
              upcoming ? "text-info" : locked ? "text-ink-subtle" : "text-ink-muted",
            )}
          >
            {locked ? (
              <>
                <Lock className="size-3.5" /> Прийом закрито
              </>
            ) : (
              <>
                <Clock className="size-3.5" /> Дедлайн: {question.deadlineLabel}
              </>
            )}
          </span>

          {justSaved ? (
            <span className="flex items-center gap-1 font-semibold text-success">
              <Check className="size-3.5" strokeWidth={3} /> Збережено
            </span>
          ) : picked && question.result === "pending" ? (
            <span className="text-ink-subtle">Очікує результат</span>
          ) : picked ? (
            <span className="text-ink-subtle">Можна змінити до дедлайну</span>
          ) : upcoming ? (
            <span className="text-ink-subtle">Відкриється перед матчем</span>
          ) : (
            <span className="text-ink-subtle">Обери варіант</span>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionIcon({ kind }: { kind: Question["kind"] }) {
  const cls = "size-3.5";
  if (kind === "player_stat") return <Trophy className={cls} />;
  if (kind === "custom") return <CircleHelp className={cls} />;
  return <Trophy className={cls} />;
}
