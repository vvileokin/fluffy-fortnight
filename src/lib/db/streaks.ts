import { fetchAllRows } from "@/lib/db/paginate";

type Admin = {
  from: (t: string) => {
    select: (c: string) => {
      in: (col: string, v: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
      order: (col: string, o: { ascending: boolean }) => {
        range: (f: number, t: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
      };
    };
    update: (v: Record<string, number>) => {
      eq: (col: string, v: string) => PromiseLike<{ error: unknown }>;
    };
  };
};

type QRow = { id: string; match_id: string };
type ResRow = { question_id: string; correct_option_id: string };
type PredRow = { user_id: string; question_id: string; option_id: string };
type MatchRow = { id: string; is_event: boolean | null; start_at: string | null };

/**
 * Recompute streaks from scratch for the given users.
 *
 * A streak is a run of flawless matches: a match where every prediction the
 * player made was right extends it by that many answers; a single wrong answer
 * anywhere in the match resets it to zero. Matches are replayed in the order
 * they were played. Bounty draft pairs never take part — only match
 * predictions do — and `bounty_streak` replays BLAST event matches alone.
 *
 * Recomputing (rather than incrementing per question) is what makes the rule
 * hold: questions of one match are resolved one at a time, so an incremental
 * counter would depend on the order the admin happened to click them.
 */
export async function recomputeStreaks(admin: unknown, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const db = admin as Admin;

  const { rows: results } = await fetchAllRows<ResRow>((f, t) =>
    db
      .from("question_results")
      .select("question_id, correct_option_id")
      .order("question_id", { ascending: true })
      .range(f, t) as PromiseLike<{ data: ResRow[] | null; error: unknown }>,
  );
  if (results.length === 0) return;

  const { rows: questions } = await fetchAllRows<QRow>((f, t) =>
    db.from("questions").select("id, match_id").order("id", { ascending: true }).range(f, t) as PromiseLike<{
      data: QRow[] | null;
      error: unknown;
    }>,
  );
  const { rows: matches } = await fetchAllRows<MatchRow>((f, t) =>
    db
      .from("matches")
      .select("id, is_event, start_at")
      .order("id", { ascending: true })
      .range(f, t) as PromiseLike<{ data: MatchRow[] | null; error: unknown }>,
  );
  const { rows: preds } = await fetchAllRows<PredRow>((f, t) =>
    db
      .from("predictions")
      .select("user_id, question_id, option_id")
      .order("user_id", { ascending: true })
      .range(f, t) as PromiseLike<{ data: PredRow[] | null; error: unknown }>,
  );

  const correctOf = new Map(results.map((r) => [r.question_id, r.correct_option_id]));
  const matchOf = new Map(questions.map((q) => [q.id, q.match_id]));
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const wanted = new Set(userIds);

  // user -> match -> list of hit/miss for resolved questions they answered
  const byUser = new Map<string, Map<string, boolean[]>>();
  for (const p of preds) {
    if (!wanted.has(p.user_id)) continue;
    const answer = correctOf.get(p.question_id);
    if (!answer) continue; // question not resolved yet
    const matchId = matchOf.get(p.question_id);
    if (!matchId) continue; // question deleted
    let perMatch = byUser.get(p.user_id);
    if (!perMatch) byUser.set(p.user_id, (perMatch = new Map()));
    const list = perMatch.get(matchId) ?? [];
    list.push(p.option_id === answer);
    perMatch.set(matchId, list);
  }

  const playedAt = (id: string) => matchById.get(id)?.start_at ?? "";
  // Returns the run the player is on now and the longest one they ever put
  // together. The record falls out of the same replay for free — and because
  // the replay covers their whole resolved history, it is a true all-time
  // best, not "the best since we started recording".
  const replay = (perMatch: Map<string, boolean[]>, eventOnly: boolean) => {
    const ids = [...perMatch.keys()]
      .filter((id) => (eventOnly ? !!matchById.get(id)?.is_event : true))
      .sort((a, b) => playedAt(a).localeCompare(playedAt(b)) || a.localeCompare(b));
    let streak = 0;
    let best = 0;
    for (const id of ids) {
      const outcomes = perMatch.get(id)!;
      streak = outcomes.every(Boolean) ? streak + outcomes.length : 0;
      if (streak > best) best = streak;
    }
    return { streak, best };
  };

  // `best_streak` arrives with migration 0039. Until it runs, writing it fails
  // the whole update — which would take the current streak down with it and,
  // since this runs inside resolve, quietly stop settling matches from
  // recording streaks at all. One probe decides for the whole batch rather than
  // a failed round trip per player.
  let hasRecord = true;

  for (const userId of userIds) {
    const perMatch = byUser.get(userId) ?? new Map<string, boolean[]>();
    const all = replay(perMatch, false);
    const bounty = replay(perMatch, true);
    const base = { streak: all.streak, bounty_streak: bounty.streak };

    if (hasRecord) {
      const { error } = await db
        .from("profiles")
        .update({ ...base, best_streak: all.best })
        .eq("id", userId);
      if (!error) continue;
      const code = (error as { code?: string })?.code;
      if (code !== "42703" && code !== "PGRST204") throw error;
      hasRecord = false;
      console.error("[streaks] best_streak missing — run migration 0039");
    }

    await db.from("profiles").update(base).eq("id", userId);
  }
}
