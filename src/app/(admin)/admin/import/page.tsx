"use client";

import * as React from "react";
import { RefreshCw, Check, X, Loader2, DatabaseZap, ExternalLink } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { teams, tournaments, getTeam } from "@/lib/data";
import { cn } from "@/lib/utils";

type Review = "pending" | "approved" | "rejected";

type Item = {
  ps_id: number;
  name: string | null;
  ps_status: string | null;
  begin_at: string | null;
  number_of_games: number | null;
  league_name: string | null;
  serie_name: string | null;
  tournament_name: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
  match_id: string | null;
  suggested_a: string | null;
  suggested_b: string | null;
};

const catalog = Object.values(teams).sort((a, b) => a.name.localeCompare(b.name));
const tourneys = tournaments.map((t) => ({ slug: t.slug, name: t.shortName || t.name }));

const statusLabel: Record<string, string> = {
  not_started: "Ще не почався",
  running: "Йде зараз",
  finished: "Завершено",
  canceled: "Скасовано",
  postponed: "Перенесено",
};

function when(iso: string | null): string {
  if (!iso) return "час не вказано";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "час не вказано";
  return d.toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Per-match choices the admin can adjust before approving. */
type Draft = { a: string; b: string; tournament: string; stage: string };

export default function ImportAdmin() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [review, setReview] = React.useState<Review>("pending");
  const [drafts, setDrafts] = React.useState<Record<number, Draft>>({});
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (which: Review) => {
    setLoading(true);
    const res = await fetch(`/api/admin/pandascore?review=${which}`).catch(() => null);
    const j = await res?.json().catch(() => null);
    setLoading(false);
    if (!j?.ok) {
      setError(j?.error === "unauthorized" ? "Немає доступу." : "Не вдалося завантажити список.");
      return;
    }
    const list = j.items as Item[];
    setItems(list);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const it of list) {
        next[it.ps_id] ??= {
          a: it.suggested_a ?? "",
          b: it.suggested_b ?? "",
          tournament: "",
          stage: it.tournament_name ?? "",
        };
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    void load(review);
  }, [review, load]);

  async function sync() {
    setSyncing(true);
    setError(null);
    setNote(null);
    const res = await fetch("/api/admin/pandascore", { method: "POST" }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setSyncing(false);
    if (!res?.ok) {
      setError(j?.error || "Не вдалося синхронізувати.");
      return;
    }
    setNote(
      `Отримано ${j.total} матчів · нових ${j.added} · оновлено час у ${j.rescheduled}` +
        (j.quotaLeft ? ` · запитів лишилось ${j.quotaLeft}` : ""),
    );
    await load(review);
  }

  async function decide(item: Item, decision: "approved" | "rejected") {
    const d = drafts[item.ps_id];
    setBusyId(item.ps_id);
    setError(null);
    const res = await fetch("/api/admin/pandascore/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ps_id: item.ps_id,
        decision,
        slug_a: d?.a,
        slug_b: d?.b,
        tournament_slug: d?.tournament || null,
        is_event: false,
        stage: d?.stage || null,
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setBusyId(null);
    if (!res?.ok) {
      setError(j?.error || "Не вдалося зберегти рішення.");
      return;
    }
    setItems((prev) => prev.filter((x) => x.ps_id !== item.ps_id));
  }

  const setDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  return (
    <>
      <AdminHead
        title="Імпорт з PandaScore"
        subtitle="PandaScore дає календар — хто з ким і коли. Нічого не потрапляє на сайт саме собою: матч чекає тут, доки ти його не схвалиш. Карти, вето й питання лишаються за тобою."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Синхронізувати
        </button>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {(["pending", "approved", "rejected"] as Review[]).map((r) => (
            <button
              key={r}
              onClick={() => setReview(r)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                review === r ? "bg-accent text-accent-ink" : "text-ink-muted hover:bg-surface-2",
              )}
            >
              {r === "pending" ? "На розгляді" : r === "approved" ? "Додані" : "Відхилені"}
            </button>
          ))}
        </div>
      </div>

      {note && (
        <div className="mb-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          {note}
        </div>
      )}
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
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <DatabaseZap className="mx-auto size-6 text-ink-faint" />
            <p className="mt-2 text-sm text-ink-subtle">
              {review === "pending"
                ? "Нічого не чекає на розгляд. Натисни «Синхронізувати», щоб забрати свіжий календар."
                : "Порожньо."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const d = drafts[it.ps_id] ?? { a: "", b: "", tournament: "", stage: "" };
              // A match has to land in a tournament — the column is NOT NULL.
              const ready = !!d.a && !!d.b && d.a !== d.b && !!d.tournament;
              const busy = busyId === it.ps_id;
              return (
                <li key={it.ps_id} className="space-y-3 px-4 py-4">
                  {/* What PandaScore says */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {it.team_a_name ?? "TBD"} vs {it.team_b_name ?? "TBD"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-subtle">
                        {it.serie_name ?? it.league_name ?? "—"}
                        {it.tournament_name ? ` · ${it.tournament_name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      <span className="rounded-md bg-surface-2 px-2 py-1 font-semibold text-ink-muted">
                        BO{it.number_of_games ?? 3}
                      </span>
                      <span className="text-ink-subtle">{when(it.begin_at)}</span>
                      <span className="text-ink-faint">
                        {statusLabel[it.ps_status ?? ""] ?? it.ps_status}
                      </span>
                    </div>
                  </div>

                  {review === "pending" ? (
                    <>
                      {/* Which of our teams these are */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <TeamPick
                          label={it.team_a_name ?? "Сторона A"}
                          value={d.a}
                          guessed={!!it.suggested_a && it.suggested_a === d.a}
                          onChange={(v) => setDraft(it.ps_id, { a: v })}
                        />
                        <TeamPick
                          label={it.team_b_name ?? "Сторона B"}
                          value={d.b}
                          guessed={!!it.suggested_b && it.suggested_b === d.b}
                          onChange={(v) => setDraft(it.ps_id, { b: v })}
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          value={d.tournament}
                          onChange={(e) => setDraft(it.ps_id, { tournament: e.target.value })}
                          className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-sm text-ink focus:border-accent focus:outline-none"
                        >
                          <option value="">Турнір на сайті — обов’язково</option>
                          {tourneys.map((t) => (
                            <option key={t.slug} value={t.slug}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <input
                          value={d.stage}
                          onChange={(e) => setDraft(it.ps_id, { stage: e.target.value })}
                          placeholder="Стадія (Півфінал, Stage 2…)"
                          className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => decide(it, "approved")}
                          disabled={!ready || busy}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" strokeWidth={3} />
                          )}
                          Додати матч
                        </button>
                        <button
                          onClick={() => decide(it, "rejected")}
                          disabled={busy}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                        >
                          <X className="size-4" />
                          Не потрібен
                        </button>
                        {!ready && (
                          <span className="text-xs text-ink-subtle">
                            Обери обидві команди, щоб додати
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    it.match_id && (
                      <a
                        href={`/admin/matches`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        {it.match_id}
                      </a>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

/** Catalog picker for one side, showing the logo once a team is chosen. */
function TeamPick({
  label,
  value,
  guessed,
  onChange,
}: {
  label: string;
  value: string;
  guessed: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/50 p-2">
      {value ? (
        <TeamLogo team={getTeam(value)} size="xs" />
      ) : (
        <span className="grid size-5 shrink-0 place-items-center rounded bg-surface-3 text-[0.625rem] font-bold text-ink-faint">
          ?
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.625rem] uppercase tracking-wide text-ink-subtle">
          {label}
          {guessed && value && <span className="ml-1 text-success">впізнано</span>}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-ink focus:outline-none"
        >
          <option value="">— обери команду —</option>
          {catalog.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
