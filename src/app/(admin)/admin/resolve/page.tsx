"use client";

import * as React from "react";
import { Check, CircleCheck, Loader2 } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { questions, getMatch, getTeam } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function ResolveAdmin() {
  const [resolved, setResolved] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await createClient()
      .from("question_results")
      .select("question_id, correct_option_id");
    if (data) {
      setResolved(Object.fromEntries(data.map((r) => [r.question_id, r.correct_option_id])));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function resolve(questionId: string, optionId: string) {
    setBusy(questionId);
    const res = await fetch("/api/admin/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question_id: questionId, correct_option_id: optionId }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      setResolved((r) => ({ ...r, [questionId]: optionId }));
      if (typeof j.awarded === "number" && !j.alreadyResolved) {
        alert(`Розраховано. Нараховано ${j.awarded} гравцям по +${j.reward}.`);
      }
    } else {
      alert(j.error || "Помилка розрахунку");
    }
  }

  return (
    <>
      <AdminHead
        title="Розрахунок"
        subtitle="Обери переможний варіант — поінти автоматично нарахуються всім, хто його вгадав. Повторний розрахунок неможливий."
      />

      <div className="space-y-3">
        {questions.map((q) => {
          const m = getMatch(q.matchId);
          const winner = resolved[q.id];
          const isBusy = busy === q.id;
          return (
            <Panel key={q.id}>
              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink">{q.title}</p>
                    {m && (
                      <p className="text-xs text-ink-subtle">
                        {getTeam(m.a).tag} vs {getTeam(m.b).tag} · {q.deadlineLabel}
                      </p>
                    )}
                  </div>
                  {winner ? (
                    <Badge tone="success">
                      <CircleCheck className="size-3" /> Розраховано
                    </Badge>
                  ) : (
                    <Badge tone="warning">Очікує</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => {
                    const won = winner === o.id;
                    return (
                      <button
                        key={o.id}
                        disabled={!!winner || isBusy}
                        onClick={() => resolve(q.id, o.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
                          won
                            ? "border-success/50 bg-success/15 text-success"
                            : winner
                              ? "border-border bg-surface text-ink-faint opacity-60"
                              : "border-border-strong bg-surface-2 text-ink hover:bg-surface-3",
                        )}
                      >
                        {won && <Check className="size-4" strokeWidth={3} />}
                        {isBusy && !winner && <Loader2 className="size-3.5 animate-spin" />}
                        {o.label}
                        <span className="tnum font-mono text-xs text-accent">+{o.reward}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
