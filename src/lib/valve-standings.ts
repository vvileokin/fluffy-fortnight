import "server-only";

/**
 * Valve's own Regional Standings — the model used to invite teams to Majors.
 * Published as plain Markdown tables in a public GitHub repo, updated every
 * few weeks (not live). No token needed; the raw files are served over
 * raw.githubusercontent.com with no rate limit worth worrying about, and the
 * one listing call per sync stays well under GitHub's 60/hour anonymous cap.
 */

const REPO = "ValveSoftware/counter-strike_regional_standings";
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;

export type Region = "europe" | "americas" | "asia";
export type StandingsRow = { rank: number; points: number; teamName: string };

type GithubEntry = { name: string; type: string };

/**
 * The newest filename for each category (global + 3 regions), read from one
 * directory listing. Falls back to the previous year right after New Year's,
 * before that year's folder has any files yet.
 */
async function latestFilenames(): Promise<Record<"global" | Region, string> | null> {
  const thisYear = new Date().getUTCFullYear();
  for (const year of [thisYear, thisYear - 1]) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/live/${year}`,
      { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" },
    );
    if (!res.ok) continue;
    const entries = (await res.json()) as GithubEntry[];
    const files = entries.filter((e) => e.type === "file" && e.name.endsWith(".md"));
    if (files.length === 0) continue;

    const latestOf = (prefix: string) =>
      files
        .map((e) => e.name)
        .filter((n) => n.startsWith(prefix))
        .sort() // YYYY_MM_DD sorts lexicographically in date order
        .at(-1);

    const global = latestOf("standings_global_");
    const europe = latestOf("standings_europe_");
    const americas = latestOf("standings_americas_");
    const asia = latestOf("standings_asia_");
    if (!global || !europe || !americas || !asia) continue;

    return {
      global: `live/${year}/${global}`,
      europe: `live/${year}/${europe}`,
      americas: `live/${year}/${americas}`,
      asia: `live/${year}/${asia}`,
    };
  }
  return null;
}

/**
 * Parse the "| Standing | Points | Team Name | Roster | ... |" table. Only
 * the header separator row (all dashes/colons) and non-numeric leading rows
 * are skipped — that's enough to ignore the header without hardcoding it.
 */
function parseStandingsTable(markdown: string): StandingsRow[] {
  const rows: StandingsRow[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // cells[0] is "" (before the leading |); rank, points, name follow.
    const rank = Number(cells[1]);
    const points = Number((cells[2] ?? "").replace(/,/g, ""));
    const teamName = cells[3];
    if (!Number.isFinite(rank) || !Number.isFinite(points) || !teamName) continue;
    rows.push({ rank, points, teamName });
  }
  return rows;
}

async function fetchTable(path: string): Promise<StandingsRow[]> {
  const res = await fetch(`${RAW}/${path}`, { cache: "no-store" });
  if (!res.ok) return [];
  return parseStandingsTable(await res.text());
}

export type AllStandings = {
  global: StandingsRow[];
  regions: Record<Region, StandingsRow[]>;
} | null;

/** Every table for the latest published date, or null if none could be found. */
export async function fetchLatestStandings(): Promise<AllStandings> {
  const files = await latestFilenames();
  if (!files) return null;

  const [global, europe, americas, asia] = await Promise.all([
    fetchTable(files.global),
    fetchTable(files.europe),
    fetchTable(files.americas),
    fetchTable(files.asia),
  ]);
  return { global, regions: { europe, americas, asia } };
}
