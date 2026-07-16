import "server-only";
import { createClient } from "@/lib/supabase/server";
import { inkForColor, playedMaps, seriesScore, type Match, type Team } from "@/lib/data";

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
  team_a_name: string | null;
  team_a_logo: string | null;
  team_a_color: string | null;
  team_a_rank: number | null;
  team_b_name: string | null;
  team_b_logo: string | null;
  team_b_color: string | null;
  team_b_rank: number | null;
  tournament_name: string | null;
  tournament_icon: string | null;
};

function customTeam(
  slug: string,
  name: string | null,
  logo: string | null,
  color: string | null,
  rank: number | null,
): Team | undefined {
  if (!name) return undefined;
  const brand = color || "#1D1D20";
  return {
    slug: slug || "custom",
    name,
    tag: name.slice(0, 4).toUpperCase(),
    logo: logo || "",
    brand,
    ink: inkForColor(brand),
    region: "EU",
    worldRank: rank ?? 0,
  };
}

function winsNeeded(format: Match["format"]): number {
  return format === "BO5" ? 3 : format === "BO1" ? 1 : 2;
}

/**
 * Derive the series score and status from the per-map results the admin enters,
 * so the total score appears automatically once maps are filled in:
 *  - series score = maps won by each side
 *  - status: finished once a side clinches the series; upcoming → live once any
 *    map has a result. An explicit live/finished status set by the admin is kept.
 */
function deriveState(m: Match): Match {
  const maps = playedMaps(m);
  const series = seriesScore(m);
  const need = winsNeeded(m.format);
  const clinched = series.a >= need || series.b >= need;
  const hasVeto = (m.veto ?? []).some((v) => v.action === "pick" || v.action === "decider");
  const anyRounds = maps.some((x) => x.a > 0 || x.b > 0);
  const anyFinished = maps.some((x) => x.status === "finished");

  let status = m.status;
  if (clinched) status = "finished";
  else if (m.status !== "finished" && (hasVeto || anyRounds)) status = "live";

  return {
    ...m,
    scoreA: anyFinished ? series.a : m.scoreA,
    scoreB: anyFinished ? series.b : m.scoreB,
    status,
  };
}

function toMatch(r: Row): Match {
  return deriveState({
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
    teamAData: customTeam(r.team_a, r.team_a_name, r.team_a_logo, r.team_a_color, r.team_a_rank),
    teamBData: customTeam(r.team_b, r.team_b_name, r.team_b_logo, r.team_b_color, r.team_b_rank),
    tournamentName: r.tournament_name ?? undefined,
    tournamentIcon: r.tournament_icon ?? undefined,
  });
}

type SB = Awaited<ReturnType<typeof createClient>>;

/** Overlay open-question count + max reward from the questions table onto matches. */
async function withQuestionStats(sb: SB, list: Match[]): Promise<Match[]> {
  try {
    const { data } = await sb
      .from("questions")
      .select("match_id, status, options")
      .in("status", ["open", "upcoming"]);
    if (!data) return list;
    const stats = new Map<string, { count: number; max: number }>();
    for (const q of data as { match_id: string; options: { reward?: number }[] | null }[]) {
      const opts = Array.isArray(q.options) ? q.options : [];
      const max = opts.reduce((m, o) => Math.max(m, Number(o.reward) || 0), 0);
      const cur = stats.get(q.match_id) ?? { count: 0, max: 0 };
      stats.set(q.match_id, { count: cur.count + 1, max: Math.max(cur.max, max) });
    }
    return list.map((m) => {
      const s = stats.get(m.id);
      return s ? { ...m, openQuestions: s.count, maxReward: s.max } : { ...m, openQuestions: 0, maxReward: 0 };
    });
  } catch {
    return list;
  }
}

/** All matches from the DB. Empty when there are none — the site shows an empty state. */
export async function getMatches(): Promise<Match[]> {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("matches")
      .select("*")
      .order("start_at", { ascending: true, nullsFirst: false });
    if (error || !data) return [];
    return withQuestionStats(sb, data.map((r) => toMatch(r as Row)));
  } catch {
    return [];
  }
}

export async function getMatchById(id: string): Promise<Match | undefined> {
  try {
    const sb = await createClient();
    const { data } = await sb.from("matches").select("*").eq("id", id).maybeSingle();
    if (data) return (await withQuestionStats(sb, [toMatch(data as Row)]))[0];
  } catch {
    /* fall through */
  }
  return undefined;
}
