import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  tournaments,
  matches,
  getTournament,
  seasonLeaderboard,
  type LeaderRow,
} from "@/lib/data";
import { getSiteSettings } from "@/lib/db/settings";
import { TournamentView } from "./TournamentView";

export function generateStaticParams() {
  return tournaments.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = getTournament(slug);
  return { title: t?.name ?? "Турнір" };
}

// A tournament leaderboard is a smaller slice of the season standings.
const tournamentLeaderboard: LeaderRow[] = seasonLeaderboard
  .filter((r) => !r.isYou)
  .slice(0, 6)
  .map((r, i) => ({ ...r, rank: i + 1, points: Math.round(r.points / 4) }))
  .concat([
    { rank: 23, handle: "ти", points: 1240, correct: 18, streak: 2, isYou: true, delta: 3 },
  ]);

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = getTournament(slug);
  if (!t) notFound();

  const { covers } = await getSiteSettings();
  const tournament = covers[slug] ? { ...t, coverImage: covers[slug] } : t;
  const tourMatches = matches.filter((m) => m.tournamentSlug === slug);

  return (
    <TournamentView
      tournament={tournament}
      matches={tourMatches}
      leaderboard={tournamentLeaderboard}
    />
  );
}
