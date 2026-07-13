"use client";

import * as React from "react";
import { Trophy, Check, Clock, Dices, Crown, Plus } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ImageField } from "@/components/admin/ImageField";
import { giveaways } from "@/lib/data";
import { cn } from "@/lib/utils";

type Applicant = { handle: string; confirmed: boolean };
type GiveItem = { slug: string; prize: string };

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none";

const applicants: Applicant[] = [
  { handle: "zaraza_ua", confirmed: true },
  { handle: "kv1tka", confirmed: true },
  { handle: "molotok", confirmed: false },
  { handle: "b1t_believer", confirmed: true },
  { handle: "shadow_kyiv", confirmed: true },
  { handle: "praporshchyk", confirmed: false },
  { handle: "oleksandr_p", confirmed: true },
];

const emptyForm = {
  prize: "",
  sponsor: "",
  value: "",
  minPoints: "",
  endLabel: "",
  conditions: "",
};

export default function GiveawaysAdmin() {
  const [list, setList] = React.useState<GiveItem[]>(
    giveaways.map((g) => ({ slug: g.slug, prize: g.prize })),
  );
  const [active, setActive] = React.useState(giveaways[0].slug);
  const [winner, setWinner] = React.useState<string | null>(null);
  const [confirmReroll, setConfirmReroll] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);

  const confirmed = applicants.filter((a) => a.confirmed);

  function draw() {
    if (winner && !confirmReroll) {
      setConfirmReroll(true);
      return;
    }
    const pick = confirmed[Math.floor(Math.random() * confirmed.length)];
    setWinner(pick.handle);
    setConfirmReroll(false);
  }

  function createGiveaway() {
    if (!form.prize.trim()) return;
    const slug = `new-${Date.now()}`;
    setList((prev) => [{ slug, prize: form.prize.trim() }, ...prev]);
    setActive(slug);
    setWinner(null);
    setForm(emptyForm);
    setCreating(false);
  }

  return (
    <>
      <AdminHead
        title="Розіграші"
        subtitle="Створюй розіграші, керуй заявками та обирай переможця. Кожен вибір фіксується в аудиті."
        action={
          <button
            onClick={() => setCreating(true)}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            <Plus className="size-4" />
            Створити розіграш
          </button>
        }
      />

      {/* Giveaway selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {list.map((g) => (
          <button
            key={g.slug}
            onClick={() => {
              setActive(g.slug);
              setWinner(null);
              setConfirmReroll(false);
            }}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
              active === g.slug
                ? "border-accent/50 bg-accent/10 text-ink"
                : "border-border bg-surface text-ink-muted hover:bg-surface-2",
            )}
          >
            {g.prize}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
        <Panel
          title={`Заявки (${applicants.length})`}
          action={
            <span className="text-xs text-ink-subtle">
              підтверджено {confirmed.length}
            </span>
          }
        >
          <ul className="divide-y divide-border">
            {applicants.map((a) => (
              <li
                key={a.handle}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  winner === a.handle && "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]",
                )}
              >
                <Avatar name={a.handle} size="sm" ring={winner === a.handle} />
                <span className="flex-1 text-sm font-semibold text-ink">
                  {a.handle}
                </span>
                {winner === a.handle && (
                  <Badge tone="accent">
                    <Crown className="size-3" /> Переможець
                  </Badge>
                )}
                <Badge tone={a.confirmed ? "success" : "warning"}>
                  {a.confirmed ? (
                    <>
                      <Check className="size-3" strokeWidth={3} /> Підтв.
                    </>
                  ) : (
                    <>
                      <Clock className="size-3" /> Очікує
                    </>
                  )}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-3">
          <Panel title="Вибір переможця">
            <div className="p-4">
              {winner ? (
                <div className="mb-3 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3">
                  <Avatar name={winner} size="md" ring />
                  <div>
                    <p className="text-[0.6875rem] uppercase tracking-wide text-ink-subtle">
                      Переможець
                    </p>
                    <p className="text-sm font-bold text-ink">{winner}</p>
                  </div>
                </div>
              ) : (
                <div className="mb-3 grid place-items-center rounded-lg border border-dashed border-border bg-surface-2 py-6 text-center">
                  <Trophy className="size-6 text-ink-faint" />
                  <p className="mt-2 text-xs text-ink-subtle">
                    Переможця ще не обрано
                  </p>
                </div>
              )}

              <button
                onClick={draw}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors",
                  confirmReroll
                    ? "bg-warning text-bg hover:opacity-90"
                    : "bg-accent text-accent-ink hover:bg-accent-hover",
                )}
              >
                <Dices className="size-4" />
                {confirmReroll
                  ? "Підтвердити повторний вибір"
                  : winner
                    ? "Обрати ще раз"
                    : "Розіграти переможця"}
              </button>
              {confirmReroll && (
                <p className="mt-2 text-center text-xs text-warning">
                  Повторний вибір також запишеться в журнал.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Створити розіграш"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setCreating(false)}>
              Скасувати
            </Button>
            <Button size="md" onClick={createGiveaway}>
              Опублікувати
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ImageField
            label="Фото призу"
            hint="Рекомендовано 640×400 px · PNG/WebP з прозорістю"
            value={undefined}
            thumbW={80}
            thumbH={50}
          />
          <GField label="Приз">
            <input
              className={inputCls}
              placeholder="напр. AK-47 | Nightwish (FN)"
              value={form.prize}
              onChange={(e) => setForm({ ...form, prize: e.target.value })}
            />
          </GField>
          <GField label="Партнер / спонсор">
            <input
              className={inputCls}
              placeholder="напр. CS2 UA × SkinHub"
              value={form.sponsor}
              onChange={(e) => setForm({ ...form, sponsor: e.target.value })}
            />
          </GField>
          <div className="grid grid-cols-2 gap-3">
            <GField label="Вартість, $">
              <input
                type="number"
                className={cn(inputCls, "tnum font-mono")}
                placeholder="340"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </GField>
            <GField label="Мін. поінтів">
              <input
                type="number"
                className={cn(inputCls, "tnum font-mono")}
                placeholder="500"
                value={form.minPoints}
                onChange={(e) => setForm({ ...form, minPoints: e.target.value })}
              />
            </GField>
          </div>
          <GField label="Дедлайн">
            <input
              className={inputCls}
              placeholder="напр. до 20 лип"
              value={form.endLabel}
              onChange={(e) => setForm({ ...form, endLabel: e.target.value })}
            />
          </GField>
          <GField label="Умови участі (кожна з нового рядка)">
            <textarea
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
              placeholder={"Підписка на Telegram\nМінімум 500 поінтів"}
              value={form.conditions}
              onChange={(e) => setForm({ ...form, conditions: e.target.value })}
            />
          </GField>
        </div>
      </Modal>
    </>
  );
}

function GField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
