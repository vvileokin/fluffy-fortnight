import type { Metadata } from "next";
import { tournaments } from "@/lib/data";
import { getMatches } from "@/lib/db/matches";
import { MatchesView } from "./MatchesView";

export const metadata: Metadata = { title: "Матчі" };

export default async function MatchesPage() {
  const all = await getMatches();
  // Finished matches live on the Results page now — Matches is live + upcoming.
  const matches = all.filter((m) => m.status !== "finished");
  return <MatchesView matches={matches} tournaments={tournaments} />;
}
