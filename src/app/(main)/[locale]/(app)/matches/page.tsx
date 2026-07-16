import type { Metadata } from "next";
import { tournaments, minutesSinceFinished } from "@/lib/data";
import { getMatches } from "@/lib/db/matches";
import { MatchesView } from "./MatchesView";

export const metadata: Metadata = { title: "Матчі" };

const FORTY_EIGHT_HOURS_MIN = 48 * 60;

export default async function MatchesPage() {
  const all = await getMatches();
  // Finished matches drop out of the matches branch after 48h.
  const matches = all.filter(
    (m) => m.status !== "finished" || minutesSinceFinished(m) < FORTY_EIGHT_HOURS_MIN,
  );
  return <MatchesView matches={matches} tournaments={tournaments} />;
}
