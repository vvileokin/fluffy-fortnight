import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/db/paginate";
import { rankByPoints, type LeaderRow } from "@/lib/data";

/** Season leaderboard from real profiles. Empty when there are none. */
export async function getLeaderboard(limit = 50): Promise<LeaderRow[]> {
  try {
    const sb = await createClient();
    // The rows don't depend on who's asking — only the "isYou" flag does.
    const [
      {
        data: { user },
      },
      { data, error },
    ] = await Promise.all([
      sb.auth.getUser(),
      sb
        .from("profiles")
        .select("id, handle, avatar_url, points, correct, streak")
        .order("points", { ascending: false })
        .order("correct", { ascending: false })
        .limit(limit),
    ]);
    if (error || !data) return [];

    const rows: LeaderRow[] = rankByPoints(
      data.map((p) => ({
        handle: p.handle,
        points: p.points,
        correct: p.correct,
        streak: p.streak,
        avatarUrl: p.avatar_url ?? undefined,
        isYou: user?.id === p.id,
      })),
    );

    // Rank far below the slice? Append your own row so the board can still show
    // where you stand — otherwise you simply vanish from every collapsed board.
    if (user && !rows.some((r) => r.isYou)) {
      const mine = await ownRow(sb, user.id);
      if (mine) rows.push(mine);
    }
    return rows;
  } catch {
    return [];
  }
}

type SB = Awaited<ReturnType<typeof createClient>>;

/**
 * The signed-in user's own row with its true season rank. The rank can't come
 * from the fetched slice — it's counted across every profile, the same way the
 * profile page does it, including the tie span ("100–101").
 */
async function ownRow(sb: SB, userId: string): Promise<LeaderRow | null> {
  const { data: me } = await sb
    .from("profiles")
    .select("handle, avatar_url, points, correct, streak")
    .eq("id", userId)
    .maybeSingle();
  if (!me) return null;

  const [{ count: above }, { count: same }] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }).gt("points", me.points),
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("points", me.points),
  ]);
  const rank = (above ?? 0) + 1;

  return {
    rank,
    rankEnd: rank + Math.max(0, (same ?? 1) - 1),
    handle: me.handle,
    points: me.points,
    correct: me.correct,
    streak: me.streak,
    avatarUrl: me.avatar_url ?? undefined,
    isYou: true,
  };
}

type BountyRow = {
  id: string;
  handle: string;
  avatar_url: string | null;
  bounty_points: number | null;
  bounty_correct?: number | null;
  bounty_streak?: number | null;
};

/** Leaderboard limited to users who actually made bounty predictions. */
export async function getBountyLeaderboard(limit = 50): Promise<LeaderRow[]> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    // bounty_picks is RLS-scoped to each user, so enumerate participants with
    // the service-role client — otherwise we'd only ever see our own row. Page
    // through it too: past 1000 picks a plain read would drop participants.
    const admin = createAdminClient();
    const { rows: picks } = await fetchAllRows<{ user_id: string }>((from, to) =>
      admin.from("bounty_picks").select("user_id").order("id", { ascending: true }).range(from, to),
    );
    const ids = [...new Set(picks.map((p) => p.user_id))];
    if (ids.length === 0) return [];

    // Prefer the bounty stat columns, but if the migration that adds them isn't
    // applied yet, fall back so participants still show (just with zeroed stats)
    // instead of the whole board vanishing.
    const full = await sb
      .from("profiles")
      .select("id, handle, avatar_url, bounty_points, bounty_correct, bounty_streak")
      .in("id", ids);
    const rows: BountyRow[] = full.error
      ? ((
          await sb
            .from("profiles")
            .select("id, handle, avatar_url, bounty_points")
            .in("id", ids)
        ).data ?? [])
      : (full.data ?? []);

    // Everything here is bounty-only: points, correct answers (match predictions
    // + draft pairs) and a streak fed by BLAST match predictions alone.
    const ranked = rankByPoints(
      rows.map((p) => ({
        handle: p.handle,
        points: p.bounty_points ?? 0,
        correct: p.bounty_correct ?? 0,
        streak: p.bounty_streak ?? 0,
        avatarUrl: p.avatar_url ?? undefined,
        isYou: user?.id === p.id,
      })),
    );
    return ranked
      .sort((a, b) => a.rank - b.rank || b.correct - a.correct)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Esports World Cup board.
 *
 * Unlike the bounty, EWC has no draft to enumerate participants from, so the
 * field is simply everyone who has scored at this event. `streak` is returned
 * as 0 on purpose: a streak belongs to the player across the whole season, not
 * to one tournament, so the event board doesn't carry one and the column is
 * hidden at the call site.
 */
export async function getEwcLeaderboard(limit = 50): Promise<LeaderRow[]> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    const { data, error } = await sb
      .from("profiles")
      .select("id, handle, avatar_url, ewc_points, ewc_correct")
      .gt("ewc_points", 0)
      .order("ewc_points", { ascending: false })
      .limit(Math.max(limit, 200));
    // Pre-migration the columns don't exist; an empty board is the right
    // answer then, not a crash.
    if (error || !data) return [];

    const ranked = rankByPoints(
      data.map((p) => ({
        handle: p.handle as string,
        points: (p.ewc_points as number) ?? 0,
        correct: (p.ewc_correct as number) ?? 0,
        streak: 0,
        avatarUrl: (p.avatar_url as string) ?? undefined,
        isYou: user?.id === p.id,
      })),
    );
    return ranked
      .sort((a, b) => a.rank - b.rank || b.correct - a.correct)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * The running event's board.
 *
 * Same shape as the World Cup one and for the same reason — there is no draft
 * to enumerate a field from, so the field is everyone who has scored at the
 * event. `> 0` is what makes it a board of participants rather than a roll of
 * the whole site: an account that has not played the event has nothing to rank.
 *
 * `streak` comes back 0 deliberately. A streak belongs to a player across the
 * season, not to one tournament, so the event board carries no column for it.
 */
export async function getEventLeaderboard(limit = 50): Promise<LeaderRow[]> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    const { data, error } = await sb
      .from("profiles")
      .select("id, handle, avatar_url, event_points")
      .gt("event_points", 0)
      .order("event_points", { ascending: false })
      .limit(Math.max(limit, 200));
    // Pre-migration the column doesn't exist; an empty board is the right
    // answer then, not a crash.
    if (error || !data) return [];

    const ranked = rankByPoints(
      data.map((p) => ({
        handle: p.handle as string,
        points: (p.event_points as number) ?? 0,
        correct: 0,
        streak: 0,
        avatarUrl: (p.avatar_url as string) ?? undefined,
        isYou: user?.id === p.id,
      })),
    );
    return ranked.sort((a, b) => a.rank - b.rank).slice(0, limit);
  } catch {
    return [];
  }
}
