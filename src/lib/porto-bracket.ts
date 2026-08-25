/**
 * BLAST Open Porto 2026 bracket structure.
 *
 * Like the EWC one, this describes *shape* only — which slot feeds which. It
 * holds no results: every team, time, format and score a viewer reads comes
 * off a match an admin created, and a slot with no match renders TBD.
 *
 * Two GSL groups of eight, every match BO3, three qualifying from each:
 *
 *   Opening round   4 × BO3   winners rise, losers drop
 *   Upper semis     2 × BO3   winners go to the upper final
 *   Upper final     1 × BO3   winner QUALIFIES 1st, loser QUALIFIES 2nd
 *   Lower round 1   2 × BO3   losers are ELIMINATED (0-2)
 *   Lower semis     2 × BO3   losers are ELIMINATED
 *   Lower final     1 × BO3   winner QUALIFIES 3rd, loser is ELIMINATED
 *
 * That is the shape difference from EWC, where four qualified out of eight and
 * the group therefore ended at the semi-finals with no final on either side.
 */

import type { EwcMatchNode, SlotSource } from "@/lib/ewc-bracket";

const team = (slug: string): SlotSource => ({ kind: "team", slug });
const win = (of: string): SlotSource => ({ kind: "winner", of });
const lose = (of: string): SlotSource => ({ kind: "loser", of });

/** A group drawn as columns rather than fixed round names, so a bracket with
 *  an extra round needs no new field — only another column. */
export type BracketColumn = { title: string; nodes: EwcMatchNode[] };

export type BracketGroup = {
  id: string;
  label: string;
  upper: BracketColumn[];
  lower: BracketColumn[];
};

/** The published opening pairs. Fixed by the organiser — never generated. */
const OPENING: Record<string, [string, string][]> = {
  a: [
    ["aurora", "g2"],
    ["spirit", "sharks"],
    ["natus", "m80"],
    ["furia", "pain"],
  ],
  b: [
    ["vitality", "innercircle"],
    ["mouz", "ninez"],
    ["legacy", "fut"],
    ["falcons", "lynn"],
  ],
};

function buildGroup(id: string, label: string): BracketGroup {
  const o = (n: number) => `p${id}-o${n}`;
  const us = (n: number) => `p${id}-us${n}`;
  const lr = (n: number) => `p${id}-lr${n}`;
  const ls = (n: number) => `p${id}-ls${n}`;
  const uf = `p${id}-uf`;
  const lf = `p${id}-lf`;

  const opening: EwcMatchNode[] = OPENING[id].map(([x, y], i) => ({
    id: o(i + 1),
    round: "Opening round",
    format: "BO3",
    a: team(x),
    b: team(y),
  }));

  return {
    id,
    label,
    upper: [
      { title: "Opening round", nodes: opening },
      {
        title: "Upper semi-finals",
        nodes: [
          { id: us(1), round: "Upper semi-finals", format: "BO3", a: win(o(1)), b: win(o(2)) },
          { id: us(2), round: "Upper semi-finals", format: "BO3", a: win(o(3)), b: win(o(4)) },
        ],
      },
      {
        title: "Upper final",
        nodes: [
          { id: uf, round: "Upper final", format: "BO3", a: win(us(1)), b: win(us(2)) },
        ],
      },
    ],
    lower: [
      {
        title: "Lower round 1",
        nodes: [
          { id: lr(1), round: "Lower round 1", format: "BO3", a: lose(o(1)), b: lose(o(2)) },
          { id: lr(2), round: "Lower round 1", format: "BO3", a: lose(o(3)), b: lose(o(4)) },
        ],
      },
      {
        // Crossed on purpose: an upper-semi loser meets the *other* half's
        // lower-round survivor, so nobody replays the match they just lost.
        title: "Lower semi-finals",
        nodes: [
          { id: ls(1), round: "Lower semi-finals", format: "BO3", a: lose(us(1)), b: win(lr(2)) },
          { id: ls(2), round: "Lower semi-finals", format: "BO3", a: lose(us(2)), b: win(lr(1)) },
        ],
      },
      {
        title: "Lower final",
        nodes: [
          { id: lf, round: "Lower final", format: "BO3", a: win(ls(1)), b: win(ls(2)) },
        ],
      },
    ],
  };
}

export const PORTO_GROUPS: BracketGroup[] = [
  buildGroup("a", "Group A"),
  buildGroup("b", "Group B"),
];

/**
 * The playoff, and why it is matched differently.
 *
 * Six teams: both group winners are seeded straight into the semi-finals and
 * the four runners-up play the quarters. None of those pairings exist until the
 * groups finish, so unlike EWC's published round of 16 there are no fixed team
 * pairs to match a fixture against — the slots stand empty and are filled by
 * stage instead. `stage` plus start order is the identity here; the resolver
 * pairs the tournament's own quarter-finals, semi-finals and grand final into
 * these slots in the order they are played.
 */
export type PortoPlayoffSlot = {
  id: string;
  /** Matched against `Match.stage`. */
  stage: string;
  format: "BO3" | "BO5";
  /** What fills the slot, said in words, until a fixture exists. */
  from: [string, string];
};

export type PortoPlayoffRound = {
  id: string;
  label: string;
  slots: PortoPlayoffSlot[];
};

export const PORTO_PLAYOFFS: PortoPlayoffRound[] = [
  {
    id: "qf",
    label: "1/4 фіналу",
    slots: [
      { id: "pp-qf1", stage: "1/4 фіналу", format: "BO3", from: ["2-ге · Група A", "3-тє · Група B"] },
      { id: "pp-qf2", stage: "1/4 фіналу", format: "BO3", from: ["2-ге · Група B", "3-тє · Група A"] },
    ],
  },
  {
    id: "sf",
    label: "1/2 фіналу",
    slots: [
      { id: "pp-sf1", stage: "1/2 фіналу", format: "BO3", from: ["1-ше · Група A", "Переможець 1/4"] },
      { id: "pp-sf2", stage: "1/2 фіналу", format: "BO3", from: ["1-ше · Група B", "Переможець 1/4"] },
    ],
  },
  {
    id: "gf",
    label: "Гранд фінал",
    slots: [
      { id: "pp-gf", stage: "Гранд фінал", format: "BO5", from: ["Переможець 1/2", "Переможець 1/2"] },
    ],
  },
];

/** Every node in a group, in bracket order — used to resolve slots. */
export function portoGroupNodes(g: BracketGroup): EwcMatchNode[] {
  return [...g.upper.flatMap((c) => c.nodes), ...g.lower.flatMap((c) => c.nodes)];
}

/** The sixteen at Porto, in group order. */
export const PORTO_TEAMS: string[] = [
  ...OPENING.a.flat(),
  ...OPENING.b.flat(),
];

/** The only stage labels a Porto match may carry. */
export const PORTO_STAGES = [
  "Group A",
  "Group B",
  "1/4 фіналу",
  "1/2 фіналу",
  "Гранд фінал",
] as const;
