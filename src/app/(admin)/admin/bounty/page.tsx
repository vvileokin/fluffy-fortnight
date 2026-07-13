"use client";

import * as React from "react";
import { Lock, Unlock, Crosshair, Check } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { bountyStages, bountyLowSeeds, getTeam } from "@/lib/data";
import { cn } from "@/lib/utils";

export default function BountyAdmin() {
  const [locks, setLocks] = React.useState<Record<string, boolean>>(
    Object.fromEntries(bountyStages.map((s) => [s.id, s.locked])),
  );
  const [advancing, setAdvancing] = React.useState<Record<string, string[]>>({
    r2: bountyLowSeeds.slice(0, 8),
    qf: bountyLowSeeds.slice(0, 4),
  });

  const toggleLock = (id: string) =>
    setLocks((p) => ({ ...p, [id]: !p[id] }));

  const toggleTeam = (stageId: string, slug: string) =>
    setAdvancing((p) => {
      const cur = p[stageId] ?? [];
      return {
        ...p,
        [stageId]: cur.includes(slug)
          ? cur.filter((s) => s !== slug)
          : [...cur, slug],
      };
    });

  return (
    <>
      <AdminHead
        title="BLAST Bounty S2"
        subtitle="Керуй стадіями bounty: відкривай раунди та признач нижчі сіди, що пройшли далі. До відкриття команди показуються як TBD."
      />

      <div className="space-y-4">
        {bountyStages.map((s) => {
          const locked = locks[s.id];
          const teams = advancing[s.id];
          return (
            <Panel key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-accent">
                    <Crosshair className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{s.title}</p>
                    <p className="text-xs text-ink-subtle">
                      {s.pairCount} пар · до +{s.reward} · {s.phase === "lan" ? "LAN" : "онлайн"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={locked ? "warning" : "success"}>
                    {locked ? "Закрито (TBD)" : "Відкрито"}
                  </Badge>
                  <button
                    onClick={() => toggleLock(s.id)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
                      locked
                        ? "bg-accent text-accent-ink hover:bg-accent-hover"
                        : "border border-border-strong text-ink hover:bg-surface-2",
                    )}
                  >
                    {locked ? (
                      <>
                        <Unlock className="size-4" /> Відкрити
                      </>
                    ) : (
                      <>
                        <Lock className="size-4" /> Закрити
                      </>
                    )}
                  </button>
                </div>
              </div>

              {s.kind === "picks" && s.id !== "r1" && teams && (
                <div className="p-4">
                  <p className="mb-2 text-xs font-semibold text-ink-muted">
                    Нижчі сіди, що пройшли далі ({teams.length}/{s.pairCount})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bountyLowSeeds.map((slug) => {
                      const on = teams.includes(slug);
                      const team = getTeam(slug);
                      return (
                        <button
                          key={slug}
                          onClick={() => toggleTeam(s.id, slug)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-colors",
                            on
                              ? "border-accent/50 bg-accent/10 text-ink"
                              : "border-border bg-surface text-ink-muted hover:bg-surface-2",
                          )}
                        >
                          <TeamLogo team={team} size="xs" />
                          {team.tag}
                          {on && <Check className="size-3.5 text-accent" strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {s.id === "r1" && (
                <p className="px-4 py-3 text-xs text-ink-subtle">
                  Стартова стадія — усі 16 нижчих сідів пікають одразу.
                </p>
              )}
              {s.kind === "bracket" && (
                <p className="px-4 py-3 text-xs text-ink-subtle">
                  Півфінали пікаються навхрест, фінал формується системою — команди
                  підставляються автоматично після чвертьфіналів.
                </p>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
