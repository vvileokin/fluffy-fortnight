import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type LeaderRow } from "@/lib/data";

/** Season leaderboard from real profiles. Empty when there are none. */
export async function getLeaderboard(limit = 50): Promise<LeaderRow[]> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { data, error } = await sb
      .from("profiles")
      .select("id, handle, avatar_url, points, correct, streak")
      .order("points", { ascending: false })
      .order("correct", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((p, i) => ({
      rank: i + 1,
      handle: p.handle,
      points: p.points,
      correct: p.correct,
      streak: p.streak,
      avatarUrl: p.avatar_url ?? undefined,
      isYou: user?.id === p.id,
    }));
  } catch {
    return [];
  }
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
    // the service-role client — otherwise we'd only ever see our own row.
    const { data: picks } = await createAdminClient().from("bounty_picks").select("user_id");
    const ids = [...new Set((picks ?? []).map((p) => p.user_id))];
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
    return rows
      .map((p) => ({
        handle: p.handle,
        points: p.bounty_points ?? 0,
        correct: p.bounty_correct ?? 0,
        streak: p.bounty_streak ?? 0,
        avatarUrl: p.avatar_url ?? undefined,
        isYou: user?.id === p.id,
      }))
      .sort((a, b) => b.points - a.points || b.correct - a.correct)
      .slice(0, limit)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  } catch {
    return [];
  }
}
