"use client";

import * as React from "react";
import {
  Calculator,
  Gift,
  Target,
  Users,
  Upload,
  LayoutTemplate,
  Swords,
  ScrollText,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { BlastMark } from "@/components/ui/BlastMark";

type Entry = {
  id: number;
  handle: string;
  role: "admin" | "editor" | null;
  area: string;
  action: string;
  created_at: string;
};

const areaIcon: Record<string, LucideIcon> = {
  matches: Swords,
  questions: Target,
  bounty: BlastMark as unknown as LucideIcon,
  resolve: Calculator,
  giveaways: Gift,
  content: LayoutTemplate,
  users: Users,
  upload: Upload,
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Сьогодні ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Вчора ${time}`;
  return `${d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" })} ${time}`;
}

export default function AuditPage() {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/audit")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setEntries(j.entries as Entry[]);
        else setError("Не вдалося завантажити журнал.");
      })
      .catch(() => setError("Не вдалося завантажити журнал."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AdminHead
        title="Журнал аудиту"
        subtitle="Запис дій, зроблених через панель: хто, що і коли. Пишеться автоматично, з панелі його не змінити."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      )}

      <Panel>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-ink-subtle">
            <Loader2 className="size-4 animate-spin" /> Завантаження…
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ScrollText className="mx-auto size-6 text-ink-faint" />
            <p className="mt-2 text-sm text-ink-subtle">
              Поки порожньо — тут з’являться дії, щойно хтось щось змінить.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => {
              const Icon = areaIcon[e.area] ?? ScrollText;
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-muted">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{e.action}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                      <span className="font-semibold text-ink-muted">{e.handle}</span>
                      {e.role && (
                        <span className={e.role === "admin" ? "text-danger" : "text-info"}>
                          {e.role === "admin" ? "адмін" : "редактор"}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-ink-faint">
                    {when(e.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
