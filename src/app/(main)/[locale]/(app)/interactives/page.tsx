import type { Metadata } from "next";
import { InteractivesView } from "./InteractivesView";

export const metadata: Metadata = { title: "Інтерактиви" };

export default function InteractivesPage() {
  // Predictions are admin-created per match; none exist yet, so this is empty.
  return <InteractivesView questions={[]} />;
}
