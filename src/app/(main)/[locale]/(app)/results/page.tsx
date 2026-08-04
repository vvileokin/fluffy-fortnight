import type { Metadata } from "next";
import { listTournaments } from "@/lib/db/tournaments";
import { getMatches } from "@/lib/db/matches";
import { ResultsView } from "./ResultsView";

export const metadata: Metadata = { title: "Результати" };

export default async function ResultsPage() {
  const all = await getMatches();
  // Every finished match, with no time cutoff — this is the full archive.
  const finished = all.filter((m) => m.status === "finished");
  return <ResultsView matches={finished} tournaments={await listTournaments()} />;
}
