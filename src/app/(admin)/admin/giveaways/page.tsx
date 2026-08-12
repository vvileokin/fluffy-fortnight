"use client";

import * as React from "react";
import { Trophy, Check, Dices, Crown, Plus, Trash2, Ban, Loader2 } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ImageField } from "@/components/admin/ImageField";
import { createClient } from "@/lib/supabase/client";
import { formatInt } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Applicant = {
  userId: string;
  handle: string;
  avatarUrl: string | null;
  points: number;
  confirmed: boolean;
};
type Winner = { userId: string; handle: string; place: number };
type GiveItem = { slug: string; prize: string };

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none";

const emptyForm = {
  prize: "",
  sponsor: "",
  value: "",
  minPoints: "",
  endLabel: "",
  conditions: "",
  image: "",
  skin: "",
};

export default function GiveawaysAdmin() {
  const [list, setList] = React.useState<GiveItem[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [applicants, setApplicants] = React.useState<Applicant[]>([]);
  const [winners, setWinners] = React.useState<Winner[]>([]);
  const [drawnAt, setDrawnAt] = React.useState<string | null>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [drawError, setDrawError] = React.useState<string | null>(null);
  const [confirmReroll, setConfirmReroll] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);

  const load = React.useCallback(async () => {
    const { data } = await createClient()
      .from("giveaways")
      .select("slug, prize")
      .order("created_at", { ascending: false });
    const items = (data as GiveItem[]) ?? [];
    setList(items);
    setActive((cur) => cur ?? items[0]?.slug ?? null);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function remove(slug: string) {
    if (!confirm("Видалити розіграш? Це також прибере його з сайту.")) return;
    const res = await fetch("/api/admin/giveaways", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Не вдалося видалити");
      return;
    }
    setList((prev) => prev.filter((g) => g.slug !== slug));
    setActive((cur) => (cur === slug ? null : cur));
  }

  // Entries live behind the service role — a player can only read their own
  // row — so the admin list comes from the API, not from the browser client.
  const loadEntries = React.useCallback(async (slug: string) => {
    const res = await fetch(`/api/admin/giveaways/draw?slug=${encodeURIComponent(slug)}`);
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) {
      setApplicants([]);
      setWinners([]);
      setDrawnAt(null);
      return;
    }
    setApplicants(j.entries as Applicant[]);
    setWinners(j.winners as Winner[]);
    setDrawnAt(j.drawnAt as string | null);
  }, []);

  React.useEffect(() => {
    if (!active) return;
    setConfirmReroll(false);
    setDrawError(null);
    void loadEntries(active);
  }, [active, loadEntries]);

  const confirmed = applicants.filter((a) => a.confirmed);

  async function setConfirmedFlag(userId: string, next: boolean) {
    if (!active) return;
    setApplicants((prev) =>
      prev.map((a) => (a.userId === userId ? { ...a, confirmed: next } : a)),
    );
    await fetch("/api/admin/giveaways/draw", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: active, userId, confirmed: next }),
    });
  }

  async function draw() {
    if (!active) return;
    // A redraw replaces a published result, so it takes a second press.
    if (winners.length > 0 && !confirmReroll) {
      setConfirmReroll(true);
      return;
    }
    setDrawing(true);
    setDrawError(null);
    const res = await fetch("/api/admin/giveaways/draw", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: active, redraw: winners.length > 0 }),
    });
    const j = await res.json().catch(() => null);
    setDrawing(false);
    setConfirmReroll(false);
    if (!res.ok || !j?.ok) {
      setDrawError(
        j?.error === "no_entries"
          ? "Немає жодної підтвердженої заявки."
          : j?.error === "already_drawn"
            ? "Розіграш уже проведено."
            : "Не вдалося розіграти. Спробуй ще раз.",
      );
      return;
    }
    setWinners(j.winners as Winner[]);
    await loadEntries(active);
  }

  const [saving, setSaving] = React.useState(false);

  async function createGiveaway() {
    if (!form.prize.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/giveaways", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prize: form.prize.trim(),
        sponsor: form.sponsor,
        value_usd: Number(form.value) || 0,
        min_points: Number(form.minPoints) || 0,
        end_label: form.endLabel,
        image: form.image || null,
        skin: form.skin || null,
        description: `${form.prize.trim()} від ${form.sponsor || "CS2 UA"}.`,
        conditions: form.conditions.split("\n").map((s) => s.trim()).filter(Boolean),
        status: "open",
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      alert(j.error || "Помилка збереження");
      return;
    }
    setList((prev) => [{ slug: j.slug, prize: form.prize.trim() }, ...prev]);
    setActive(j.slug);
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
      {list.length === 0 ? (
        <div className="mb-4 rounded-lg border border-dashed border-[color-mix(in_oklch,var(--ink)_12%,transparent)] bg-surface px-4 py-8 text-center text-sm text-ink-subtle">
          Розіграшів ще немає. Створи перший — він одразу з’явиться на сайті.
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {list.map((g) => (
            <div
              key={g.slug}
              className={cn(
                "flex items-center rounded-lg border transition-colors",
                active === g.slug
                  ? "border-accent/50 bg-accent/10"
                  : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              <button
                onClick={() => {
                  setActive(g.slug);
                  setConfirmReroll(false);
                }}
                className={cn(
                  "py-2 pl-3 pr-2 text-sm font-semibold",
                  active === g.slug ? "text-ink" : "text-ink-muted",
                )}
              >
                {g.prize}
              </button>
              <button
                onClick={() => remove(g.slug)}
                aria-label="Видалити розіграш"
                className="grid size-8 place-items-center rounded-r-lg text-ink-subtle transition-colors hover:bg-danger/15 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
        <Panel
          title={`Заявки (${applicants.length})`}
          action={
            <span className="text-xs text-ink-subtle">
              підтверджено {confirmed.length}
            </span>
          }
        >
          {applicants.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-subtle">
              Заявок ще немає. Вони з&rsquo;являться тут щойно хтось візьме участь.
            </p>
          ) : (
            <ul className="divide-y divide-[color-mix(in_oklch,var(--ink)_6%,transparent)]">
              {applicants.map((a) => {
                const place = winners.find((w) => w.userId === a.userId)?.place;
                return (
                  <li
                    key={a.userId}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5",
                      place && "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]",
                      !a.confirmed && "opacity-55",
                    )}
                  >
                    <Avatar name={a.handle} src={a.avatarUrl ?? undefined} size="sm" ring={!!place} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {a.handle}
                    </span>
                    <span className="tnum shrink-0 font-mono text-xs text-ink-subtle">
                      {formatInt(a.points)}
                    </span>
                    {place && (
                      <Badge tone="accent">
                        <Crown className="size-3" /> {winners.length > 1 ? `#${place}` : "Переможець"}
                      </Badge>
                    )}
                    {/* Disqualifying is the admin action here, not approving:
                        entries are eligible on arrival, so this button only ever
                        removes someone who broke the rules. */}
                    <button
                      onClick={() => setConfirmedFlag(a.userId, !a.confirmed)}
                      disabled={!!drawnAt}
                      title={a.confirmed ? "Дискваліфікувати" : "Поновити"}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        a.confirmed
                          ? "text-ink-subtle hover:bg-danger/15 hover:text-danger"
                          : "text-danger hover:bg-success/15 hover:text-success",
                      )}
                    >
                      {a.confirmed ? <Check className="size-3.5" strokeWidth={3} /> : <Ban className="size-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel title="Вибір переможця">
            <div className="p-4">
              {winners.length > 0 ? (
                <ul className="mb-3 space-y-2">
                  {winners.map((w) => (
                    <li
                      key={w.userId}
                      className="flex items-center gap-3 rounded-lg bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] p-3 shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_35%,transparent)]"
                    >
                      <Avatar name={w.handle} size="md" ring />
                      <div className="min-w-0">
                        <p className="text-[0.6875rem] uppercase tracking-wide text-ink-subtle">
                          {winners.length > 1 ? `Місце ${w.place}` : "Переможець"}
                        </p>
                        <p className="truncate text-sm font-bold text-ink">{w.handle}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mb-3 grid place-items-center rounded-lg border border-dashed border-[color-mix(in_oklch,var(--ink)_12%,transparent)] bg-surface-2 py-6 text-center">
                  <Trophy className="size-6 text-ink-faint" />
                  <p className="mt-2 text-xs text-ink-subtle">
                    Переможця ще не обрано
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {confirmed.length} підтверджених заявок
                  </p>
                </div>
              )}

              <button
                onClick={draw}
                disabled={drawing || confirmed.length === 0}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                  confirmReroll
                    ? "bg-warning text-bg hover:opacity-90"
                    : "bg-accent text-accent-ink hover:bg-accent-hover",
                )}
              >
                {drawing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Dices className="size-4" />
                )}
                {drawing
                  ? "Розігруємо…"
                  : confirmReroll
                    ? "Підтвердити повторний вибір"
                    : winners.length > 0
                      ? "Обрати ще раз"
                      : "Розіграти переможця"}
              </button>
              {confirmReroll && (
                <p className="mt-2 text-center text-xs text-warning">
                  Це замінить опублікований результат. Дію буде записано в журнал.
                </p>
              )}
              {drawError && (
                <p role="alert" className="mt-2 text-center text-xs font-semibold text-danger">
                  {drawError}
                </p>
              )}
              {drawnAt && !confirmReroll && (
                <p className="mt-2 text-center text-xs text-ink-subtle">
                  Розіграно {new Date(drawnAt).toLocaleString("uk-UA")}
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
            <Button size="md" onClick={createGiveaway} disabled={saving}>
              {saving ? "Збереження…" : "Опублікувати"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ImageField
            label="Банер розіграшу"
            hint="1200×400 px (3:1) · JPG/WebP — картка обрізає по центру"
            folder="giveaways"
            value={form.image || undefined}
            onChange={(url) => setForm({ ...form, image: url })}
            thumbW={90}
            thumbH={30}
          />
          <GField label="Стиль картки">
            <select
              className={inputCls}
              value={form.skin}
              onChange={(e) => setForm({ ...form, skin: e.target.value })}
            >
              <option value="">Звичайний</option>
              <option value="ewc">Esports World Cup</option>
              <option value="blast">BLAST</option>
            </select>
          </GField>
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
