"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, Loader2, TriangleAlert } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getTeam } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none";

const statusMeta: Record<string, { tone: "success" | "info" | "neutral"; label: string }> = {
  open: { tone: "success", label: "Відкрите" },
  upcoming: { tone: "info", label: "Незабаром" },
  locked: { tone: "neutral", label: "Закрите" },
  resolved: { tone: "neutral", label: "Розраховано" },
};

type Opt = { id: string; label: string; sublabel: string; reward: number };
type MatchLite = {
  id: string;
  team_a: string;
  team_b: string;
  team_a_name: string | null;
  team_b_name: string | null;
};
type QForm = {
  id: string;
  match_id: string;
  kind: string;
  title: string;
  difficulty: string;
  status: string;
  deadline_label: string;
  options: Opt[];
  isNew?: boolean;
};
type QRow = { id: string; match_id: string; title: string; status: string; options: Opt[] };

function teamTag(slug: string, name: string | null): string {
  return name ? name.slice(0, 4).toUpperCase() : getTeam(slug).tag;
}

function blankOpt(): Opt {
  return { id: `o${Math.random().toString(36).slice(2, 7)}`, label: "", sublabel: "", reward: 50 };
}

export default function QuestionsAdmin() {
  const [rows, setRows] = React.useState<QRow[]>([]);
  const [matches, setMatches] = React.useState<MatchLite[]>([]);
  const [editing, setEditing] = React.useState<QForm | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const matchLabel = React.useCallback(
    (id: string) => {
      const m = matches.find((x) => x.id === id);
      if (!m) return "—";
      return `${teamTag(m.team_a, m.team_a_name)} vs ${teamTag(m.team_b, m.team_b_name)}`;
    },
    [matches],
  );

  const load = React.useCallback(async () => {
    const sb = createClient();
    const [{ data: qs }, { data: ms }] = await Promise.all([
      sb.from("questions").select("id, match_id, title, status, options").order("created_at", { ascending: false }),
      sb.from("matches").select("id, team_a, team_b, team_a_name, team_b_name").order("start_at", { ascending: true, nullsFirst: false }),
    ]);
    setRows((qs as QRow[]) ?? []);
    setMatches((ms as MatchLite[]) ?? []);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setError(null);
    setEditing({
      id: "",
      match_id: matches[0]?.id ?? "",
      kind: "match_winner",
      title: "",
      difficulty: "easy",
      status: "open",
      deadline_label: "до старту матчу",
      options: [blankOpt(), blankOpt()],
      isNew: true,
    });
  }

  async function openEdit(id: string) {
    setError(null);
    const { data } = await createClient().from("questions").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    setEditing({
      id: data.id,
      match_id: data.match_id,
      kind: data.kind ?? "custom",
      title: data.title,
      difficulty: data.difficulty ?? "medium",
      status: data.status ?? "open",
      deadline_label: data.deadline_label ?? "",
      options: (Array.isArray(data.options) ? data.options : []).map((o: Partial<Opt>) => ({
        id: o.id || blankOpt().id,
        label: o.label ?? "",
        sublabel: o.sublabel ?? "",
        reward: o.reward ?? 0,
      })),
    });
  }

  const up = (patch: Partial<QForm>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editing),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok || !j.ok) {
      setError(j.error || "Помилка збереження");
      return;
    }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Видалити питання?")) return;
    await fetch("/api/admin/questions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <>
      <AdminHead
        title="Питання"
        subtitle="Прогнози прив’язані до створених матчів. Варіанти, нагороди та статус — тут."
        action={
          <button
            onClick={openNew}
            disabled={matches.length === 0}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Plus className="size-4" />
            Нове питання
          </button>
        }
      />

      {matches.length === 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-ink">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>Спершу створи матч у розділі «Матчі» — питання прив’язуються до матчу.</div>
        </div>
      )}

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-3 font-semibold">Питання</th>
                <th className="px-4 py-3 font-semibold">Матч</th>
                <th className="px-4 py-3 font-semibold">Нагорода</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3 font-semibold text-ink">{r.title}</td>
                  <td className="px-4 py-3 text-ink-muted">{matchLabel(r.match_id)}</td>
                  <td className="tnum px-4 py-3 font-mono font-bold text-accent">
                    +{Math.max(0, ...r.options.map((o) => o.reward))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusMeta[r.status]?.tone ?? "neutral"}>
                      {statusMeta[r.status]?.label ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(r.id)}
                        aria-label="Редагувати"
                        className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        aria-label="Видалити"
                        className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-danger/15 hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-subtle">
                    Питань ще немає. Створи перше.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? "Нове питання" : "Редагувати питання"}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditing(null)} disabled={saving}>
              Скасувати
            </Button>
            <Button size="md" className="min-w-28" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Зберегти"}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            {error && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                {error}
              </p>
            )}
            <Field label="Матч">
              <select
                className={inputCls}
                value={editing.match_id}
                onChange={(e) => up({ match_id: e.target.value })}
              >
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {teamTag(m.team_a, m.team_a_name)} vs {teamTag(m.team_b, m.team_b_name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Формулювання">
              <input
                className={inputCls}
                placeholder="Напр. Переможець матчу"
                value={editing.title}
                onChange={(e) => up({ title: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Тип">
                <select className={inputCls} value={editing.kind} onChange={(e) => up({ kind: e.target.value })}>
                  <option value="match_winner">Переможець матчу</option>
                  <option value="exact_score">Точний рахунок</option>
                  <option value="map_winner">Переможець карти</option>
                  <option value="player_stat">Статистика гравця</option>
                  <option value="custom">Інше</option>
                </select>
              </Field>
              <Field label="Складність">
                <select className={inputCls} value={editing.difficulty} onChange={(e) => up({ difficulty: e.target.value })}>
                  <option value="easy">Легко</option>
                  <option value="medium">Середньо</option>
                  <option value="hard">Складно</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Дедлайн (текст)">
                <input
                  className={inputCls}
                  placeholder="до старту матчу"
                  value={editing.deadline_label}
                  onChange={(e) => up({ deadline_label: e.target.value })}
                />
              </Field>
              <Field label="Статус">
                <select className={inputCls} value={editing.status} onChange={(e) => up({ status: e.target.value })}>
                  <option value="open">Відкрите</option>
                  <option value="upcoming">Незабаром</option>
                  <option value="locked">Закрите</option>
                  <option value="resolved">Розраховано</option>
                </select>
              </Field>
            </div>

            {/* Options editor */}
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
                Варіанти відповіді (мін. 2)
              </span>
              <div className="space-y-2">
                {editing.options.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input
                      className={cn(inputCls, "flex-1")}
                      placeholder="Варіант"
                      value={o.label}
                      onChange={(e) =>
                        up({ options: editing.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                      }
                    />
                    <input
                      className={cn(inputCls, "w-20")}
                      placeholder="підпис"
                      value={o.sublabel}
                      onChange={(e) =>
                        up({ options: editing.options.map((x, j) => (j === i ? { ...x, sublabel: e.target.value } : x)) })
                      }
                    />
                    <input
                      type="number"
                      className={cn(inputCls, "w-20 tnum font-mono")}
                      value={o.reward}
                      onChange={(e) =>
                        up({ options: editing.options.map((x, j) => (j === i ? { ...x, reward: Number(e.target.value) } : x)) })
                      }
                    />
                    <button
                      onClick={() => up({ options: editing.options.filter((_, j) => j !== i) })}
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-danger/15 hover:text-danger"
                      aria-label="Прибрати"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => up({ options: [...editing.options, blankOpt()] })}
                  className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  <Plus className="size-3.5" /> Додати варіант
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
