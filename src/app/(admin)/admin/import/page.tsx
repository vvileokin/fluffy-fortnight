"use client";

import * as React from "react";
import { RefreshCw, Check, X, Loader2, DatabaseZap, ExternalLink, Plus, Trophy } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { TeamCombobox, type CatalogTeam } from "@/components/admin/TeamCombobox";
import { CreateTeamForm } from "@/components/admin/CreateTeamForm";
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
  competition: string | null;
  stage_name: string | null;
  team_a_name: string | null;
  team_a_logo: string | null;
  team_a_ps_id: number | null;
  team_b_name: string | null;
  team_b_logo: string | null;
  team_b_ps_id: number | null;
  match_id: string | null;
  suggested_a: string | null;
  suggested_b: string | null;
};

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
type Draft = { a: string; b: string; tournamentName: string; tournamentIcon: string; stage: string };

export default function ImportAdmin() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [catalog, setCatalog] = React.useState<CatalogTeam[]>([]);
  const [review, setReview] = React.useState<Review>("pending");
  const [drafts, setDrafts] = React.useState<Record<number, Draft>>({});
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [ranking, setRanking] = React.useState(false);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [creating, setCreating] = React.useState<{ psId: number; side: "a" | "b" } | null>(null);
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
    setCatalog(j.catalog as CatalogTeam[]);
    // Keep what the admin already chose, but let a team that has just become
    // recognised fill a side that was still blank.
    setDrafts((prev) =>
      Object.fromEntries(
        list.map((it) => [
          it.ps_id,
          {
            a: prev[it.ps_id]?.a || it.suggested_a || "",
            b: prev[it.ps_id]?.b || it.suggested_b || "",
            tournamentName:
              prev[it.ps_id]?.tournamentName ??
              it.competition ??
              it.serie_name ??
              it.league_name ??
              "",
            tournamentIcon: prev[it.ps_id]?.tournamentIcon ?? "",
            stage: prev[it.ps_id]?.stage ?? it.stage_name ?? "",
          },
        ]),
      ),
    );
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
        tournament_name: d?.tournamentName || null,
        tournament_icon: d?.tournamentIcon || null,
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

  /** Upload a tournament logo for one match, straight into its draft. */
  async function pickTournamentIcon(psId: number, file: File) {
    setBusyId(psId);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("folder", "tournaments");
    const res = await fetch("/api/admin/upload", { method: "POST", body }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setBusyId(null);
    if (!res?.ok) {
      setError(j?.error || "Не вдалося завантажити лого.");
      return;
    }
    setDraft(psId, { tournamentIcon: j.url as string });
  }

  /** A team just created here becomes the pick for the side it was made for. */
  function onTeamCreated(psId: number, side: "a" | "b", team: CatalogTeam) {
    setCatalog((prev) => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)));
    setDraft(psId, side === "a" ? { a: team.slug } : { b: team.slug });
    setCreating(null);
  }

  /** Refresh world ranks from Valve's Regional Standings. */
  async function syncRanks() {
    setRanking(true);
    setError(null);
    setNote(null);
    const res = await fetch("/api/admin/valve-standings", { method: "POST" }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setRanking(false);
    if (!res?.ok) {
      setError(j?.error || "Не вдалося оновити рейтинг.");
      return;
    }
    setNote(
      `Рейтинг Valve оновлено · впізнано ${j.globalMatched} з ${j.globalTotal} команд світового рейтингу`,
    );
  }

  return (
    <>
      <AdminHead title="Імпорт з PandaScore" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={sync}
          disabled={syncing}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Синхронізувати
        </button>
        <button
          onClick={syncRanks}
          disabled={ranking}
          title="Оновити світовий рейтинг команд із Valve Regional Standings"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-60"
        >
          {ranking ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
          Оновити рейтинг
        </button>
        <div className="flex gap-1 rounded-lg surface-1 p-1">
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
          <ul className="divide-y divide-[color-mix(in_oklch,var(--ink)_6%,transparent)]">
            {items.map((it) => {
              const d = drafts[it.ps_id] ?? { a: "", b: "", tournamentName: "", tournamentIcon: "", stage: "" };
              const ready = !!d.a && !!d.b && d.a !== d.b && !!d.tournamentName.trim();
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
                        {it.competition ?? it.serie_name ?? it.league_name ?? "—"}
                        {it.stage_name ? ` · ${it.stage_name}` : ""}
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
                        <TeamSide
                          label={it.team_a_name ?? "Сторона A"}
                          value={d.a}
                          catalog={catalog}
                          guessed={!!it.suggested_a && it.suggested_a === d.a}
                          onChange={(v) => setDraft(it.ps_id, { a: v })}
                          onCreate={() => setCreating({ psId: it.ps_id, side: "a" })}
                        />
                        <TeamSide
                          label={it.team_b_name ?? "Сторона B"}
                          value={d.b}
                          catalog={catalog}
                          guessed={!!it.suggested_b && it.suggested_b === d.b}
                          onChange={(v) => setDraft(it.ps_id, { b: v })}
                          onCreate={() => setCreating({ psId: it.ps_id, side: "b" })}
                        />
                      </div>

                      {creating?.psId === it.ps_id && (
                        <CreateTeamForm
                          defaultName={
                            (creating.side === "a" ? it.team_a_name : it.team_b_name) ?? ""
                          }
                          psTeamId={
                            creating.side === "a" ? it.team_a_ps_id : it.team_b_ps_id
                          }
                          onCreated={(team) => onTeamCreated(it.ps_id, creating.side, team)}
                          onCancel={() => setCreating(null)}
                        />
                      )}

                      {/* Just a name and an optional logo for the match card —
                          not a tournament page. Create one separately on the
                          Content page if this competition deserves its own listing. */}
                      <div className="flex items-center gap-2">
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2"
                          title="Лого турніру"
                        >
                          {d.tournamentIcon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.tournamentIcon} alt="" className="size-6 object-contain" />
                          ) : (
                            <DatabaseZap className="size-4 text-ink-faint" />
                          )}
                        </span>
                        <input
                          value={d.tournamentName}
                          onChange={(e) => setDraft(it.ps_id, { tournamentName: e.target.value })}
                          placeholder="Назва турніру"
                          aria-label="Назва турніру"
                          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
                        />
                        <label
                          className={cn(
                            "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink",
                            busy && "pointer-events-none opacity-50",
                          )}
                        >
                          Лого
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void pickTournamentIcon(it.ps_id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <input
                          value={d.stage}
                          onChange={(e) => setDraft(it.ps_id, { stage: e.target.value })}
                          placeholder="Стадія"
                          aria-label="Стадія"
                          className="h-9 w-32 shrink-0 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
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
                            {!d.a || !d.b
                              ? "Обери обидві команди"
                              : d.a === d.b
                                ? "Це має бути дві різні команди"
                                : "Вкажи назву турніру"}
                            , щоб додати
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

/** One side of the match: which of our teams it is, or a way to add it. */
function TeamSide({
  label,
  value,
  catalog,
  guessed,
  onChange,
  onCreate,
}: {
  label: string;
  value: string;
  catalog: CatalogTeam[];
  guessed: boolean;
  onChange: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.625rem] uppercase tracking-wide text-ink-subtle">
          {label}
          {guessed && value && <span className="ml-1 text-success">впізнано</span>}
        </span>
        {!value && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-semibold text-accent hover:underline"
          >
            <Plus className="size-3" />
            Створити
          </button>
        )}
      </div>
      <TeamCombobox teams={catalog} value={value} onChange={onChange} />
    </div>
  );
}
