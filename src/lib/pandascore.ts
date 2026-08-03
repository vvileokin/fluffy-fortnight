import "server-only";

/**
 * PandaScore client — server only. Their token must never reach the browser:
 * the terms forbid giving clients direct access to their API, so everything
 * goes through us and lands in our own tables.
 *
 * Two things about their API that are easy to get wrong:
 *  - CS2 lives under the legacy `/csgo/` path. There is no `/cs2/`.
 *  - CS2 and CS:GO share that path. Without filter[videogame_title]=cs-2 you
 *    get years of dead CS:GO fixtures mixed in.
 */

const BASE = "https://api.pandascore.co";
const CS2_TITLE = "cs-2";

export type PsTeam = {
  id: number;
  name: string;
  acronym: string | null;
  image_url: string | null;
};

export type PsMatch = {
  id: number;
  name: string | null;
  status: "not_started" | "running" | "finished" | "canceled" | "postponed";
  begin_at: string | null;
  scheduled_at: string | null;
  number_of_games: number | null;
  match_type: string | null;
  league: { name: string | null } | null;
  serie: { full_name: string | null; name: string | null; year: number | null } | null;
  tournament: { name: string | null } | null;
  opponents: { type: string; opponent: PsTeam }[] | null;
  results: { team_id: number; score: number }[] | null;
};

export class PandaScoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** What's left of this hour's quota, as reported by the last call. */
let lastRemaining: string | null = null;
export function rateLimitRemaining(): string | null {
  return lastRemaining;
}

async function call(path: string, params: Record<string, string>): Promise<Response> {
  const token = process.env.PANDASCORE_TOKEN;
  if (!token) throw new PandaScoreError("PANDASCORE_TOKEN не налаштований", 500);

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  // Their docs document the token as a query parameter and don't mention the
  // header, so fall back to it rather than failing if the header isn't accepted.
  if (res.status === 401 || res.status === 403) {
    url.searchParams.set("token", token);
    return fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  }
  return res;
}

async function getList(path: string, params: Record<string, string> = {}): Promise<PsMatch[]> {
  const res = await call(path, {
    "filter[videogame_title]": CS2_TITLE,
    per_page: "100",
    ...params,
  });

  lastRemaining = res.headers.get("X-Rate-Limit-Remaining");

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 429
        ? "вичерпано ліміт запитів PandaScore на цю годину"
        : res.status === 401 || res.status === 403
          ? "PandaScore відхилив токен (або ці дані потребують платного плану)"
          : body.slice(0, 200);
    throw new PandaScoreError(hint || `PandaScore відповів ${res.status}`, res.status);
  }

  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? (data as PsMatch[]) : [];
}

/**
 * Everything starting today or tomorrow, Kyiv time — finished, running and
 * upcoming in one call. A date range covers all three states, so this costs a
 * single request instead of three, and nothing outside the window comes back.
 * Canceled matches are dropped: they're never worth reviewing.
 */
export async function matchesTodayAndTomorrow(): Promise<PsMatch[]> {
  const list = await getList("/csgo/matches", {
    "range[begin_at]": `${kyivDayStart(0)},${kyivDayStart(2)}`,
    sort: "begin_at",
  });
  return list.filter((m) => m.status !== "canceled");
}

/**
 * Start of the Kyiv day, `offset` days from today, as an ISO instant.
 * Kyiv is the schedule everything on the site is pinned to.
 */
export function kyivDayStart(offset: number): string {
  const now = new Date();
  // What "today" is in Kyiv, regardless of where the server runs.
  const kyiv = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  kyiv.setHours(0, 0, 0, 0);
  kyiv.setDate(kyiv.getDate() + offset);
  // Re-anchor to a real instant: the local clock above has no offset of its own.
  const drift = now.getTime() - new Date(now.toLocaleString("en-US", { timeZone: "Europe/Kyiv" })).getTime();
  return new Date(kyiv.getTime() + drift).toISOString();
}

/** BO3 / BO5 / BO1 from PandaScore's game count. */
export function formatOf(m: PsMatch): "BO1" | "BO3" | "BO5" {
  return m.number_of_games === 5 ? "BO5" : m.number_of_games === 1 ? "BO1" : "BO3";
}

/** The two sides, or nulls when the bracket hasn't filled them in yet. */
export function sidesOf(m: PsMatch): [PsTeam | null, PsTeam | null] {
  const teams = (m.opponents ?? []).map((o) => o.opponent).filter(Boolean);
  return [teams[0] ?? null, teams[1] ?? null];
}

/** Series score for one side, 0 when PandaScore hasn't published results. */
export function scoreFor(m: PsMatch, teamId: number | null | undefined): number {
  if (!teamId) return 0;
  return (m.results ?? []).find((r) => r.team_id === teamId)?.score ?? 0;
}

/**
 * A readable competition name. PandaScore splits this across three levels —
 * league ("ESL Pro League"), serie ("Season 23") and tournament ("Playoffs") —
 * and any of them can be null or already contain the others. Stitch them
 * without repeating the league when the serie already names it.
 */
export function competitionOf(m: PsMatch): string {
  const league = m.league?.name?.trim() ?? "";
  const full = m.serie?.full_name?.trim() ?? "";
  const serie = m.serie?.name?.trim() ?? "";
  const year = m.serie?.year ? String(m.serie.year) : "";

  if (full) {
    const repeats = league && full.toLowerCase().includes(league.toLowerCase());
    return repeats || !league ? full : `${league} ${full}`;
  }
  const tail = serie || year;
  const joined = [league, tail].filter(Boolean).join(" ").trim();
  return joined || m.tournament?.name?.trim() || "";
}

/** The bit within the competition — "Playoffs", "Group A", "Quarter-finals". */
export function stageOf(m: PsMatch): string {
  return m.tournament?.name?.trim() ?? "";
}
