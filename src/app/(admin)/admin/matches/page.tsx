"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { teams, allTournaments, getTeam } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none";

const teamList = Object.values(teams).sort((a, b) => a.name.localeCompare(b.name));

type MapRow = { name: string; a: number; b: number };
type VetoRow = { team: string; action: string; map: string };

type MatchForm = {
  id: string;
  tournament_slug: string;
  is_event: boolean;
  team_a: string;
  team_b: string;
  status: string;
  format: string;
  stage: string;
  time_label: string;
  score_a: number;
  score_b: number;
  live_map_label: string;
  maps: MapRow[];
  veto: VetoRow[];
  h2h_a: number;
  h2h_b: number;
  open_questions: number;
  max_reward: number;
  isNew?: boolean;
};

function blank(): MatchForm {
  return {
    id: `m-${Date.now().toString(36)}`,
    tournament_slug: "blast-bounty-s2",
    is_event: true,
    team_a: "vitality",
    team_b: "spirit",
    status: "upcoming",
    format: "BO3",
    stage: "",
    time_label: "",
    score_a: 0,
    score_b: 0,
    live_map_label: "",
    maps: [],
    veto: [],
    h2h_a: 0,
    h2h_b: 0,
    open_questions: 0,
    max_reward: 0,
    isNew: true,
  };
}

type Row = {
  id: string;
  team_a: string;
  team_b: string;
  status: string;
  is_event: boolean;
  tournament_slug: string;
  stage: string | null;
  score_a: number;
  score_b: number;
};

export default function MatchesAdmin() {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [tableMissing, setTableMissing] = React.useState(false);
  const [editing, setEditing] = React.useState<MatchForm | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const { data, error } = await createClient()
      .from("matches")
      .select("id, team_a, team_b, status, is_event, tournament_slug, stage, score_a, score_b")
      .order("start_at", { ascending: true, nullsFirst: false });
    if (error) {
      setTableMissing(true);
      setRows([]);
      return;
    }
    setRows((data as Row[]) ?? []);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function openEdit(id: string) {
    const { data } = await createClient().from("matches").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    setEditing({
      id: data.id,
      tournament_slug: data.tournament_slug,
      is_event: data.is_event,
      team_a: data.team_a,
      team_b: data.team_b,
      status: data.status,
      format: data.format,
      stage: data.stage ?? "",
      time_label: data.time_label ?? "",
      score_a: data.score_a,
      score_b: data.score_b,
      live_map_label: data.live_map_label ?? "",
      maps: data.maps ?? [],
      veto: data.veto ?? [],
      h2h_a: data.h2h?.a ?? 0,
      h2h_b: data.h2h?.b ?? 0,
      open_questions: data.open_questions,
      max_reward: data.max_reward,
    });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const payload = {
      ...editing,
      h2h: { a: editing.h2h_a, b: editing.h2h_b },
    };
    const res = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Помилка збереження");
      return;
    }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Видалити матч?")) return;
    await fetch("/api/admin/matches", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  const up = (patch: Partial<MatchForm>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  return (
    <>
      <AdminHead
        title="Матчі"
        subtitle="Створюй і редагуй матчі. BLAST-матчі отримують неоновий дизайн, інші — звичайний. Лого команд: 256×256 px, PNG з прозорим фоном."
        action={
          <button
            onClick={() => setEditing(blank())}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            <Plus className="size-4" /> Новий матч
          </button>
        }
      />

      {tableMissing && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-ink">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            Таблиця <code>matches</code> ще не створена. Запусти{" "}
            <code>supabase/migrations/0003_matches.sql</code> у Supabase → SQL Editor,
            потім онови сторінку.
          </div>
        </div>
      )}

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-3 font-semibold">Матч</th>
                <th className="px-4 py-3 font-semibold">Тип</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold">Рахунок</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TeamLogo team={getTeam(r.team_a)} size="xs" />
                      <span className="font-semibold text-ink">{getTeam(r.team_a).tag}</span>
                      <span className="text-ink-faint">vs</span>
                      <span className="font-semibold text-ink">{getTeam(r.team_b).tag}</span>
                      <TeamLogo team={getTeam(r.team_b)} size="xs" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.is_event ? (
                      <Badge tone="accent">Event</Badge>
                    ) : (
                      <Badge tone="neutral">Звичайний</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{r.status}</td>
                  <td className="tnum px-4 py-3 font-mono text-ink">
                    {r.score_a}:{r.score_b}
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
              {rows && rows.length === 0 && !tableMissing && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-subtle">
                    Матчів ще немає. Створи перший.
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
        title={editing?.isNew ? "Новий матч" : "Редагувати матч"}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditing(null)}>
              Скасувати
            </Button>
            <Button size="md" className="min-w-28" onClick={save}>
              {saving ? "Збереження…" : "Зберегти"}
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Команда A">
                <select className={inputCls} value={editing.team_a} onChange={(e) => up({ team_a: e.target.value })}>
                  {teamList.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Команда B">
                <select className={inputCls} value={editing.team_b} onChange={(e) => up({ team_b: e.target.value })}>
                  {teamList.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Турнір">
                <select className={inputCls} value={editing.tournament_slug} onChange={(e) => up({ tournament_slug: e.target.value })}>
                  {allTournaments.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.shortName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Дизайн">
                <select className={inputCls} value={editing.is_event ? "event" : "regular"} onChange={(e) => up({ is_event: e.target.value === "event" })}>
                  <option value="event">BLAST (неон)</option>
                  <option value="regular">Звичайний</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Статус">
                <select className={inputCls} value={editing.status} onChange={(e) => up({ status: e.target.value })}>
                  <option value="upcoming">Незабаром</option>
                  <option value="live">Live</option>
                  <option value="finished">Завершено</option>
                </select>
              </Field>
              <Field label="Формат">
                <select className={inputCls} value={editing.format} onChange={(e) => up({ format: e.target.value })}>
                  <option>BO1</option>
                  <option>BO3</option>
                  <option>BO5</option>
                </select>
              </Field>
              <Field label="Стадія">
                <input className={inputCls} value={editing.stage} onChange={(e) => up({ stage: e.target.value })} placeholder="Півфінал" />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Рахунок A">
                <input type="number" className={cn(inputCls, "tnum font-mono")} value={editing.score_a} onChange={(e) => up({ score_a: Number(e.target.value) })} />
              </Field>
              <Field label="Рахунок B">
                <input type="number" className={cn(inputCls, "tnum font-mono")} value={editing.score_b} onChange={(e) => up({ score_b: Number(e.target.value) })} />
              </Field>
              <Field label="Час / мітка">
                <input className={inputCls} value={editing.time_label} onChange={(e) => up({ time_label: e.target.value })} placeholder="21 лип · 17:00" />
              </Field>
            </div>

            {editing.status === "live" && (
              <Field label="Поточна карта (live)">
                <input className={inputCls} value={editing.live_map_label} onChange={(e) => up({ live_map_label: e.target.value })} placeholder="Mirage · 2 карта · 11:8" />
              </Field>
            )}

            {/* Per-map scores */}
            <ListEditor
              label="Рахунок по картах (для завершених)"
              rows={editing.maps}
              onChange={(maps) => up({ maps })}
              addLabel="Додати карту"
              blankRow={{ name: "", a: 0, b: 0 }}
              render={(row, upd) => (
                <>
                  <input className={cn(inputCls, "flex-1")} placeholder="Карта" value={row.name} onChange={(e) => upd({ name: e.target.value })} />
                  <input type="number" className={cn(inputCls, "w-16 tnum")} value={row.a} onChange={(e) => upd({ a: Number(e.target.value) })} />
                  <input type="number" className={cn(inputCls, "w-16 tnum")} value={row.b} onChange={(e) => upd({ b: Number(e.target.value) })} />
                </>
              )}
            />

            {/* Map veto */}
            <ListEditor
              label="Map veto"
              rows={editing.veto}
              onChange={(veto) => up({ veto })}
              addLabel="Додати крок вето"
              blankRow={{ team: "a", action: "ban", map: "" }}
              render={(row, upd) => (
                <>
                  <select className={cn(inputCls, "w-20")} value={row.team} onChange={(e) => upd({ team: e.target.value })}>
                    <option value="a">A</option>
                    <option value="b">B</option>
                    <option value="-">—</option>
                  </select>
                  <select className={cn(inputCls, "w-28")} value={row.action} onChange={(e) => upd({ action: e.target.value })}>
                    <option value="ban">ban</option>
                    <option value="pick">pick</option>
                    <option value="decider">decider</option>
                  </select>
                  <input className={cn(inputCls, "flex-1")} placeholder="Карта" value={row.map} onChange={(e) => upd({ map: e.target.value })} />
                </>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="H2H — перемоги A">
                <input type="number" className={cn(inputCls, "tnum font-mono")} value={editing.h2h_a} onChange={(e) => up({ h2h_a: Number(e.target.value) })} />
              </Field>
              <Field label="H2H — перемоги B">
                <input type="number" className={cn(inputCls, "tnum font-mono")} value={editing.h2h_b} onChange={(e) => up({ h2h_b: Number(e.target.value) })} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Відкритих питань">
                <input type="number" className={cn(inputCls, "tnum font-mono")} value={editing.open_questions} onChange={(e) => up({ open_questions: Number(e.target.value) })} />
              </Field>
              <Field label="Макс. нагорода">
                <input type="number" className={cn(inputCls, "tnum font-mono")} value={editing.max_reward} onChange={(e) => up({ max_reward: Number(e.target.value) })} />
              </Field>
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

function ListEditor<T extends object>({
  label,
  rows,
  onChange,
  addLabel,
  blankRow,
  render,
}: {
  label: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  addLabel: string;
  blankRow: T;
  render: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{label}</span>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {render(row, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))))}
            <button
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-danger/15 hover:text-danger"
              aria-label="Прибрати"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...rows, { ...blankRow }])}
          className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          <Plus className="size-3.5" /> {addLabel}
        </button>
      </div>
    </div>
  );
}
