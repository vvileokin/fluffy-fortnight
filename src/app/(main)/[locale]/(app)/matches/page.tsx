import type { Metadata } from "next";
import { matches, tournaments } from "@/lib/data";
import { MatchesView } from "./MatchesView";

export const metadata: Metadata = { title: "Матчі" };

export default function MatchesPage() {
  return <MatchesView matches={matches} tournaments={tournaments} />;
}
