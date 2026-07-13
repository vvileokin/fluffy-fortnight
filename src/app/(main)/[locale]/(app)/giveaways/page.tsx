import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { GiveawayCard } from "@/components/cards/GiveawayCard";
import { giveaways } from "@/lib/data";

export const metadata: Metadata = { title: "Розіграші" };

export default function GiveawaysPage() {
  return (
    <div className="space-y-6">
      <PageIntro icon={Gift} title="Розіграші" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {giveaways.map((g) => (
          <GiveawayCard key={g.slug} g={g} />
        ))}
      </div>
    </div>
  );
}
