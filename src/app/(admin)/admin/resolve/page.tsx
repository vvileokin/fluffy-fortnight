"use client";

import * as React from "react";
import { Check, CircleCheck, Loader2 } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { getTeam } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Opt = { id: string; label: string; reward: number };
type QRow = { id: string; match_id: string; title: string; deadline_label: string | null; options: Opt[] };
type MatchLite = { id: string; team_a: string; team_b: string; team_a_name: string | null; team_b_name: string | null };

function teamTag(slug: string, name: string | null): string {
  return name ? name.slice(0, 4).toUpperCase() : getTeam(slug).tag;
}

export default function ResolveAdmin() {
  const [questions, setQuestions] = React.useState<QRow[]>([]);
  const [matches, setMatches] = React.useState<MatchLite[]>([]);
  const [resolved, setResolved] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const sb = createClient();
    const [{ data: qs }, { data: ms }, { data: res }] = await Promise.all([
      sb.from("questions").select("id, match_id, title, deadline_label, options").order("created_at", { ascending: false }),
      sb.from("matches").select("id, team_a, team_b, team_a_name, team_b_name"),
      sb.from("question_results").select("question_id, correct_option_id"),
    ]);
    setQuestions((qs as QRow[]) ?? []);
    setMatches((ms as MatchLite[]) ?? []);
    if (res) setResolved(Object.fromEntries(res.map((r) => [r.question_id, r.correct_option_id])));
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const matchLabel = (id: string) => {
    const m = matches.find((x) => x.id === id);
    return m ? `${teamTag(m.team_a, m.team_a_name)} vs ${teamTag(m.team_b, m.team_b_name)}` : "";
  };

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
          const winner = resolved[q.id];
          const isBusy = busy === q.id;
          return (
            <Panel key={q.id}>
              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink">{q.title}</p>
                    <p className="text-xs text-ink-subtle">
                      {matchLabel(q.match_id)}
                      {q.deadline_label ? ` · ${q.deadline_label}` : ""}
                    </p>
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
        {questions.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-ink-subtle">
            Питань для розрахунку немає. Створи їх у розділі «Питання».
          </div>
        )}
      </div>
    </>
  );
}
