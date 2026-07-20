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
  const replay = (perMatch: Map<string, boolean[]>, eventOnly: boolean) => {
    const ids = [...perMatch.keys()]
      .filter((id) => (eventOnly ? !!matchById.get(id)?.is_event : true))
      .sort((a, b) => playedAt(a).localeCompare(playedAt(b)) || a.localeCompare(b));
    let streak = 0;
    for (const id of ids) {
      const outcomes = perMatch.get(id)!;
      streak = outcomes.every(Boolean) ? streak + outcomes.length : 0;
    }
    return streak;
  };

  for (const userId of userIds) {
    const perMatch = byUser.get(userId) ?? new Map<string, boolean[]>();
    await db
      .from("profiles")
      .update({ streak: replay(perMatch, false), bounty_streak: replay(perMatch, true) })
      .eq("id", userId);
  }
}
