import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { tournaments, getTournament } from "@/lib/data";
import { getSiteSettings } from "@/lib/db/settings";
import { getMatches } from "@/lib/db/matches";
import { getLeaderboard, getBountyLeaderboard } from "@/lib/db/leaderboard";
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

  const [allMatches, leaderboard] = await Promise.all([
    getMatches(),
    t.isEvent ? getBountyLeaderboard(20) : getLeaderboard(20),
  ]);
  const tourMatches = allMatches.filter((m) => m.tournamentSlug === slug);

  return (
    <TournamentView
      tournament={tournament}
      matches={tourMatches}
      leaderboard={leaderboard}
    />
  );
}
