"use client";

import * as React from "react";
import { Check, X, Sparkles, HelpCircle, CheckCheck } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  question: string;
  match: string;
  suggested: string;
  auto: boolean; // suggested by stats vs needs manual
  reward: number;
  state: "pending" | "confirmed" | "rejected";
};

const initial: Item[] = [
  { id: "r1", question: "Переможець матчу", match: "NAVI vs GamerLegion", suggested: "Natus Vincere", auto: true, reward: 40, state: "pending" },
  { id: "r2", question: "Переможець 1 карти — Mirage", match: "NAVI vs GamerLegion", suggested: "Natus Vincere", auto: true, reward: 60, state: "pending" },
  { id: "r3", question: "b1t 20+ кілів", match: "NAVI vs GamerLegion", suggested: "Так, 20+", auto: true, reward: 80, state: "pending" },
  { id: "r4", question: "Точний рахунок серії", match: "Liquid vs Heroic", suggested: "—", auto: false, reward: 150, state: "pending" },
  { id: "r5", question: "Перший пістолетний раунд", match: "B8 vs SINNERS", suggested: "—", auto: false, reward: 100, state: "pending" },
];

export default function ResolvePage() {
  const [items, setItems] = React.useState(initial);

  const set = (id: string, state: Item["state"]) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, state } : it)));

  const confirmAllAuto = () =>
    setItems((prev) =>
      prev.map((it) =>
        it.auto && it.state === "pending" ? { ...it, state: "confirmed" } : it,
      ),
    );

  const pending = items.filter((it) => it.state === "pending").length;
  const autoPending = items.filter((it) => it.auto && it.state === "pending").length;

  return (
    <>
      <AdminHead
        title="Черга розрахунку"
        subtitle="Система пропонує результат за статистикою. Підтверджуй масово, спірні перевіряй окремо."
        action={
          <button
            onClick={confirmAllAuto}
            disabled={autoPending === 0}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-45"
          >
            <CheckCheck className="size-4" />
            Підтвердити авто ({autoPending})
          </button>
        }
      />

      <p className="mb-4 text-sm text-ink-muted">
        В черзі: <span className="font-semibold text-ink">{pending}</span> ·
        автоматичних: <span className="font-semibold text-ink">{autoPending}</span>
      </p>

      <Panel>
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg",
                  it.auto ? "bg-accent/12 text-accent" : "bg-warning/12 text-warning",
                )}
                title={it.auto ? "Запропоновано автоматично" : "Потребує перевірки"}
              >
                {it.auto ? <Sparkles className="size-4" /> : <HelpCircle className="size-4" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{it.question}</p>
                <p className="text-xs text-ink-subtle">{it.match}</p>
              </div>

              <div className="text-right">
                <p className="text-xs text-ink-subtle">Пропозиція</p>
                <p className="text-sm font-semibold text-ink">
                  {it.suggested === "—" ? (
                    <span className="text-ink-faint">немає</span>
                  ) : (
                    it.suggested
                  )}
                </p>
              </div>

              <span className="tnum w-14 text-right font-mono text-sm font-bold text-accent">
                +{it.reward}
              </span>

              {it.state === "pending" ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => set(it.id, "confirmed")}
                    aria-label="Підтвердити"
                    className="grid size-9 place-items-center rounded-lg bg-success/12 text-success transition-colors hover:bg-success/20"
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => set(it.id, "rejected")}
                    aria-label="Відхилити"
                    className="grid size-9 place-items-center rounded-lg bg-surface-2 text-ink-muted transition-colors hover:bg-danger/15 hover:text-danger"
                  >
                    <X className="size-4" strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <Badge tone={it.state === "confirmed" ? "success" : "danger"}>
                  {it.state === "confirmed" ? "Підтверджено" : "Відхилено"}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
