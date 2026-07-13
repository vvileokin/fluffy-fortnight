"use client";

import * as React from "react";
import { Pencil, Plus, Check } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  questions as seed,
  matches,
  getMatch,
  getTeam,
  getTournament,
} from "@/lib/data";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  matchId: string;
  deadline: string;
  reward: number;
  status: string;
  isNew?: boolean;
};

const statusMeta: Record<string, { tone: "success" | "info" | "neutral"; label: string }> = {
  open: { tone: "success", label: "Відкрите" },
  upcoming: { tone: "info", label: "Незабаром" },
  locked: { tone: "neutral", label: "Закрите" },
  resolved: { tone: "neutral", label: "Розраховано" },
};

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none";

function matchLabel(matchId: string): string {
  const m = getMatch(matchId);
  if (!m) return "—";
  return `${getTeam(m.a).tag} vs ${getTeam(m.b).tag}`;
}

const matchOptions = matches.map((m) => ({
  id: m.id,
  label: `${getTeam(m.a).tag} vs ${getTeam(m.b).tag} · ${getTournament(m.tournamentSlug)?.shortName ?? ""}`,
}));

export default function QuestionsAdmin() {
  const [rows, setRows] = React.useState<Row[]>(
    seed.map((q) => ({
      id: q.id,
      title: q.title,
      matchId: q.matchId,
      deadline: q.deadlineLabel,
      reward: Math.max(...q.options.map((o) => o.reward)),
      status: q.status,
    })),
  );
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [saved, setSaved] = React.useState(false);

  function openNew() {
    setEditing({
      id: `q-new-${Date.now()}`,
      title: "",
      matchId: matches[0].id,
      deadline: "",
      reward: 50,
      status: "upcoming",
      isNew: true,
    });
  }

  function save(next: Row) {
    setRows((prev) =>
      next.isNew ? [{ ...next, isNew: false }, ...prev] : prev.map((r) => (r.id === next.id ? next : r)),
    );
    setSaved(true);
    window.setTimeout(() => {
      setSaved(false);
      setEditing(null);
    }, 800);
  }

  return (
    <>
      <AdminHead
        title="Питання"
        subtitle="Варіанти, дедлайни, нагороди та матч, до якого прив’язаний прогноз."
        action={
          <button
            onClick={openNew}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            <Plus className="size-4" />
            Нове питання
          </button>
        }
      />

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-3 font-semibold">Питання</th>
                <th className="px-4 py-3 font-semibold">Матч</th>
                <th className="px-4 py-3 font-semibold">Дедлайн</th>
                <th className="px-4 py-3 font-semibold">Нагорода</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3 font-semibold text-ink">{r.title}</td>
                  <td className="px-4 py-3 text-ink-muted">{matchLabel(r.matchId)}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.deadline}</td>
                  <td className="tnum px-4 py-3 font-mono font-bold text-accent">+{r.reward}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusMeta[r.status]?.tone ?? "neutral"}>
                      {statusMeta[r.status]?.label ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(r)}
                      aria-label="Редагувати"
                      className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
            <Button variant="ghost" size="md" onClick={() => setEditing(null)}>
              Скасувати
            </Button>
            <Button size="md" className="min-w-28" onClick={() => editing && save(editing)}>
              {saved ? (
                <>
                  <Check className="size-4" strokeWidth={3} /> Збережено
                </>
              ) : (
                "Зберегти"
              )}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <Field label="Формулювання">
              <input
                className={inputCls}
                placeholder="Напр. Переможець матчу"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </Field>
            <Field label="Матч">
              <select
                className={inputCls}
                value={editing.matchId}
                onChange={(e) => setEditing({ ...editing, matchId: e.target.value })}
              >
                {matchOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Дедлайн">
                <input
                  className={inputCls}
                  placeholder="напр. до старту 2 карти"
                  value={editing.deadline}
                  onChange={(e) => setEditing({ ...editing, deadline: e.target.value })}
                />
              </Field>
              <Field label="Макс. нагорода">
                <input
                  type="number"
                  className={cn(inputCls, "tnum font-mono")}
                  value={editing.reward}
                  onChange={(e) => setEditing({ ...editing, reward: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Статус">
              <select
                className={inputCls}
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              >
                <option value="open">Відкрите</option>
                <option value="upcoming">Незабаром</option>
                <option value="locked">Закрите</option>
                <option value="resolved">Розраховано</option>
              </select>
            </Field>
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
