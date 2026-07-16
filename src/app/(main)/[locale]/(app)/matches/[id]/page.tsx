import { type ReactNode } from "react";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Target, Swords, Ban, CircleCheck, History } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Badge, LiveBadge } from "@/components/ui/Badge";
import { QuestionCard } from "@/components/match/QuestionCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getTeam,
  getTournament,
  matchTeam,
  playedMaps,
  type PlayedMap,
  type VetoStep,
} from "@/lib/data";
import { getMatchById } from "@/lib/db/matches";
import { getQuestionsForMatch } from "@/lib/db/questions";
import { cn } from "@/lib/utils";

// --- Fallback veto (design-first) when a match has none set in the DB ---
const defaultVeto: VetoStep[] = [
  { team: "a", action: "ban", map: "Anubis" },
  { team: "b", action: "ban", map: "Dust II" },
  { team: "a", action: "pick", map: "Mirage" },
  { team: "b", action: "pick", map: "Ancient" },
  { team: "a", action: "ban", map: "Nuke" },
  { team: "b", action: "ban", map: "Train" },
  { team: "-", action: "decider", map: "Inferno" },
];

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) notFound();

  const a = matchTeam(match, "a");
  const b = matchTeam(match, "b");
  const tour = getTournament(match.tournamentSlug);
  const isEvent = match.isEvent ?? tour?.isEvent ?? false;
  const veto = match.veto && match.veto.length > 0 ? match.veto : defaultVeto;
  const maps = playedMaps(match);
  const questions = await getQuestionsForMatch(id);
  const isLive = match.status === "live";
  const showScore = isLive || match.status === "finished";

  return (
    <div className="space-y-8">
      <Link
        href="/matches"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-4" />
        Усі матчі
      </Link>

      {/* Match header */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border",
          isEvent ? "event-aura border-white/10" : "border-border bg-surface",
        )}
      >
        {!isEvent && (
          <div className="aura-accent pointer-events-none absolute inset-0 opacity-60" />
        )}
        <div className="relative px-4 py-5 sm:px-8 sm:py-7">
          <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
            {tour ? (
              <Link
                href={`/tournaments/${tour.slug}`}
                className="truncate font-semibold hover:text-ink"
              >
                {tour.name}
              </Link>
            ) : (
              <span className="truncate font-semibold">{match.tournamentName}</span>
            )}
            <span className="shrink-0">{match.stage} · {match.format}</span>
          </div>

          {/* Mobile: vertical scoreboard */}
          <div className="mt-4 space-y-3 sm:hidden">
            <div className="flex flex-wrap items-center gap-2">
              {isLive ? (
                <LiveBadge />
              ) : (
                <span className="text-xs font-semibold text-info">
                  {match.timeLabel}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <MobileTeamRow team={a} score={match.scoreA} leading={match.scoreA > match.scoreB} showScore={showScore} />
              <MobileTeamRow team={b} score={match.scoreB} leading={match.scoreB > match.scoreA} showScore={showScore} />
            </div>
            {maps.length > 0 && <MapScoreStrip maps={maps} />}
          </div>

          {/* sm+: big logos at the edges, names inside, score centered */}
          <div className="mt-6 hidden items-center gap-4 sm:flex lg:gap-6">
            <div className="flex flex-1 items-center gap-4">
              <LogoFrame framed={isEvent}>
                <TeamLogo team={a} size="xl" />
              </LogoFrame>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-ink lg:text-xl">{a.name}</p>
                {a.worldRank > 0 && (
                  <p className="text-xs text-ink-subtle">#{a.worldRank} у світі</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-2">
              {isLive ? (
                <LiveBadge />
              ) : (
                <span className="text-xs font-semibold text-info">
                  {match.timeLabel}
                </span>
              )}
              {showScore ? (
                <div className="flex items-center gap-2 font-mono">
                  <span
                    className={cn(
                      "tnum text-5xl font-bold",
                      match.scoreA > match.scoreB ? "text-accent" : "text-ink",
                    )}
                  >
                    {match.scoreA}
                  </span>
                  <span className="text-2xl text-ink-faint">:</span>
                  <span
                    className={cn(
                      "tnum text-5xl font-bold",
                      match.scoreB > match.scoreA ? "text-accent" : "text-ink",
                    )}
                  >
                    {match.scoreB}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-3xl font-bold text-ink-subtle">
                  VS
                </span>
              )}
              {maps.length > 0 && <MapScoreStrip maps={maps} />}
            </div>

            <div className="flex flex-1 items-center justify-end gap-4">
              <div className="min-w-0 text-right">
                <p className="truncate text-lg font-bold text-ink lg:text-xl">{b.name}</p>
                {b.worldRank > 0 && (
                  <p className="text-xs text-ink-subtle">#{b.worldRank} у світі</p>
                )}
              </div>
              <LogoFrame framed={isEvent}>
                <TeamLogo team={b} size="xl" />
              </LogoFrame>
            </div>
          </div>
        </div>
      </div>

      {/* PRIMARY: predictions */}
      <section className="space-y-4">
        <SectionHeader
          icon={Target}
          title="Прогнози на матч"
          hint={
            questions.length > 0
              ? `${questions.length} питань · відповідай до дедлайну`
              : "Прогнози закриті"
          }
        />
        {questions.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-ink-subtle">
            Для цього матчу прогнози вже закриті.
          </div>
        )}
      </section>

      {/* Maps of the series — status auto-derived (finished / live / upcoming) */}
      {maps.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
            <Swords className="size-4 text-ink-subtle" /> Карти матчу
            <span className="tnum font-mono text-ink-subtle">({maps.length})</span>
          </h3>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {maps.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <span className="text-ink-faint">{i + 1}</span>
                  {m.name}
                  {m.status === "live" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-live">
                      <span className="size-1.5 animate-pulse rounded-full bg-live" /> Live
                    </span>
                  )}
                  {m.status === "upcoming" && (
                    <span className="text-[0.625rem] font-medium uppercase tracking-wide text-ink-faint">
                      далі
                    </span>
                  )}
                </span>
                {m.status === "upcoming" ? (
                  <span className="text-xs text-ink-faint">—</span>
                ) : (
                  <span className="tnum font-mono">
                    <span className={cn("font-bold", m.a > m.b ? "text-accent" : "text-ink")}>{m.a}</span>
                    <span className="mx-2 text-ink-faint">:</span>
                    <span className={cn("font-bold", m.b > m.a ? "text-accent" : "text-ink")}>{m.b}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CONTEXT: subordinate */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
            <Swords className="size-4 text-ink-subtle" />
            Map veto
          </h3>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {veto.map((v, i) => {
              const team = v.team === "a" ? a : v.team === "b" ? b : null;
              const isPick = v.action === "pick";
              const isDecider = v.action === "decider";
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {isDecider ? (
                    <CircleCheck className="size-4 shrink-0 text-accent" />
                  ) : isPick ? (
                    <CircleCheck className="size-4 shrink-0 text-success" />
                  ) : (
                    <Ban className="size-4 shrink-0 text-ink-faint" />
                  )}
                  <span className="w-12 shrink-0 text-xs font-semibold text-ink-subtle">
                    {team ? team.tag : "Decider"}
                  </span>
                  <span
                    className={cn(
                      "flex-1 font-semibold",
                      isPick || isDecider ? "text-ink" : "text-ink-subtle line-through decoration-ink-faint",
                    )}
                  >
                    {v.map}
                  </span>
                  <Badge tone={isDecider ? "accent" : isPick ? "success" : "neutral"}>
                    {isDecider ? "Decider" : isPick ? "Pick" : "Ban"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
            <History className="size-4 text-ink-subtle" />
            Історія зустрічей
          </h3>
          {match.h2h && (match.h2h.a > 0 || match.h2h.b > 0) ? (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <TeamMini team={a} />
                <div className="text-center">
                  <p className="font-mono text-2xl font-bold text-ink">
                    <span className={cn(match.h2h.a >= match.h2h.b && "text-accent")}>
                      {match.h2h.a}
                    </span>
                    <span className="mx-1.5 text-ink-faint">–</span>
                    <span className={cn(match.h2h.b > match.h2h.a && "text-accent")}>
                      {match.h2h.b}
                    </span>
                  </p>
                  <p className="text-[0.6875rem] text-ink-subtle">особисті зустрічі</p>
                </div>
                <TeamMini team={b} align="right" />
              </div>
              {match.h2h.series && match.h2h.series.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  {match.h2h.series.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-ink-subtle">{r.event}</span>
                      <span
                        className={cn(
                          "tnum font-mono font-semibold",
                          r.winner === "a" ? "text-ink" : "text-ink-muted",
                        )}
                      >
                        {r.score}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-ink-subtle">
              Команди не грали між собою раніше.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MapScoreStrip({ maps }: { maps: PlayedMap[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {maps.map((m, i) => (
        <span
          key={i}
          className={cn(
            "tnum inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold",
            m.status === "live"
              ? "bg-live/15 text-live ring-1 ring-live/30"
              : m.status === "finished"
                ? "bg-surface-2 text-ink-muted"
                : "bg-surface-2 text-ink-faint",
          )}
          title={`${m.name}${m.status === "live" ? " · LIVE" : ""}`}
        >
          {m.name.slice(0, 3)}
          <span>
            {m.a}:{m.b}
          </span>
          {m.status === "live" && <span className="size-1.5 rounded-full bg-live" />}
        </span>
      ))}
    </div>
  );
}

function LogoFrame({
  framed,
  children,
}: {
  framed: boolean;
  children: ReactNode;
}) {
  if (!framed) return <>{children}</>;
  return (
    <span className="inline-flex rounded-2xl bg-black/25 p-2 ring-1 ring-white/10 backdrop-blur-sm">
      {children}
    </span>
  );
}

function MobileTeamRow({
  team,
  score,
  leading,
  showScore,
}: {
  team: ReturnType<typeof getTeam>;
  score: number;
  leading: boolean;
  showScore: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
      <TeamLogo team={team} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-ink">{team.name}</p>
        {team.worldRank > 0 && (
          <p className="text-xs text-ink-subtle">#{team.worldRank} у світі</p>
        )}
      </div>
      {showScore && (
        <span
          className={cn(
            "tnum font-mono text-3xl font-bold",
            leading ? "text-accent" : "text-ink",
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function TeamMini({
  team,
  align,
}: {
  team: ReturnType<typeof getTeam>;
  align?: "right";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        align === "right" && "flex-row-reverse",
      )}
    >
      <TeamLogo team={team} size="sm" />
      <span className="text-sm font-bold text-ink">{team.tag}</span>
    </div>
  );
}
