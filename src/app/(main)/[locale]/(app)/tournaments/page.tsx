import type { Metadata } from "next";
import { tournaments } from "@/lib/data";
import { getSiteSettings, applyCovers } from "@/lib/db/settings";
import { TournamentsView } from "./TournamentsView";

export const metadata: Metadata = { title: "Турніри" };

export default async function TournamentsPage() {
  const { covers } = await getSiteSettings();
  return <TournamentsView tournaments={applyCovers(tournaments, covers)} />;
}
