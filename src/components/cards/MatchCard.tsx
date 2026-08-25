import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { TargetGlyph } from "@/components/layout/NavGlyphs";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { LiveBadge } from "@/components/ui/Badge";
import { BlastMark } from "@/components/ui/BlastMark";
import { EwcMark } from "@/components/ui/EwcMark";
import { PortoMark } from "@/components/ui/PortoMark";
import {
  getTournament,
  matchSkin,
  matchTeam,
  matchTimeLabel,
  type Match,
  type Team,
  isAuraSkin,
} from "@/lib/data";
import { cn } from "@/lib/utils";

function TeamRow({
  team,
  score,
  leading,
  dim,
  showScore,
}: {
  team: Team;
  score: number;
  leading: boolean;
  dim: boolean;
  showScore: boolean;
}) {
  return (
    /* Impeccable: Crafted Team Row — the logo tile sits in its own pool of
       brand light; the losing side recedes rather than being greyed out. */
    <div
      className={cn(
        "flex items-center gap-2.5 transition-opacity duration-200",
        dim && "opacity-70",
      )}
    >
      <span
        className="relative inline-flex shrink-0 rounded-lg"
        style={{ boxShadow: `0 0 16px -10px ${team.brand}` }}
      >
        <TeamLogo team={team} size="cardCrest" />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-semibold tracking-tight",
          dim ? "text-ink-subtle" : "text-ink",
        )}
      >
        {team.name}
      </span>
      {showScore && (
        <span
          className={cn(
            "tnum font-mono text-lg font-bold leading-none",
            leading
              ? "text-accent [text-shadow:0_0_14px_color-mix(in_oklch,var(--accent)_22%,transparent)]"
              : dim
                ? "text-ink-subtle"
                : "text-ink",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

export function MatchCard({ match }: { match: Match }) {
  const t = useTranslations("matches");
  const tour = getTournament(match.tournamentSlug);
  const isEvent = match.isEvent ?? tour?.isEvent ?? false;
  const skin = matchSkin(match, tour);
  const isLive = match.status === "live";
  // Same day in the tournament's own timezone, which is what `matchTimeLabel`
  // phrases against — comparing local dates here would disagree with the words
  // it prints for anyone not sitting in that zone.
  const startsToday = matchTimeLabel(match).startsWith("Сьогодні");
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;
  const hasQuestions = match.openQuestions > 0;
  /** Whether the rail's right-hand side prints a state word at all. */
  const hasState = isLive || isFinished || hasQuestions;
  const aLead = match.scoreA > match.scoreB;
  const bLead = match.scoreB > match.scoreA;

  return (
    /* Impeccable: Crafted Match Card — lit from the top corners by the two
       teams' own brand colours, so a card for NAVI vs FaZe can't be mistaken
       for any other match. Live gets a filament of red across the top edge
       instead of a red box. */
    <Link
      href={`/matches/${match.id}`}
      data-skin={skin}
      style={
        {
          "--team-a": matchTeam(match, "a").brand,
          "--team-b": matchTeam(match, "b").brand,
          // BLAST's two-tone red/blue is its identity, so it keeps the exact
          // pair its old event skin used. Every other tournament lights both
          // bottom corners with its own accent. Same treatment everywhere, own
          // colour: no tournament is the odd one out.
          ...(skin === "blast"
            ? { "--tour-a": "rgb(255 12 60)", "--tour-b": "rgb(46 86 255)" }
            : isAuraSkin(skin)
              ? { "--tour-a": "rgb(var(--skin-glow))", "--tour-b": "rgb(var(--skin-deep))" }
              : tour?.accent
                ? { "--tour-a": tour.accent, "--tour-b": tour.accent }
                : {}),
        } as CSSProperties
      }
      className={cn(
        // One plate for every match. Event cards used to get `event-aura-soft`
        // plus a white ring, so a BLAST card sat next to a Stake card looking
        // like a different component — brighter, outlined, differently lit. The
        // event is already named twice in the header (icon + tournament name);
        // it doesn't also need its own chassis.
        "group lift relative flex h-full flex-col overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        isAuraSkin(skin) ? "skin-match" : "surface-1 match-plate",
        isLive && "rail-live",
      )}
    >
      <div className="relative flex items-center justify-between gap-2 px-3.5 pt-2.5 sm:px-4 sm:pt-3">
        <span className="flex min-w-0 items-center gap-2 text-xs text-ink-subtle">
          {match.tournamentIcon ? (
            <Image
              src={match.tournamentIcon}
              alt=""
              width={14}
              height={14}
              className="size-3.5 shrink-0 object-contain"
            />
          ) : skin === "porto" ? (
            /* A stacked block, not a strip: sized to the text's cap height it
               matches the 14px tournament icons beside it. */
            <PortoMark className="h-3.5 w-auto shrink-0 text-[rgb(var(--skin-ring))]" />
          ) : skin === "ewc" ? (
            <EwcMark className="h-2 w-auto shrink-0 text-[rgb(var(--skin-ring))]" />
          ) : (
            skin === "blast" && <BlastMark className="size-3.5 shrink-0 text-accent" />
          )}
          {/* Full name, trimmed by CSS only when it genuinely doesn't fit. */}
          <span className="truncate font-medium">{tour?.name ?? match.tournamentName}</span>
          {match.stage && <span className="text-ink-faint">·</span>}
          {match.stage && <span className="shrink-0">{match.stage}</span>}
        </span>
        {/* Impeccable: Crafted Header Rail — on phones the date drops out of
            this row entirely (it was fighting the tournament name for a
            240px line) and reappears in the context rail below, where there's
            room for it. LIVE always stays: it's the one thing worth crowding
            for. */}
        {isLive ? (
          <LiveBadge />
        ) : (
          <span
            className={cn(
              "hidden shrink-0 whitespace-nowrap text-xs font-semibold sm:inline",
              isFinished
                ? "text-ink-subtle"
                : isAuraSkin(skin)
                  ? "text-[rgb(var(--skin-ring))]"
                  : "text-info",
            )}
          >
            {matchTimeLabel(match)}
          </span>
        )}
      </div>

      <div className="relative space-y-2 px-3.5 py-2.5 sm:px-4 sm:py-3">
        <TeamRow team={matchTeam(match, "a")} score={match.scoreA} leading={aLead} dim={isFinished && bLead} showScore={showScore} />
        <TeamRow team={matchTeam(match, "b")} score={match.scoreB} leading={bLead} dim={isFinished && aLead} showScore={showScore} />
      </div>

      {/* Context strip — always present so every state has equal height */}
      {/* Impeccable: Crafted Context Rail — a recessed slot in the card face
          (inset shadow, no border) rather than another outlined box. */}
      {/* The kickoff is already on this card once — in the header on desktop,
          on the left of this rail on phones — so this slot never repeats it.
          It carries a state word or nothing. */}
      <div className="relative mx-3.5 mb-2.5 sm:mx-4 sm:mb-3 flex items-center justify-between gap-2 rounded-lg bg-fill-1 px-2.5 py-1.5 text-xs shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_6%,transparent)_inset,0_-1px_0_0_oklch(0_0_0/0.35)_inset]">
        {/* On a phone the kickoff is a plate, not a word in a sentence.

            It began as "BO3 · Завтра 12:00" with the time the faintest thing on
            the card, which was backwards: every group match at Porto is a BO3,
            so the format says the same thing on all twenty-four, while the time
            is the only value anyone scans this rail for. Making it bold and
            moving it first was not enough — a bold fragment next to a dim one
            inside a recessed rail still reads as two loose words.

            So it gets a shape. A plate is a different kind of object from the
            text around it, and shape is what the eye finds before weight or
            colour. The format moves over to the state word on the right, where
            the two quiet facts sit together. */}
        <span className="flex min-w-0 items-center gap-2">
          {!isLive && (
            <span
              className={cn(
                "tnum shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-bold leading-none sm:hidden",
                startsToday
                  ? isAuraSkin(skin)
                    ? "bg-[rgb(var(--skin-ring)/0.18)] text-[rgb(var(--skin-ring))]"
                    : "bg-accent/15 text-accent"
                  : "bg-fill-2 text-ink",
              )}
            >
              {matchTimeLabel(match)}
            </span>
          )}
          <span className="truncate text-ink-subtle max-sm:hidden">{match.format}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-ink-subtle sm:hidden">{match.format}</span>
          {/* Only when something follows it. A card with no open questions and
              no state word left the separator hanging at the end of the rail
              with nothing on the other side of it. */}
          {hasState && (
            <span aria-hidden className="text-ink-faint sm:hidden">
              ·
            </span>
          )}
        {isLive ? (
          <span className="shrink-0 font-semibold text-live">У прямому ефірі</span>
        ) : isFinished ? (
          <span className="shrink-0 font-semibold text-ink-subtle">{t("finishedLabel")}</span>
        ) : hasQuestions ? (
          <span
            className={cn(
              "shrink-0 font-semibold",
              isAuraSkin(skin) ? "text-[rgb(var(--skin-ring))]" : "text-info",
            )}
          >
            {t("predictionsOpen")}
          </span>
        ) : null}
        </span>
      </div>

      {/* Hairline of light instead of a hard divider — reads as a seam, not a rule. */}
      <div className="relative mt-auto flex items-center justify-between px-3.5 py-2 shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] sm:px-4 sm:py-2.5">
        {hasQuestions ? (
          <>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
              <TargetGlyph
                className={cn(
                  "size-3.5",
                  isAuraSkin(skin) ? "text-[rgb(var(--skin-ring))]" : "text-accent",
                )}
              />
              {/* "Питання" was the admin's word for the row in the database,
                  not the player's word for the thing they do with it — nobody
                  answers a quiz here, they call a match. Staking matches say so
                  outright, since what's on offer there is a different deal. */}
              {match.betting
                ? t("bets", { count: match.openQuestions })
                : t("predictions", { count: match.openQuestions })}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <span className="text-ink-subtle">{t("upTo")}</span>
              {match.betting && match.maxOdds ? (
                // A coefficient, not a payout: what a staking question is worth
                // depends on the stake, so quoting a points figure here would
                // promise a number the card cannot know.
                <span
                  className={cn(
                    "tnum font-mono font-bold leading-none",
                    isAuraSkin(skin) ? "text-[rgb(var(--skin-ring))]" : "text-accent",
                  )}
                >
                  ×{match.maxOdds.toFixed(2)}
                </span>
              ) : (
                <span className={cn("tnum flex items-center gap-1 font-mono font-bold leading-none", isAuraSkin(skin) ? "text-[rgb(var(--skin-ring))]" : "text-accent")}>
                  <BrandIcon name={skin === "ewc" ? "points-ewc" : "points"} className="size-3.5" />
                  +{match.maxReward}
                </span>
              )}
              <ChevronRight className="size-4 text-ink-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </>
        ) : (
          <>
            <span className="text-xs font-medium text-ink-subtle">
              {isFinished ? t("finishedLabel") : "Деталі матчу"}
            </span>
            <ChevronRight className="size-4 text-ink-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </div>
    </Link>
  );
}
