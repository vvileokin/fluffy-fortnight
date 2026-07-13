import type { Metadata } from "next";
import { tournaments } from "@/lib/data";
import { TournamentsView } from "./TournamentsView";

export const metadata: Metadata = { title: "Турніри" };

export default function TournamentsPage() {
  return <TournamentsView tournaments={tournaments} />;
}
