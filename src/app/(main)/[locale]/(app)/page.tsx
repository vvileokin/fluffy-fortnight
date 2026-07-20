import { getTranslations } from "next-intl/server";
import { Trophy, Swords, Target, Gift, Crown } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TournamentCard } from "@/components/cards/TournamentCard";
import { MatchCard } from "@/components/cards/MatchCard";
import { GiveawayCard } from "@/components/cards/GiveawayCard";
import { QuestionCard } from "@/components/match/QuestionCard";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { tournaments, minutesSinceFinished, questionMaxReward, type Match } from "@/lib/data";
import { getMatches } from "@/lib/db/matches";
import { getLeaderboard } from "@/lib/db/leaderboard";
import { getGiveaways } from "@/lib/db/giveaways";
import { getOpenQuestions } from "@/lib/db/questions";
import { getSiteSettings, applyCovers } from "@/lib/db/settings";
import { cn } from "@/lib/utils";

// Event matches first, then live → upcoming → finished within each group.
function feedRank(m: Match): number {
  const group = m.isEvent ? 0 : 10;
  const state = m.status === "live" ? 0 : m.status === "finished" ? 2 : 1;
  return group + state;
}

export default async function HomePage() {
  // Nothing here depends on anything else, so pay for one round-trip, not five.
  const [t, matches, giveaways, seasonLeaderboard, { covers }, openQuestions] =
    await Promise.all([
      getTranslations("home"),
      getMatches(),
      getGiveaways(),
      getLeaderboard(50), // the home page only shows the top few

      getSiteSettings(),
      getOpenQuestions(100),
    ]);
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const currentTournaments = applyCovers(
    tournaments.filter((t) => t.status !== "finished").slice(0, 3),
    covers,
  );
  // Event matches lead; live before upcoming; a finished result lingers 10 min.
  const feedMatches = [...matches]
    .filter((m) => m.status !== "finished" || minutesSinceFinished(m) < 10)
    .sort((a, b) => feedRank(a) - feedRank(b))
    .slice(0, 6);
  // The two biggest payouts on offer — that's what earns a spot on the home page.
  const hotQuestions = [...openQuestions]
    .sort((a, b) => questionMaxReward(b) - questionMaxReward(a))
    .slice(0, 2);

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

      {/* Hot predictions (only when there are open questions) */}
      {hotQuestions.length > 0 && (
        <section className="space-y-4">
          <SectionHeader icon={Target} title={t("hotPredictions")} href="/interactives" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {hotQuestions.map((q) => (
              <QuestionCard key={q.id} question={q} withMatch match={matchById.get(q.matchId)} />
            ))}
          </div>
        </section>
      )}

      {/* Live & upcoming matches (only when there are any) */}
      {feedMatches.length > 0 && (
        <section className="space-y-4">
          <SectionHeader icon={Swords} title={t("liveUpcoming")} href="/matches" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {feedMatches.map((m, i) => (
              // Phones get a shorter feed — three is enough before the fold.
              <div key={m.id} className={cn("contents", i >= 3 && "hidden sm:contents")}>
                <MatchCard match={m} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Giveaways + season leaderboard. Giveaways may be empty on some days,
          so the leaderboard takes the full width when there are none. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-6">
        {giveaways.length > 0 && (
          <section className="space-y-4 lg:col-span-2">
            <SectionHeader icon={Gift} title={t("giveaways")} href="/giveaways" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {giveaways.map((g) => (
                <GiveawayCard key={g.slug} g={g} />
              ))}
            </div>
          </section>
        )}

        <section className={cn("space-y-4", giveaways.length > 0 ? "lg:col-span-3" : "lg:col-span-5")}>
          <SectionHeader icon={Crown} title={t("seasonLeaderboard")} href="/leaderboard" />
          <LeaderboardTable rows={seasonLeaderboard} topN={5} />
        </section>
      </div>
    </div>
  );
}
