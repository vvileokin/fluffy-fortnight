"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Wifi,
  Trophy,
  Users,
  CalendarDays,
  GitFork,
  Crown,
} from "lucide-react";
import { Badge, LiveBadge } from "@/components/ui/Badge";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { MatchCard } from "@/components/cards/MatchCard";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { BracketPredictor } from "@/components/tournament/BracketPredictor";
import { BountyPredictor } from "@/components/tournament/BountyPredictor";
import {
  getTeam,
  formatPrize,
  type Tournament,
  type Match,
  type LeaderRow,
} from "@/lib/data";
import { ChevronDown } from "lucide-react";
import { BlastMark } from "@/components/ui/BlastMark";
import { cn } from "@/lib/utils";

type Tab = "overview" | "bounty" | "teams" | "schedule" | "predictor" | "leaderboard";

export function TournamentView({
  tournament: t,
  matches,
  leaderboard,
}: {
  tournament: Tournament;
  matches: Match[];
  leaderboard: LeaderRow[];
}) {
  const tabs: {
    id: Tab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "overview", label: "Огляд", icon: Trophy },
    ...(t.isEvent
      ? [{ id: "bounty" as Tab, label: "Bounty", icon: BlastMark }]
      : []),
    { id: "teams", label: "Команди", icon: Users },
    { id: "schedule", label: "Розклад", icon: CalendarDays },
    ...(t.isEvent
      ? []
      : [{ id: "predictor" as Tab, label: "Прогнозатор", icon: GitFork }]),
    { id: "leaderboard", label: "Лідерборд", icon: Crown },
  ];

  const [tab, setTab] = React.useState<Tab>(t.isEvent ? "bounty" : "overview");
  const teams = t.teamSlugs.map(getTeam);

  return (
    <div className="space-y-6">
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-4" />
        Усі турніри
      </Link>

      {/* Header */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border",
          t.isEvent ? "event-aura border-white/10" : "border-border bg-surface",
        )}
      >
        {!t.isEvent && (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, ${t.accent} 20%, var(--surface)) 0%, var(--surface) 60%)`,
            }}
          />
        )}
        {/* Readability scrim over the neon so the title/dates stay legible */}
        {t.isEvent && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/10 sm:from-black/60 sm:via-black/30 sm:to-transparent" />
        )}
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-1.5">
            {t.isEvent && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                <BlastMark className="size-3" /> Event
              </span>
            )}
            {t.status === "live" ? (
              <LiveBadge />
            ) : t.status === "upcoming" ? (
              <Badge tone="info">Незабаром</Badge>
            ) : (
              <Badge tone="neutral">Завершено</Badge>
            )}
            <Badge tone={t.tier === 1 ? "tier1" : "tier2"}>Tier {t.tier}</Badge>
          </div>
          <h1 className="mt-3 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t.name}
          </h1>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-ink-subtle" />
              {t.dateLabel}
            </div>
            <div className="flex items-center gap-2">
              {t.online ? (
                <Wifi className="size-4 text-ink-subtle" />
              ) : (
                <MapPin className="size-4 text-ink-subtle" />
              )}
              {t.location}
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-ink-subtle" />
              {teams.length} команд
            </div>
            <div className="flex items-center gap-2 font-mono font-bold text-accent">
              <Trophy className="size-4" />
              {formatPrize(t.prizeUSD)}
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-subtle">Формат: {t.format}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tb) => {
          const active = tb.id === tab;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-3 pb-3 pt-1 text-sm font-semibold transition-colors",
                active ? "text-ink" : "text-ink-subtle hover:text-ink-muted",
              )}
            >
              <tb.icon className={cn("size-4", active ? "text-accent" : "")} />
              {tb.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {tab === "overview" && (
        <div className="space-y-6">
          <TeamsGrid slugs={t.teamSlugs} compact />
          {matches.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                Найближчі матчі
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {matches.slice(0, 4).map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "bounty" && (
        <div className="rounded-xl border border-white/10 event-aura-soft p-5">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <BlastMark className="size-5 text-accent" />
              Bounty Predictor
            </h2>
          </div>
          <BountyPredictor />
        </div>
      )}

      {tab === "teams" && <TeamsGrid slugs={t.teamSlugs} />}

      {tab === "schedule" && (
        <div className="space-y-3">
          {matches.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          ) : (
            <EmptyPanel text="Розклад матчів з’явиться ближче до старту." />
          )}
        </div>
      )}

      {tab === "predictor" && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-base font-bold text-ink">Прогнозатор плейоф</h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Версія прогнозу зберігається та блокується після дедлайну стадії.
          </p>
          <div className="mt-5">
            <BracketPredictor teamSlugs={t.teamSlugs} />
          </div>
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Найкращі прогнозисти цього турніру.
          </p>
          {leaderboard.length > 0 ? (
            <LeaderboardTable rows={leaderboard} blastPoints={t.isEvent} />
          ) : (
            <EmptyPanel text="Ще ніхто не зробив прогноз на цей турнір." />
          )}
        </div>
      )}
    </div>
  );
}

function TeamsGrid({ slugs, compact }: { slugs: string[]; compact?: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  // On the overview, collapse to two rows (8 on desktop); full list on Teams tab.
  const collapsible = compact && slugs.length > 8;
  const shown = collapsible && !expanded ? slugs.slice(0, 8) : slugs;

  return (
    <div>
      {compact && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
            Учасники{" "}
            <span className="tnum text-ink-subtle">({slugs.length})</span>
          </h2>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((slug) => {
          const team = getTeam(slug);
          return (
            <div
              key={slug}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-strong"
            >
              <TeamLogo team={team} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{team.name}</p>
                <p className="text-xs text-ink-subtle">#{team.worldRank} у світі</p>
              </div>
            </div>
          );
        })}
      </div>
      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {expanded ? "Згорнути" : `Показати всі ${slugs.length}`}
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      )}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-ink-subtle">
      {text}
    </div>
  );
}
