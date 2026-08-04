import type { Metadata } from "next";
import { listTournaments } from "@/lib/db/tournaments";
import { getSiteSettings, applyCovers } from "@/lib/db/settings";
import { TournamentsView } from "./TournamentsView";

export const metadata: Metadata = { title: "Турніри" };

export default async function TournamentsPage() {
  const { covers } = await getSiteSettings();
  return <TournamentsView tournaments={applyCovers(await listTournaments(), covers)} />;
}
