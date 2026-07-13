import type { Metadata } from "next";
import { tournaments } from "@/lib/data";
import { getMatches } from "@/lib/db/matches";
import { MatchesView } from "./MatchesView";

export const metadata: Metadata = { title: "Матчі" };

export default async function MatchesPage() {
  const matches = await getMatches();
  return <MatchesView matches={matches} tournaments={tournaments} />;
}
