import type { Metadata } from "next";
import { questions } from "@/lib/data";
import { InteractivesView } from "./InteractivesView";

export const metadata: Metadata = { title: "Інтерактиви" };

export default function InteractivesPage() {
  return <InteractivesView questions={questions} />;
}
