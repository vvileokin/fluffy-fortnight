import { type ReactNode } from "react";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Target, Swords, Ban, CircleCheck, History } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Badge, LiveBadge } from "@/components/ui/Badge";
import { QuestionCard } from "@/components/match/QuestionCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getMatch,
  getTeam,
  getTournament,
  questionsForMatch,
  matches,
} from "@/lib/data";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return matches.map((m) => ({ id: m.id }));
}

// --- Mock context (design-first) ---
const veto = [
  { team: "a", action: "ban", map: "Anubis" },
  { team: "b", action: "ban", map: "Dust II" },
  { team: "a", action: "pick", map: "Mirage" },
  { team: "b", action: "pick", map: "Ancient" },
  { team: "a", action: "ban", map: "Nuke" },
  { team: "b", action: "ban", map: "Train" },
  { team: "-", action: "decider", map: "Inferno" },
] as const;

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) notFound();

  const a = getTeam(match.a);
  const b = getTeam(match.b);
  const tour = getTournament(match.tournamentSlug);
  const isEvent = tour?.isEvent ?? false;
  const questions = questionsForMatch(id);
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
            <Link
              href={`/tournaments/${tour?.slug}`}
              className="truncate font-semibold hover:text-ink"
            >
              {tour?.name}
            </Link>
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
              {isLive && match.liveMapLabel && (
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[0.6875rem] font-medium text-ink-muted">
                  {match.liveMapLabel} · {match.liveRoundA}:{match.liveRoundB}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <MobileTeamRow team={a} score={match.scoreA} leading={match.scoreA > match.scoreB} showScore={showScore} />
              <MobileTeamRow team={b} score={match.scoreB} leading={match.scoreB > match.scoreA} showScore={showScore} />
            </div>
          </div>

          {/* sm+: big logos at the edges, names inside, score centered */}
          <div className="mt-6 hidden items-center gap-4 sm:flex lg:gap-6">
            <div className="flex flex-1 items-center gap-4">
              <LogoFrame framed={isEvent}>
                <TeamLogo team={a} size="xl" />
              </LogoFrame>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-ink lg:text-xl">{a.name}</p>
                <p className="text-xs text-ink-subtle">#{a.worldRank} у світі</p>
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
              {isLive && match.liveMapLabel && (
                <span className="whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-[0.6875rem] font-medium text-ink-muted">
                  {match.liveMapLabel} · {match.liveRoundA}:{match.liveRoundB}
                </span>
              )}
            </div>

            <div className="flex flex-1 items-center justify-end gap-4">
              <div className="min-w-0 text-right">
                <p className="truncate text-lg font-bold text-ink lg:text-xl">{b.name}</p>
                <p className="text-xs text-ink-subtle">#{b.worldRank} у світі</p>
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
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <TeamMini team={a} />
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-ink">
                  <span className="text-accent">3</span>
                  <span className="mx-1.5 text-ink-faint">–</span>
                  <span>2</span>
                </p>
                <p className="text-[0.6875rem] text-ink-subtle">останні 5</p>
              </div>
              <TeamMini team={b} align="right" />
            </div>
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              {[
                { t: "PGL Bucharest · груп.", s: `${a.tag} 2:1 ${b.tag}`, w: "a" },
                { t: "ESL Pro S22 · плей-оф", s: `${a.tag} 0:2 ${b.tag}`, w: "b" },
                { t: "IEM Katowice · груп.", s: `${a.tag} 2:0 ${b.tag}`, w: "a" },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-ink-subtle">{r.t}</span>
                  <span
                    className={cn(
                      "tnum font-mono font-semibold",
                      r.w === "a" ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {r.s}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
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
        <p className="text-xs text-ink-subtle">#{team.worldRank} у світі</p>
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
