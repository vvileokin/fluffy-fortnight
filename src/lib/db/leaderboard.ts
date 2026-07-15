import "server-only";
import { createClient } from "@/lib/supabase/server";
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
