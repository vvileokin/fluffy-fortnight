import { useTranslations } from "next-intl";
import { Trophy, Swords, Target, Gift, Crown } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TournamentCard } from "@/components/cards/TournamentCard";
import { MatchCard } from "@/components/cards/MatchCard";
import { GiveawayCard } from "@/components/cards/GiveawayCard";
import { QuestionCard } from "@/components/match/QuestionCard";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import {
  tournaments,
  matches,
  giveaways,
  questions,
  seasonLeaderboard,
} from "@/lib/data";

export default function HomePage() {
  const t = useTranslations("home");
  const currentTournaments = tournaments
    .filter((t) => t.status !== "finished")
    .slice(0, 3);
  const feedMatches = [...matches]
    .filter((m) => m.status !== "finished")
    .sort((a, b) => (a.status === "live" ? -1 : 1) - (b.status === "live" ? -1 : 1))
    .slice(0, 6);
  const hotQuestions = questions.filter((q) => q.status === "open").slice(0, 2);

  return (
    <div className="space-y-10 sm:space-y-12">
      <Hero />

      {/* Current tournaments */}
      <section className="space-y-4">
        <SectionHeader icon={Trophy} title={t("currentTournaments")} href="/tournaments" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currentTournaments.map((t) => (
            <TournamentCard key={t.slug} t={t} />
          ))}
        </div>
      </section>

      {/* Hot predictions */}
      <section className="space-y-4">
        <SectionHeader icon={Target} title={t("hotPredictions")} href="/interactives" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {hotQuestions.map((q) => (
            <QuestionCard key={q.id} question={q} withMatch />
          ))}
        </div>
      </section>

      {/* Live & upcoming matches */}
      <section className="space-y-4">
        <SectionHeader icon={Swords} title={t("liveUpcoming")} href="/matches" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {feedMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      </section>

      {/* Giveaways + season leaderboard */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-6">
        <section className="space-y-4 lg:col-span-2">
          <SectionHeader icon={Gift} title={t("giveaways")} href="/giveaways" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {giveaways.map((g) => (
              <GiveawayCard key={g.slug} g={g} />
            ))}
          </div>
        </section>

        <section className="space-y-4 lg:col-span-3">
          <SectionHeader icon={Crown} title={t("seasonLeaderboard")} href="/leaderboard" />
          <LeaderboardTable rows={seasonLeaderboard} />
        </section>
      </div>
    </div>
  );
}
