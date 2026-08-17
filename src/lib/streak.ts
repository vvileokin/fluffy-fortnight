/**
 * What a streak is worth.
 *
 * Mirrored in migration 0039, which is what actually pays — change both.
 *
 * A ladder rather than a single cliff at ten. A cliff reads well on paper and
 * is dead in practice: almost nobody reaches ten, so for almost everybody the
 * mechanic would never once fire and the number on their profile would mean
 * nothing. Steps at three and five put the first reward inside a normal good
 * week, which is what makes the tenth worth chasing at all.
 */
export const STREAK_TIERS = [
  { at: 10, multiplier: 2 },
  { at: 5, multiplier: 1.5 },
  { at: 3, multiplier: 1.25 },
] as const;

/**
 * The multiplier a player carries into their next match.
 *
 * Read from the streak *going in*, not the one they leave with: the reward for
 * a match has to be knowable while the match is still open, or the player is
 * betting on a number nobody has shown them.
 */
export function streakMultiplier(streak: number): number {
  for (const tier of STREAK_TIERS) {
    if (streak >= tier.at) return tier.multiplier;
  }
  return 1;
}

/** What a reward pays at this streak. Rounded, so the ×1.25 tier isn't lost. */
export function applyStreak(reward: number, streak: number): number {
  return Math.round(reward * streakMultiplier(streak));
}

/** How many more in a row before the multiplier goes up. Null at the top. */
export function nextStreakTier(
  streak: number,
): { at: number; multiplier: number; away: number } | null {
  // Ascending, so the first tier still ahead of the player is the next one.
  for (const tier of [...STREAK_TIERS].reverse()) {
    if (streak < tier.at) return { ...tier, away: tier.at - streak };
  }
  return null;
}
