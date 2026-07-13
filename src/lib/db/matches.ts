import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  matches as staticMatches,
  getMatch as staticGetMatch,
  type Match,
} from "@/lib/data";

type Row = {
  id: string;
  tournament_slug: string;
  is_event: boolean;
  team_a: string;
  team_b: string;
  status: Match["status"];
  format: Match["format"];
  stage: string | null;
  start_at: string | null;
  time_label: string | null;
  score_a: number;
  score_b: number;
  live_map_label: string | null;
  live_round_a: number;
  live_round_b: number;
  maps: Match["maps"];
  veto: Match["veto"];
  h2h: Match["h2h"];
  open_questions: number;
  max_reward: number;
};

function toMatch(r: Row): Match {
  return {
    id: r.id,
    tournamentSlug: r.tournament_slug,
    isEvent: r.is_event,
    a: r.team_a,
    b: r.team_b,
    status: r.status,
    format: r.format,
    startISO: r.start_at ?? "",
    timeLabel: r.time_label ?? "",
    scoreA: r.score_a,
    scoreB: r.score_b,
    liveMapLabel: r.live_map_label ?? undefined,
    liveRoundA: r.live_round_a,
    liveRoundB: r.live_round_b,
    maps: r.maps ?? [],
    veto: r.veto ?? [],
    h2h: r.h2h ?? undefined,
    openQuestions: r.open_questions,
    maxReward: r.max_reward,
    stage: r.stage ?? "",
  };
}

/** All matches from the DB; falls back to the built-in seed if the table is absent/empty. */
export async function getMatches(): Promise<Match[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("matches")
      .select("*")
      .order("start_at", { ascending: true, nullsFirst: false });
    if (error || !data || data.length === 0) return staticMatches;
    return data.map((r) => toMatch(r as Row));
  } catch {
    return staticMatches;
  }
}

export async function getMatchById(id: string): Promise<Match | undefined> {
  try {
    const sb = await createClient();
    const { data } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (data) return toMatch(data as Row);
  } catch {
    /* fall through */
  }
  return staticGetMatch(id);
}
