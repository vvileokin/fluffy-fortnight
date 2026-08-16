/**
 * The ten-day login ladder.
 *
 * Kept next to nothing else on purpose: the same array is the source of truth
 * for the modal, the API and the reward itself, and it is mirrored in migration
 * 0037 because the payout has to be decided server-side. If one ever changes,
 * change both — the migration is what actually pays.
 */
export const DAILY_REWARDS = [50, 100, 150, 200, 300, 400, 500, 600, 700, 800] as const;

export const DAILY_CYCLE = DAILY_REWARDS.length;

/** Which gem tier a day's reward wears. Denser pile, bigger number. */
export function dailyIcon(day: number): "points" | "points-stack" | "points-pile" {
  if (day >= 8) return "points-pile";
  if (day >= 4) return "points-stack";
  return "points";
}

/** Kyiv's calendar date, the one the payout function counts days by. */
export function kyivToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type DailyState = {
  /** Ladder position the next claim will land on, 1-10. */
  nextDay: number;
  /** Whether today's reward is still unclaimed. */
  available: boolean;
  /** What the next claim pays. */
  amount: number;
};

/**
 * Work out where a player stands without asking the database to decide.
 *
 * Mirrors `claim_daily_reward`: a consecutive day advances the ladder, any gap
 * restarts it, and day 10 wraps to 1. The function is still the authority —
 * this only shapes what the modal shows before anyone taps anything.
 */
export function dailyState(
  claimedOn: string | null,
  day: number,
  now: Date = new Date(),
): DailyState {
  const today = kyivToday(now);
  if (claimedOn === today) {
    return { nextDay: day, available: false, amount: DAILY_REWARDS[day - 1] ?? 0 };
  }

  const yesterday = kyivToday(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const consecutive = claimedOn === yesterday && day >= 1 && day < DAILY_CYCLE;
  const nextDay = consecutive ? day + 1 : 1;

  return { nextDay, available: true, amount: DAILY_REWARDS[nextDay - 1] };
}
