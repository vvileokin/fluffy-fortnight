import type { Metadata } from "next";
import { getOpenQuestions } from "@/lib/db/questions";
import { InteractivesView } from "./InteractivesView";

export const metadata: Metadata = { title: "Інтерактиви" };

export default async function InteractivesPage() {
  const questions = await getOpenQuestions();
  return <InteractivesView questions={questions} />;
}
