import "server-only";
import { createClient } from "@/lib/supabase/server";
import { seasonLeaderboard, type LeaderRow } from "@/lib/data";

/** Season leaderboard from real profiles; falls back to the seed if empty/absent. */
export async function getLeaderboard(limit = 50): Promise<LeaderRow[]> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { data, error } = await sb
      .from("profiles")
      .select("id, handle, points, correct, streak")
      .order("points", { ascending: false })
      .order("correct", { ascending: false })
      .limit(limit);
    if (error || !data || data.length === 0) return seasonLeaderboard;
    return data.map((p, i) => ({
      rank: i + 1,
      handle: p.handle,
      points: p.points,
      correct: p.correct,
      streak: p.streak,
      isYou: user?.id === p.id,
    }));
  } catch {
    return seasonLeaderboard;
  }
}
