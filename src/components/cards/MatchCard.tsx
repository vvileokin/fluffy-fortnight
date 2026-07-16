import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Target, ChevronRight } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BlastMark } from "@/components/ui/BlastMark";
import { LiveBadge } from "@/components/ui/Badge";
import {
  getTournament,
  matchTeam,
  type Match,
  type Team,
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
    <div className="flex items-center gap-2.5">
      <TeamLogo team={team} size="sm" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-semibold",
          dim ? "text-ink-subtle" : "text-ink",
        )}
      >
        {team.name}
      </span>
      {showScore && (
        <span
          className={cn(
            "tnum font-mono text-lg font-bold leading-none",
            leading ? "text-accent" : dim ? "text-ink-subtle" : "text-ink",
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
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;
  const hasQuestions = match.openQuestions > 0;
  const aLead = match.scoreA > match.scoreB;
  const bLead = match.scoreB > match.scoreA;

  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        "group card-interactive flex h-full flex-col rounded-lg border hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        isEvent
          ? "event-aura-soft border-white/10"
          : "border-border bg-surface hover:bg-surface-2",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <span className="flex min-w-0 items-center gap-2 text-xs text-ink-subtle">
          {match.tournamentIcon ? (
            <Image
              src={match.tournamentIcon}
              alt=""
              width={14}
              height={14}
              className="size-3.5 shrink-0 object-contain"
            />
          ) : (
            isEvent && <BlastMark className="size-3.5 shrink-0 text-accent" />
          )}
          <span className="truncate font-medium">{tour?.shortName ?? match.tournamentName}</span>
          {match.stage && <span className="text-ink-faint">·</span>}
          {match.stage && <span className="shrink-0">{match.stage}</span>}
        </span>
        {isLive ? (
          <LiveBadge />
        ) : (
          <span
            className={cn(
              "shrink-0 text-xs font-semibold",
              isFinished ? "text-ink-subtle" : "text-info",
            )}
          >
            {match.timeLabel}
          </span>
        )}
      </div>

      <div className="space-y-2 px-4 py-3">
        <TeamRow team={matchTeam(match, "a")} score={match.scoreA} leading={aLead} dim={isFinished && bLead} showScore={showScore} />
        <TeamRow team={matchTeam(match, "b")} score={match.scoreB} leading={bLead} dim={isFinished && aLead} showScore={showScore} />
      </div>

      {/* Context strip — always present so every state has equal height */}
      <div className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs">
        <span className="text-ink-subtle">{match.format}</span>
        {isLive ? (
          <span className="shrink-0 font-semibold text-live">У прямому ефірі</span>
        ) : isFinished ? (
          <span className="shrink-0 font-semibold text-ink-subtle">{t("finishedLabel")}</span>
        ) : hasQuestions ? (
          <span className="shrink-0 font-semibold text-info">{t("predictionsOpen")}</span>
        ) : (
          <span className="shrink-0 font-semibold text-ink-subtle">{match.timeLabel}</span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border px-4 py-2.5">
        {hasQuestions ? (
          <>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
              <Target className="size-3.5 text-accent" />
              {t("questions", { count: match.openQuestions })}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <span className="text-ink-subtle">{t("upTo")}</span>
              <span className="tnum font-mono font-bold text-accent">
                +{match.maxReward}
              </span>
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
