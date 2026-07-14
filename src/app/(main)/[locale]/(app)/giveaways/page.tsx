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

      {giveaways.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {giveaways.map((g) => (
            <GiveawayCard key={g.slug} g={g} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <Gift className="mx-auto size-8 text-ink-faint" />
          <p className="mt-3 text-sm font-semibold text-ink">Зараз активних розіграшів немає</p>
          <p className="mt-1 text-sm text-ink-subtle">
            Слідкуй за новинами — незабаром зʼявляться нові призи.
          </p>
        </div>
      )}
    </div>
  );
}
