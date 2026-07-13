import { RefreshCw, Lock, Database } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";

type Row = {
  type: string;
  name: string;
  externalId: string;
  status: "new" | "updated" | "override";
  when: string;
};

const rows: Row[] = [
  { type: "Турнір", name: "PGL Bucharest 2026", externalId: "ps_10421", status: "updated", when: "17:42" },
  { type: "Матч", name: "Natus Vincere vs GamerLegion", externalId: "ps_88231", status: "new", when: "17:42" },
  { type: "Команда", name: "B8", externalId: "ps_331", status: "override", when: "16:10" },
  { type: "Гравець", name: "b1t", externalId: "ps_9920", status: "updated", when: "17:41" },
  { type: "Матч", name: "BIG vs TYLOO", externalId: "ps_88240", status: "new", when: "17:40" },
  { type: "Турнір", name: "UA Masters 2026", externalId: "manual", status: "override", when: "вручну" },
];

const statusMeta = {
  new: { tone: "success" as const, label: "Нове" },
  updated: { tone: "info" as const, label: "Оновлено" },
  override: { tone: "warning" as const, label: "Ручна правка" },
};

export default function ImportPage() {
  return (
    <>
      <AdminHead
        title="Імпорт даних"
        subtitle="Черга з демо-провайдера. Ручні правки мають пріоритет над імпортом до явного зняття блокування."
        action={
          <button className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover">
            <RefreshCw className="size-4" />
            Синхронізувати
          </button>
        }
      />

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-3 font-semibold">Тип</th>
                <th className="px-4 py-3 font-semibold">Назва</th>
                <th className="px-4 py-3 font-semibold">External ID</th>
                <th className="px-4 py-3 font-semibold">Стан</th>
                <th className="px-4 py-3 text-right font-semibold">Час</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => {
                const m = statusMeta[r.status];
                return (
                  <tr key={i} className="transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-ink-muted">
                        <Database className="size-3.5 text-ink-subtle" />
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{r.name}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-muted">
                        {r.externalId}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={m.tone}>
                        {r.status === "override" && <Lock className="size-3" />}
                        {m.label}
                      </Badge>
                    </td>
                    <td className="tnum px-4 py-3 text-right font-mono text-xs text-ink-subtle">
                      {r.when}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
