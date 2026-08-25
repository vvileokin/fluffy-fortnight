"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  PORTO_GROUPS,
  PORTO_PLAYOFFS,
  portoGroupNodes,
  type BracketGroup,
  type PortoPlayoffSlot,
} from "@/lib/porto-bracket";
import type { EwcMatchNode } from "@/lib/ewc-bracket";
import { type Match } from "@/lib/data";
import {
  BracketMatch,
  Column,
  resolveSlot,
  type Resolved,
} from "@/components/tournament/BracketParts";
import { cn } from "@/lib/utils";

/**
 * Impeccable: Crafted Porto Ladder — the event's bracket, drawn from its own
 * fixtures.
 *
 * Same principle as the World Cup's: this is a *view* of the matches an admin
 * created, never a second copy of them. `src/lib/porto-bracket.ts` says which
 * slot feeds which; every team, time, format and score is read off a real
 * fixture, and a slot with none renders TBD.
 *
 * Two things differ from EWC, and both come out of the format.
 *
 * A group runs one round deeper on each side — three qualify out of eight
 * rather than four, so there is an upper final and a lower final where EWC's
 * groups simply ended. Columns are a list here rather than named fields, which
 * is what lets one renderer draw both depths.
 *
 * And the playoff cannot be matched by team pair. EWC published its round of
 * 16, so those fixtures resolved themselves; Porto's six qualifiers are unknown
 * until the groups finish, so there is nothing to match against. Those slots
 * are filled by `stage` and start order instead, and until a fixture exists
 * they say in words what will fill them.
 */

function useResolver(matches: Match[]) {
  return React.useMemo(() => {
    // Group fixtures only. A playoff match between two teams who also met in
    // their group would otherwise drop its result into the group slot — two
    // teams meeting twice in one tournament is normal, so a pair of slugs is
    // not an identity, and the stage is what separates them.
    const byPair = new Map<string, Match>();
    for (const m of matches) {
      if (/^Group /i.test(m.stage ?? "")) {
        byPair.set([m.a, m.b].sort().join("|"), m);
      }
    }

    const byNode = new Map<string, Match>();
    const nodes = PORTO_GROUPS.flatMap(portoGroupNodes);
    // One pass per round: the first fills the opening fixtures, whose teams are
    // already known, and each later pass uses those results to resolve the
    // round above it. A group is four deep on the lower side.
    for (let pass = 0; pass < 5; pass++) {
      for (const node of nodes) {
        if (byNode.has(node.id)) continue;
        const a = resolveSlot(node.a, byNode);
        const b = resolveSlot(node.b, byNode);
        if (!a || !b) continue;
        const found = byPair.get([a, b].sort().join("|"));
        if (found) byNode.set(node.id, found);
      }
    }

    return (node: EwcMatchNode): Resolved => ({
      node,
      match: byNode.get(node.id),
      a: resolveSlot(node.a, byNode),
      b: resolveSlot(node.b, byNode),
    });
  }, [matches]);
}

/** Playoff fixtures indexed by stage, each list in the order they are played. */
function usePlayoffByStage(matches: Match[]) {
  return React.useMemo(() => {
    const byStage = new Map<string, Match[]>();
    for (const m of matches) {
      const stage = (m.stage ?? "").trim();
      if (!stage || /^Group /i.test(stage)) continue;
      const list = byStage.get(stage) ?? [];
      list.push(m);
      byStage.set(stage, list);
    }
    for (const list of byStage.values()) {
      list.sort((x, y) => (x.startISO ?? "").localeCompare(y.startISO ?? ""));
    }
    return byStage;
  }, [matches]);
}

function GroupPanel({
  group,
  resolve,
  defaultOpen,
}: {
  group: BracketGroup;
  resolve: (n: EwcMatchNode) => Resolved;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="skin-aura-card overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-extrabold tracking-tight text-white">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-white/45 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-5 px-4 pb-4">
          {(
            [
              ["Upper Bracket", group.upper],
              ["Lower Bracket", group.lower],
            ] as const
          ).map(([label, columns]) => (
            <div key={label}>
              <p className="mb-2.5 text-xs font-bold text-white/70">{label}</p>
              <div className="no-scrollbar flex gap-4 overflow-x-auto">
                {columns.map((col) => (
                  // A final holds one card against columns of four, so it
                  // centres in its own height instead of hanging at the top
                  // where the ladder has visibly stopped feeding it.
                  <Column
                    key={col.title}
                    title={col.title}
                    spread={col.nodes.length === 1}
                  >
                    {col.nodes.map((n) => (
                      <BracketMatch key={n.id} r={resolve(n)} />
                    ))}
                  </Column>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A playoff slot: the real fixture if one exists, otherwise what will fill it. */
function PlayoffSlot({ slot, match }: { slot: PortoPlayoffSlot; match?: Match }) {
  if (match) {
    return (
      <BracketMatch
        r={{
          node: {
            id: slot.id,
            round: slot.stage,
            format: slot.format,
            a: { kind: "team", slug: match.a },
            b: { kind: "team", slug: match.b },
          },
          match,
          a: match.a,
          b: match.b,
        }}
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg bg-black/35 shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.18)]">
      <div className="flex items-center justify-between gap-2 bg-white/[0.04] px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-white/45">
        <span>TBD</span>
        <span>{slot.format}</span>
      </div>
      <div className="[&>*+*]:shadow-[0_-1px_0_0_rgb(255_255_255/0.07)]">
        {slot.from.map((label, i) => (
          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="grid size-5 shrink-0 place-items-center rounded bg-white/5 text-[0.625rem] font-bold text-white/30">
              ?
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-white/40">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayoffsPanel({ byStage }: { byStage: Map<string, Match[]> }) {
  const [open, setOpen] = React.useState(true);
  // Which fixture of its stage each slot takes, counted as the rounds are read.
  const used = new Map<string, number>();
  return (
    <div className="skin-aura-card overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-extrabold tracking-tight text-white">
          Плей-оф · Super Bock Arena
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-white/45 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-4">
          {PORTO_PLAYOFFS.map((round) => (
            <Column key={round.id} title={round.label} spread>
              {round.slots.map((slot) => {
                const n = used.get(slot.stage) ?? 0;
                used.set(slot.stage, n + 1);
                return (
                  <PlayoffSlot
                    key={slot.id}
                    slot={slot}
                    match={byStage.get(slot.stage)?.[n]}
                  />
                );
              })}
            </Column>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortoBracket({ matches }: { matches: Match[] }) {
  const resolve = useResolver(matches);
  const byStage = usePlayoffByStage(matches);
  return (
    <div className="space-y-3">
      {PORTO_GROUPS.map((g, i) => (
        <GroupPanel key={g.id} group={g} resolve={resolve} defaultOpen={i === 0} />
      ))}
      <PlayoffsPanel byStage={byStage} />
    </div>
  );
}
