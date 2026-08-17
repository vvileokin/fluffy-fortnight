import { getTranslations } from "next-intl/server";

import { TrophyGlyph, SwordsGlyph, TargetGlyph, GiftGlyph, CrownGlyph } from "@/components/layout/NavGlyphs";
import { Hero } from "@/components/home/Hero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TournamentCard } from "@/components/cards/TournamentCard";
import { MatchCard } from "@/components/cards/MatchCard";
import { GiveawayCard } from "@/components/cards/GiveawayCard";
import { QuestionCard } from "@/components/match/QuestionCard";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { minutesSinceFinished, questionMaxReward, type Match } from "@/lib/data";
import { listTournaments } from "@/lib/db/tournaments";
import { getMatches } from "@/lib/db/matches";
import { getLeaderboard } from "@/lib/db/leaderboard";
import { getGiveaways } from "@/lib/db/giveaways";
import { getOpenQuestions } from "@/lib/db/questions";
import { getSiteSettings, applyCovers } from "@/lib/db/settings";
import { cn } from "@/lib/utils";

// Live → upcoming → finished, and inside each state, by kickoff.
//
// This used to float `isEvent` matches to the front of the feed. That flag is
// set per match and is not the same thing as the tournament's skin, so a card
// could look like the event without carrying it — and the feed then came out as
// two separately-sorted time sequences interleaved, which reads as random. What
// a reader expects from a list of fixtures is the clock, so that's all it is.
function feedRank(m: Match): number {
  return m.status === "live" ? 0 : m.status === "finished" ? 2 : 1;
}

function feedOrder(a: Match, b: Match): number {
  return feedRank(a) - feedRank(b) || (a.startISO || "").localeCompare(b.startISO || "");
}

export default async function HomePage() {
  // Nothing here depends on anything else, so pay for one round-trip, not five.
  const [t, matches, giveaways, seasonLeaderboard, { covers, heroImage }, openQuestions] =
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
    (await listTournaments()).filter((t) => t.status !== "finished").slice(0, 3),
    covers,
  );
  // Event matches lead; live before upcoming; a finished result lingers 10 min.
  const feedMatches = [...matches]
    .filter((m) => m.status !== "finished" || minutesSinceFinished(m) < 10)
    .sort(feedOrder)
    .slice(0, 6);
  // Bets and flat predictions are ranked on different scales — one by the
  // biggest coefficient on offer, the other by the biggest payout — so they are
  // split before either is sorted. Ranking a ×3.40 against a +150 would compare
  // two numbers that don't mean the same thing, and a betting card would either
  // always win or never appear depending on which way the units fell.
  const maxOdds = (q: (typeof openQuestions)[number]) =>
    Math.max(0, ...q.options.map((o) => o.odds ?? 0));
  const betQuestions = openQuestions
    .filter((q) => q.betting)
    .sort((a, b) => maxOdds(b) - maxOdds(a))
    .slice(0, 2);
  // The two biggest payouts on offer — that's what earns a spot on the home page.
  const hotQuestions = openQuestions
    .filter((q) => !q.betting)
    .sort((a, b) => questionMaxReward(b) - questionMaxReward(a))
    .slice(0, 2);

  return (
    <div className="space-y-6 sm:space-y-12">
      <Hero image={heroImage || undefined} href="/tournaments/ewc-2026" />

      {/* Tournaments and giveaways share the top row. With one event running,
          a three-across tournament grid left two thirds of the row empty while
          the giveaway sat far below, tucked beside the leaderboard — so the
          prize that's open right now was the least visible thing on the page.
          Either section takes the full width when the other has nothing. */}
      {/* Current tournaments — nothing running means no empty heading. */}
      {currentTournaments.length > 0 && (
        <section className="space-y-2.5 sm:space-y-4">
          <SectionHeader icon={TrophyGlyph} title={t("currentTournaments")} href="/tournaments" />
          <div className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {currentTournaments.map((t) => (
              <TournamentCard key={t.slug} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Giveaways sit directly under the tournaments and share their grid, so
          a prize card is the same size as a tournament card rather than being
          stretched across a row of its own. */}
      {giveaways.length > 0 && (
        <section className="space-y-2.5 sm:space-y-4">
          <SectionHeader icon={GiftGlyph} title={t("giveaways")} href="/giveaways" />
          <div className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {giveaways.map((g) => (
              <GiveawayCard key={g.slug} g={g} />
            ))}
          </div>
        </section>
      )}

      {/* Bets — the longest odds on offer, above the flat predictions because a
          coefficient is the more interesting proposition of the two.

          One card on a phone, two on a desktop. The second is rendered and
          hidden rather than sliced away at a JS breakpoint: this page is a
          server component, so it has no viewport to branch on, and guessing
          would ship the wrong count to somebody on every load. */}
      {betQuestions.length > 0 && (
        <section className="space-y-2.5 sm:space-y-4">
          <SectionHeader icon={TargetGlyph} title="Ставки" href="/interactives" />
          <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2">
            {betQuestions.map((q, i) => (
              <div key={q.id} className={i === 1 ? "hidden lg:block" : undefined}>
                <QuestionCard question={q} withMatch match={matchById.get(q.matchId)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hot predictions (only when there are open questions) */}
      {hotQuestions.length > 0 && (
        <section className="space-y-2.5 sm:space-y-4">
          <SectionHeader icon={TargetGlyph} title={t("hotPredictions")} href="/interactives" />
          <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2">
            {hotQuestions.map((q) => (
              <QuestionCard key={q.id} question={q} withMatch match={matchById.get(q.matchId)} />
            ))}
          </div>
        </section>
      )}

      {/* Live & upcoming matches (only when there are any) */}
      {feedMatches.length > 0 && (
        <section className="space-y-2.5 sm:space-y-4">
          <SectionHeader icon={SwordsGlyph} title={t("liveUpcoming")} href="/matches" />
          <div className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {feedMatches.map((m, i) => (
              // Phones get a shorter feed — three is enough before the fold.
              <div key={m.id} className={cn("contents", i >= 3 && "hidden sm:contents")}>
                <MatchCard match={m} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The leaderboard now has the row to itself — giveaways moved up beside
          the tournaments — so the podium gets the full width it was always
          cramped out of. */}
      <section className="space-y-2.5 sm:space-y-4">
        <SectionHeader icon={CrownGlyph} title={t("seasonLeaderboard")} href="/leaderboard" />
        <LeaderboardTable rows={seasonLeaderboard} topN={5} podium />
      </section>
    </div>
  );
}
