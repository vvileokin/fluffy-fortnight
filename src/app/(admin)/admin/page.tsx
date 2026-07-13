import Link from "next/link";
import {
  Users,
  Trophy,
  Target,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { AdminHead, StatTile, Panel } from "@/components/admin/ui";
import { tournaments, questions } from "@/lib/data";

const auditRecent = [
  { who: "admin", action: "Підтвердив 12 результатів у розрахунку", time: "5 хв тому" },
  { who: "editor_kyiv", action: "Оновив нагороду питання «Переможець карти»", time: "26 хв тому" },
  { who: "admin", action: "Обрав переможця розіграшу AWP | Dragon Lore", time: "1 год тому" },
  { who: "editor_kyiv", action: "Додав турнір UA Masters 2026", time: "3 год тому" },
];

export default function AdminDashboard() {
  const activeTours = tournaments.filter((t) => t.status !== "finished").length;
  const openQ = questions.filter((q) => q.status === "open").length;

  return (
    <>
      <AdminHead
        title="Огляд"
        subtitle="Стан платформи та останні дії. Час синхронізації видно лише персоналу."
      />

      {/* Provider sync status */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-success/12 text-success">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">
              Постачальник даних: демо-провайдер
            </p>
            <p className="text-xs text-ink-subtle">
              Остання синхронізація: сьогодні, 17:42 · наступна за ~8 хв
            </p>
          </div>
        </div>
        <button className="h-10 rounded-lg border border-border-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-2">
          Синхронізувати зараз
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Користувачів" value="12 480" />
        <StatTile icon={Trophy} label="Активних турнірів" value={String(activeTours)} tone="accent" />
        <StatTile icon={Target} label="Відкритих питань" value={String(openQ)} />
        <StatTile icon={Calculator} label="В черзі розрахунку" value="7" tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Черга розрахунку"
          action={
            <Link href="/admin/resolve" className="flex items-center gap-1 text-xs font-semibold text-accent">
              Відкрити <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="grid size-10 place-items-center rounded-lg bg-warning/12 text-warning">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">
                7 результатів очікують підтвердження
              </p>
              <p className="text-xs text-ink-subtle">
                5 запропоновано автоматично, 2 потребують ручної перевірки
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          title="Останні дії"
          action={
            <Link href="/admin/audit" className="flex items-center gap-1 text-xs font-semibold text-accent">
              Журнал <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <ul className="divide-y divide-border">
            {auditRecent.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{a.action}</p>
                  <p className="text-xs text-ink-subtle">{a.who}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-faint">{a.time}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
