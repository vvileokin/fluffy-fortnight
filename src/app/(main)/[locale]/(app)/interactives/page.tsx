import type { Metadata } from "next";
import { getOpenQuestions } from "@/lib/db/questions";
import { getMatches } from "@/lib/db/matches";
import { InteractivesView } from "./InteractivesView";

export const metadata: Metadata = { title: "Інтерактиви" };

export default async function InteractivesPage() {
  const [questions, matches] = await Promise.all([getOpenQuestions(), getMatches()]);
  return <InteractivesView questions={questions} matches={matches} />;
}
