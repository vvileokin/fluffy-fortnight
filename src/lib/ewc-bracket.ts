/**
 * EWC 2026 bracket structure.
 *
 * This file describes the *shape* of the tournament — which slot feeds which,
 * and what the fixed opening pairs are. It holds no results. Everything a
 * viewer sees (teams, times, formats, scores) comes from the matches an admin
 * creates; the bracket is a projection of that data, not a second copy of it.
 * A slot with no matching admin row simply renders TBD.
 *
 * Each group is a GSL double-elimination of eight:
 *
 *   Opening round  4 × BO1   winners rise, losers drop
 *   Upper semis    2 × BO3   winners QUALIFY, losers drop to lower semis
 *   Lower round 1  2 × BO3   losers are ELIMINATED (0-2)
 *   Lower semis    2 × BO3   winners QUALIFY, losers ELIMINATED (1-2)
 *
 * Four qualify per group: two through the upper bracket, two through the lower.
 * The lower semis cross the brackets (upper-semi loser 1 meets lower-R1 winner
 * 2, and vice versa) so a team can't meet the same opponent twice in a row.
 */

export type EwcGroupId = "a" | "b" | "c" | "d";

/** Where a slot's team comes from: a fixed seed, or the result of another match. */
export type SlotSource =
  | { kind: "team"; slug: string }
  | { kind: "winner"; of: string }
  | { kind: "loser"; of: string };

export type EwcMatchNode = {
  /** Stable id, also the key an admin match is matched against. */
  id: string;
  round: string;
  format: "BO1" | "BO3" | "BO5";
  a: SlotSource;
  b: SlotSource;
};

export type EwcGroup = {
  id: EwcGroupId;
  label: string;
  upper: { opening: EwcMatchNode[]; semis: EwcMatchNode[] };
  lower: { round1: EwcMatchNode[]; semis: EwcMatchNode[] };
};

const team = (slug: string): SlotSource => ({ kind: "team", slug });
const win = (of: string): SlotSource => ({ kind: "winner", of });
const lose = (of: string): SlotSource => ({ kind: "loser", of });

/**
 * The confirmed opening pairs. These are fixed by the organiser — never
 * generated, never re-seeded.
 */
const OPENING: Record<EwcGroupId, [string, string][]> = {
  a: [
    ["spirit", "jijiehao"],
    ["luminosity", "gamerlegion"],
    ["g2", "m80"],
    ["big", "aurora"],
  ],
  b: [
    ["falcons", "k27"],
    ["mibr", "astralis"],
    ["betboom", "faze"],
    ["nip", "legacy"],
  ],
  c: [
    ["vitality", "hundredthieves"],
    ["parivision", "b8"],
    ["fut", "tyloo"],
    ["lynn", "mouz"],
  ],
  d: [
    ["natus", "threedmax"],
    ["magic", "mongolz"],
    ["ninez", "pain"],
    ["wildcard", "furia"],
  ],
};

function buildGroup(id: EwcGroupId, label: string): EwcGroup {
  const p = `${id}`;
  const o = (n: number) => `${p}-o${n}`;
  const us = (n: number) => `${p}-us${n}`;
  const lr = (n: number) => `${p}-lr${n}`;
  const ls = (n: number) => `${p}-ls${n}`;

  const opening: EwcMatchNode[] = OPENING[id].map(([x, y], i) => ({
    id: o(i + 1),
    round: "Opening round",
    format: "BO1",
    a: team(x),
    b: team(y),
  }));

  return {
    id,
    label,
    upper: {
      opening,
      semis: [
        { id: us(1), round: "Upper semi-finals", format: "BO3", a: win(o(1)), b: win(o(2)) },
        { id: us(2), round: "Upper semi-finals", format: "BO3", a: win(o(3)), b: win(o(4)) },
      ],
    },
    lower: {
      round1: [
        { id: lr(1), round: "Lower round 1", format: "BO3", a: lose(o(1)), b: lose(o(2)) },
        { id: lr(2), round: "Lower round 1", format: "BO3", a: lose(o(3)), b: lose(o(4)) },
      ],
      // Crossed on purpose: an upper-semi loser meets the *other* half's
      // lower-round survivor, so nobody replays the match they just lost.
      semis: [
        { id: ls(1), round: "Lower semi-finals", format: "BO3", a: lose(us(1)), b: win(lr(2)) },
        { id: ls(2), round: "Lower semi-finals", format: "BO3", a: lose(us(2)), b: win(lr(1)) },
      ],
    },
  };
}

export const EWC_GROUPS: EwcGroup[] = [
  buildGroup("a", "Group A"),
  buildGroup("b", "Group B"),
  buildGroup("c", "Group C"),
  buildGroup("d", "Group D"),
];

/**
 * Playoffs — a 16-team single elimination.
 *
 * The organiser has published the seeding, so the round of 16 is fixed team
 * pairs exactly like a group's opening round. Everything above it is
 * winner-of edges, which means the ladder fills itself in as an admin resolves
 * matches — same mechanism the groups already use, no second data store.
 */
export type EwcPlayoffRound = {
  id: string;
  label: string;
  format: "BO1" | "BO3" | "BO5";
  matches: EwcMatchNode[];
};

/** The published round-of-16 draw, top to bottom. Fixed — never re-seeded. */
const PLAYOFF_RO16: [string, string][] = [
  ["g2", "astralis"],
  ["furia", "aurora"],
  ["fut", "magic"],
  ["gamerlegion", "mouz"],
  ["natus", "legacy"],
  ["falcons", "mongolz"],
  ["faze", "vitality"],
  ["b8", "spirit"],
];

const ro16: EwcMatchNode[] = PLAYOFF_RO16.map(([x, y], i) => ({
  id: `po-r${i + 1}`,
  round: "1/8 фіналу",
  format: "BO3",
  a: team(x),
  b: team(y),
}));

// Adjacent pairs feed each round, which is what makes the ladder narrow the way
// the published bracket draws it: r1/r2 meet in the top quarter, r3/r4 below it.
const quarters: EwcMatchNode[] = [0, 2, 4, 6].map((i, n) => ({
  id: `po-qf${n + 1}`,
  round: "1/4 фіналу",
  format: "BO3",
  a: win(ro16[i].id),
  b: win(ro16[i + 1].id),
}));

const semis: EwcMatchNode[] = [0, 2].map((i, n) => ({
  id: `po-sf${n + 1}`,
  round: "1/2 фіналу",
  format: "BO3",
  a: win(quarters[i].id),
  b: win(quarters[i + 1].id),
}));

const grandFinal: EwcMatchNode = {
  id: "po-gf",
  round: "Гранд фінал",
  format: "BO5",
  a: win(semis[0].id),
  b: win(semis[1].id),
};

export const EWC_PLAYOFFS: EwcPlayoffRound[] = [
  { id: "ro16", label: "1/8 фіналу", format: "BO3", matches: ro16 },
  { id: "qf", label: "1/4 фіналу", format: "BO3", matches: quarters },
  { id: "sf", label: "1/2 фіналу", format: "BO3", matches: semis },
  { id: "gf", label: "Гранд фінал", format: "BO5", matches: [grandFinal] },
];

/** The sixteen in the playoff draw, in bracket order. */
export const EWC_PLAYOFF_TEAMS: string[] = PLAYOFF_RO16.flat();

/** All node ids in a group, in bracket order — used to look up admin matches. */
export function groupNodes(g: EwcGroup): EwcMatchNode[] {
  return [...g.upper.opening, ...g.upper.semis, ...g.lower.round1, ...g.lower.semis];
}

/** Every playoff node, shallowest round first — feeders before their consumers. */
export function playoffNodes(): EwcMatchNode[] {
  return EWC_PLAYOFFS.flatMap((r) => r.matches);
}
