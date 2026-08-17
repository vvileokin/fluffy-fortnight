import { EWC_PLAYOFFS, EWC_PLAYOFF_TEAMS } from "@/lib/ewc-bracket";
import { getTeam } from "@/lib/data";

/**
 * What backing one team through the playoff is worth.
 *
 * Mirrored nowhere in SQL: the underdog tier depends on world rank, which lives
 * in the team catalogue rather than the database, so the whole calculation is
 * done here and the RPC is handed a finished figure.
 */
export const FAVOURITE_PAYOUT: Record<string, number> = {
  ro16: 100,
  qf: 200,
  sf: 350,
  gf: 600,
};

/** 1250 if your team wins the lot, before the underdog multiplier. */
export const FAVOURITE_MAX = Object.values(FAVOURITE_PAYOUT).reduce((a, b) => a + b, 0);

/**
 * Seed bands, cheapest first.
 *
 * Without this everyone picks the world number one and the mechanic produces no
 * spread at all — a prediction every player makes identically is not a
 * prediction. Doubling the bottom band is what makes backing B8 past Spirit a
 * real position rather than a worse version of backing Spirit.
 */
export const UNDERDOG_TIERS = [
  { maxSeed: 4, multiplier: 1, label: "фаворит" },
  { maxSeed: 8, multiplier: 1.25, label: "андердог" },
  { maxSeed: 12, multiplier: 1.5, label: "андердог" },
  { maxSeed: 16, multiplier: 2, label: "темний кінь" },
] as const;

/**
 * The sixteen ranked against each other, best world rank first.
 *
 * Seeding is computed from the field rather than read off a stored order: the
 * draw is published as fixtures, not as seeds, and an unranked team sorts last
 * instead of accidentally topping the list on a rank of zero.
 */
export function playoffSeeds(): Map<string, number> {
  const ranked = [...EWC_PLAYOFF_TEAMS].sort((a, b) => {
    const ra = getTeam(a)?.worldRank || Number.MAX_SAFE_INTEGER;
    const rb = getTeam(b)?.worldRank || Number.MAX_SAFE_INTEGER;
    return ra - rb || a.localeCompare(b);
  });
  return new Map(ranked.map((slug, i) => [slug, i + 1]));
}

export type UnderdogTier = {
  seed: number;
  multiplier: number;
  label: string;
};

/** Which band a team sits in, or null if it isn't in the playoff at all. */
export function underdogTier(slug: string): UnderdogTier | null {
  const seed = playoffSeeds().get(slug);
  if (!seed) return null;
  const tier = UNDERDOG_TIERS.find((t) => seed <= t.maxSeed) ?? UNDERDOG_TIERS[0];
  return { seed, multiplier: tier.multiplier, label: tier.label };
}

/** What one win in this round pays the player who backed the winner. */
export function favouritePayout(roundId: string, teamSlug: string): number {
  const base = FAVOURITE_PAYOUT[roundId];
  if (!base) return 0;
  return Math.round(base * (underdogTier(teamSlug)?.multiplier ?? 1));
}

/**
 * Which playoff round a finished match belongs to, by the pair it was played
 * between — the same way the bracket resolves its own fixtures.
 *
 * Returns null for anything that isn't a playoff match, which is what keeps
 * group games from paying out.
 */
export function playoffRoundOf(a: string, b: string): string | null {
  const key = [a, b].sort().join("|");
  for (const round of EWC_PLAYOFFS) {
    // Only the round of 16 has fixed teams; later rounds are winner-of edges,
    // so they're matched on the stage label instead — see `roundFromStage`.
    if (round.id !== "ro16") continue;
    for (const node of round.matches) {
      if (node.a.kind !== "team" || node.b.kind !== "team") continue;
      if ([node.a.slug, node.b.slug].sort().join("|") === key) return round.id;
    }
  }
  return null;
}

/** Falls back to the admin's stage label for rounds above the round of 16. */
export function roundFromStage(stage: string | null | undefined): string | null {
  const s = (stage ?? "").toLowerCase();
  if (/1\/8|ro16|round of 16/.test(s)) return "ro16";
  if (/1\/4|quarter|чверть/.test(s)) return "qf";
  if (/1\/2|semi|півфінал/.test(s)) return "sf";
  if (/гранд|grand final|фінал/.test(s)) return "gf";
  return null;
}
