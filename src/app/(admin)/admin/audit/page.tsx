import {
  Calculator,
  Gift,
  Target,
  Users,
  DatabaseZap,
  LayoutTemplate,
  type LucideIcon,
} from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";

type Entry = {
  who: string;
  role: "admin" | "editor";
  action: string;
  area: "resolve" | "giveaway" | "questions" | "users" | "import" | "content";
  time: string;
};

const areaIcon: Record<Entry["area"], LucideIcon> = {
  resolve: Calculator,
  giveaway: Gift,
  questions: Target,
  users: Users,
  import: DatabaseZap,
  content: LayoutTemplate,
};

const log: Entry[] = [
  { who: "admin", role: "admin", action: "Підтвердив 12 результатів у черзі розрахунку", area: "resolve", time: "Сьогодні 17:47" },
  { who: "admin", role: "admin", action: "Обрав переможця розіграшу «AWP | Dragon Lore» — kv1tka", area: "giveaway", time: "Сьогодні 16:30" },
  { who: "editor_kyiv", role: "editor", action: "Змінив нагороду питання «Переможець карти» 60 → 70", area: "questions", time: "Сьогодні 15:12" },
  { who: "admin", role: "admin", action: "Підвищив shadow_kyiv до ролі «Редактор»", area: "users", time: "Сьогодні 14:03" },
  { who: "editor_kyiv", role: "editor", action: "Зняв блокування ручної правки для команди «B8»", area: "import", time: "Вчора 21:40" },
  { who: "editor_kyiv", role: "editor", action: "Оновив показники Instagram у hero-блоці", area: "content", time: "Вчора 19:05" },
  { who: "admin", role: "admin", action: "Повторний вибір переможця розіграшу (підтверджено)", area: "giveaway", time: "Вчора 18:22" },
];

export default function AuditPage() {
  return (
    <>
      <AdminHead
        title="Журнал аудиту"
        subtitle="Незмінний запис критичних дій. Виправлення створюють нову операцію, а не змінюють історію."
      />

      <Panel>
        <ul className="divide-y divide-border">
          {log.map((e, i) => {
            const Icon = areaIcon[e.area];
            return (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-muted">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{e.action}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                    <span className="font-semibold text-ink-muted">{e.who}</span>
                    <span
                      className={
                        e.role === "admin" ? "text-danger" : "text-info"
                      }
                    >
                      {e.role}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-ink-faint">
                  {e.time}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
