"use client";

import * as React from "react";
import { Users, Check, Clock, ShieldCheck, Trophy, Loader2 } from "lucide-react";
import { Countdown } from "@/components/ui/Countdown";
import { formatInt } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { type Giveaway } from "@/lib/data";

type Stage = "idle" | "pending" | "confirmed";

const steps = [
  { key: "sent", label: "Заявку подано", icon: Check },
  { key: "review", label: "Перевірка адміністратором", icon: ShieldCheck },
  { key: "draw", label: "Розіграш переможця", icon: Trophy },
] as const;

export function GiveawayEntry({ giveaway }: { giveaway: Giveaway }) {
  const [stage, setStage] = React.useState<Stage>(
    giveaway.entered ? "pending" : "idle",
  );
  const finished = giveaway.status === "finished";

  const activeStep = stage === "idle" ? -1 : stage === "pending" ? 1 : 2;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Завершується
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Users className="size-3.5 text-ink-subtle" />
          <span className="tnum font-semibold">{formatInt(giveaway.entrants)}</span>
          учасників
        </span>
      </div>

      <div className="mt-3">
        <Countdown targetISO={giveaway.endISO} />
      </div>

      {/* Status / action */}
      {stage === "idle" ? (
        <button
          onClick={() => setStage("pending")}
          disabled={finished}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-45"
        >
          Взяти участь
        </button>
      ) : (
        <div className="mt-5 space-y-3">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-3 text-sm font-semibold",
              stage === "confirmed"
                ? "bg-success/12 text-success"
                : "bg-warning/12 text-warning",
            )}
          >
            {stage === "confirmed" ? (
              <Check className="size-4" strokeWidth={3} />
            ) : (
              <Loader2 className="size-4" />
            )}
            {stage === "confirmed"
              ? "Заявку підтверджено — ти в розіграші"
              : "Заявку подано — очікує перевірки"}
          </div>

          {/* Process stepper */}
          <ol className="space-y-2.5 pt-1">
            {steps.map((s, i) => {
              const done = i < activeStep;
              const current = i === activeStep;
              return (
                <li key={s.key} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border",
                      done
                        ? "border-success bg-success/15 text-success"
                        : current
                          ? "border-warning bg-warning/15 text-warning"
                          : "border-border bg-surface-2 text-ink-faint",
                    )}
                  >
                    {done ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : current ? (
                      <Clock className="size-3" />
                    ) : (
                      <s.icon className="size-3" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      done || current ? "font-semibold text-ink" : "text-ink-subtle",
                    )}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-subtle">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-info" />
        Переможець обирається лише серед підтверджених заявок. Кожен вибір
        фіксується в журналі аудиту.
      </p>
    </div>
  );
}
