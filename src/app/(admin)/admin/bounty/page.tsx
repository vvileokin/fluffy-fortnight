"use client";

import * as React from "react";
import { Lock, Unlock, Check, Loader2, Crown } from "lucide-react";
import { BlastMark } from "@/components/ui/BlastMark";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { bountyStages, teams, getTeam } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const catalog = Object.values(teams).sort((a, b) => a.name.localeCompare(b.name));

type StageState = {
  teams: string[];
  lowSeeds: string[];
  winners: string[];
  locked: boolean;
  deadline: string; // datetime-local value
};

function emptyState(): StageState {
  return { teams: [], lowSeeds: [], winners: [], locked: false, deadline: "" };
}

function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BountyAdmin() {
  const [state, setState] = React.useState<Record<string, StageState>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [savedId, setSavedId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await createClient().from("bounty_stages").select("*");
    const next: Record<string, StageState> = {};
    for (const s of bountyStages) next[s.id] = emptyState();
    for (const r of data ?? []) {
      next[r.stage_id] = {
        teams: Array.isArray(r.teams) ? r.teams : [],
        lowSeeds: Array.isArray(r.low_seeds) ? r.low_seeds : [],
        winners: Array.isArray(r.winners) ? r.winners : [],
        locked: !!r.locked,
        deadline: isoToLocal(r.deadline),
      };
    }
    setState(next);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const upd = (id: string, patch: Partial<StageState>) =>
    setState((p) => ({ ...p, [id]: { ...(p[id] ?? emptyState()), ...patch } }));

  function toggleTeam(id: string, slug: string) {
    const s = state[id] ?? emptyState();
    if (s.teams.includes(slug)) {
      upd(id, {
        teams: s.teams.filter((x) => x !== slug),
        lowSeeds: s.lowSeeds.filter((x) => x !== slug),
        winners: s.winners.filter((x) => x !== slug),
      });
    } else {
      upd(id, { teams: [...s.teams, slug] });
    }
  }

  function toggleIn(id: string, key: "lowSeeds" | "winners", slug: string) {
    const s = state[id] ?? emptyState();
    const cur = s[key];
    upd(id, { [key]: cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug] } as Partial<StageState>);
  }

  async function save(id: string) {
    const s = state[id];
    if (!s) return;
    setSaving(id);
    const res = await fetch("/api/admin/bounty", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stage_id: id,
        teams: s.teams,
        low_seeds: s.lowSeeds,
        winners: s.winners,
        locked: s.locked,
        deadline: s.deadline ? new Date(s.deadline).toISOString() : null,
      }),
    });
    setSaving(null);
    if (res.ok) {
      setSavedId(id);
      window.setTimeout(() => setSavedId((c) => (c === id ? null : c)), 1400);
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Помилка збереження");
    }
  }

  return (
    <>
      <AdminHead
        title="BLAST Bounty S2"
        subtitle="Для кожної стадії обери команди з каталогу, познач нижчі сіди (решта — вищі), постав дедлайн і відкрий/закрий прийом. Фінал збирається з переможців півфіналів."
      />

      <div className="space-y-4">
        {bountyStages.map((meta) => {
          const s = state[meta.id] ?? emptyState();
          const expected = meta.kind === "bracket" ? 4 : meta.pairCount * 2;
          const isBracket = meta.kind === "bracket";
          const isSaving = saving === meta.id;
          const finalists = s.winners.slice(0, 2).map(getTeam);
          return (
            <Panel key={meta.id}>
              {/* Stage header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-accent">
                    <BlastMark className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{meta.title}</p>
                    <p className="text-xs text-ink-subtle">
                      Команд: {s.teams.length}/{expected} · до +{meta.reward}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={s.deadline}
                    onChange={(e) => upd(meta.id, { deadline: e.target.value })}
                    className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={() => upd(meta.id, { locked: !s.locked })}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
                      s.locked
                        ? "bg-accent text-accent-ink hover:bg-accent-hover"
                        : "border border-border-strong text-ink hover:bg-surface-2",
                    )}
                  >
                    {s.locked ? <><Unlock className="size-4" /> Відкрити</> : <><Lock className="size-4" /> Закрити</>}
                  </button>
                  <button
                    onClick={() => save(meta.id)}
                    disabled={isSaving}
                    className="inline-flex h-9 min-w-24 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : savedId === meta.id ? <><Check className="size-4" strokeWidth={3} /> ОК</> : "Зберегти"}
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <Badge tone={s.locked ? "warning" : "success"}>
                  {s.locked ? "Закрито (TBD для гравців)" : "Відкрито для прогнозів"}
                </Badge>

                {/* Team catalog picker */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-ink-muted">
                    Команди стадії — клікни, щоб додати/прибрати
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.map((t) => {
                      const on = s.teams.includes(t.slug);
                      return (
                        <button
                          key={t.slug}
                          onClick={() => toggleTeam(meta.id, t.slug)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                            on
                              ? "border-accent/50 bg-accent/10 text-ink"
                              : "border-border bg-surface text-ink-muted hover:bg-surface-2",
                          )}
                        >
                          <TeamLogo team={t} size="xs" />
                          {t.tag}
                          {on && <Check className="size-3 text-accent" strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected teams — seed + winner controls */}
                {s.teams.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-muted">
                      <span>Команди у стадії ({s.teams.length})</span>
                      <span className="text-ink-subtle">
                        {isBracket ? "познач 2 переможців півфіналів → фінал" : "познач нижчі сіди (решта — вищі)"}
                      </span>
                    </div>
                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {s.teams.map((slug) => {
                        const t = getTeam(slug);
                        const low = s.lowSeeds.includes(slug);
                        const won = s.winners.includes(slug);
                        return (
                          <div key={slug} className="flex items-center gap-3 px-3 py-2">
                            <TeamLogo team={t} size="xs" />
                            <span className="flex-1 truncate text-sm font-semibold text-ink">{t.name}</span>
                            {!isBracket && (
                              <button
                                onClick={() => toggleIn(meta.id, "lowSeeds", slug)}
                                className={cn(
                                  "rounded-md border px-2 py-1 text-[0.6875rem] font-semibold transition-colors",
                                  low ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-ink-subtle hover:bg-surface-2",
                                )}
                              >
                                {low ? "нижчий сід" : "вищий сід"}
                              </button>
                            )}
                            <button
                              onClick={() => toggleIn(meta.id, "winners", slug)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[0.6875rem] font-semibold transition-colors",
                                won ? "border-success/50 bg-success/15 text-success" : "border-border text-ink-subtle hover:bg-surface-2",
                              )}
                            >
                              {won && <Crown className="size-3" />} пройшов далі
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Final preview for the bracket stage */}
                {isBracket && finalists.length > 0 && (
                  <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-2.5">
                    <Crown className="size-5 text-accent" />
                    <div className="min-w-0">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-subtle">Гранд-фінал</p>
                      <p className="truncate text-sm font-bold text-ink">
                        {finalists.map((t) => t.name).join(" vs ")}
                        {finalists.length < 2 && " · очікує 2-го переможця"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
