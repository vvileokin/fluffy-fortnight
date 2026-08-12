import { type ReactNode, type CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Ban, CircleCheck, History } from "lucide-react";
import { SwordsGlyph, TargetGlyph, type GlyphIcon } from "@/components/layout/NavGlyphs";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Badge } from "@/components/ui/Badge";
import { QuestionCard } from "@/components/match/QuestionCard";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  getTeam,
  getTournament,
  matchSkin,
  matchTeam,
  playedMaps,
  type Match,
  type PlayedMap,
} from "@/lib/data";
import { getMatchById } from "@/lib/db/matches";
import { getQuestionsForMatch } from "@/lib/db/questions";
import { getWorldRanks } from "@/lib/db/team-ranks";
import { mapArt, mapIcon } from "@/lib/maps";
import { cn } from "@/lib/utils";

/** Every other dynamic route names itself in the tab; this one didn't. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) return { title: "Матч" };
  const a = matchTeam(match, "a").name;
  const b = matchTeam(match, "b").name;
  const where = match.tournamentName ?? getTournament(match.tournamentSlug)?.name;
  return {
    title: `${a} vs ${b}`,
    description: where ? `${a} vs ${b} — ${where}` : `${a} vs ${b}`,
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Both are keyed by the same id, so fetch them side by side.
  const [match, questions] = await Promise.all([
    getMatchById(id),
    getQuestionsForMatch(id),
  ]);
  if (!match) notFound();

  // Overlaid once here so every place that renders a/b — and there are three
  // of them further down — picks up the live Valve rank automatically.
  const ranks = await getWorldRanks();
  const withRank = (t: ReturnType<typeof matchTeam>) =>
    ranks[t.slug] ? { ...t, worldRank: ranks[t.slug] } : t;
  const a = withRank(matchTeam(match, "a"));
  const b = withRank(matchTeam(match, "b"));
  const tour = getTournament(match.tournamentSlug);
  const isEvent = match.isEvent ?? tour?.isEvent ?? false;
  const skin = matchSkin(match, tour);
  const veto = match.veto ?? [];
  const maps = playedMaps(match);
  // Which team picked each map (for the map score-strip hover).
  const pickedBy = new Map<string, string>();
  for (const v of veto) {
    if (v.action === "pick") pickedBy.set(v.map, v.team === "a" ? a.tag : v.team === "b" ? b.tag : "");
    else if (v.action === "decider") pickedBy.set(v.map, "Decider");
  }
  const isLive = match.status === "live";
  const showScore = isLive || match.status === "finished";

  return (
    <div className="space-y-7 sm:space-y-10">
      {/* Impeccable: Crafted Return — plain text, no plate. It's a way back,
          not an action, and it sits close to what it belongs to. */}
      {/* Tailwind v4's `space-y-*` puts `margin-bottom` on the child, not
          `margin-top` on the next one — so the link's `-my-2` was overriding it
          and deleting the whole 32px gap, leaving the words 5px off the header.
          The negative margin now only tucks the top; the gap below is the
          container's, and it's small because the link already carries 12px of
          its own padding inside the 44px hit area. */}
      <div className="space-y-2">
      <Link
        href="/matches"
        className="-mt-2 inline-flex min-h-11 items-center gap-1 py-2 pr-2 text-sm font-semibold text-ink-subtle transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-4" />
        Усі матчі
      </Link>

      {/* Match header */}
      {/* Impeccable: Crafted Match Arena — no outline and no marks: the header
          is lit from both bottom corners by the two teams' real brand colours,
          so every match page wears the colours of the match itself. */}
      <div
        style={
          { "--team-a": a.brand, "--team-b": b.brand } as CSSProperties
        }
        className={cn(
          // Event headers keep their own colour but not their own geometry: the
          // `border` and the padded logo frames made the BLAST header ~18px
          // taller than every other one, so two match pages side by side had
          // different rhythm for no reason a reader could name.
          "relative overflow-hidden rounded-2xl",
          skin === "blast"
            ? "event-aura"
            : skin === "ewc"
              ? "ewc-aura ewc-fire"
              : "surface-2",
        )}
      >
        {/* The team-brand wash is what an unskinned header is lit by. A skinned
            one already has its own light, and layering both just muddies each. */}
        {!skin && (
          <div className="team-arena pointer-events-none absolute inset-0" />
        )}
        <div className="relative px-4 py-3.5 sm:px-7 sm:py-6">
          {/* The scoreboard says this visually; the page still needs one real
              heading, and duplicating the names on screen would be noise. */}
          <h1 className="sr-only">
            {a.name} vs {b.name}
            {match.stage ? ` — ${match.stage}` : ""}
          </h1>
          <div className="relative flex items-center justify-between gap-2 text-xs text-ink-muted">
            {tour ? (
              <Link
                href={`/tournaments/${tour.slug}`}
                className="-my-2 inline-flex min-h-11 items-center truncate rounded-lg py-2 pr-2 font-semibold transition-colors hover:text-ink"
              >
                {tour.name}
              </Link>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                {match.tournamentIcon && (
                  <Image
                    src={match.tournamentIcon}
                    alt=""
                    width={16}
                    height={16}
                    className="size-4 shrink-0 object-contain"
                  />
                )}
                {match.tournamentName}
              </span>
            )}
            <span className="shrink-0">{match.stage} · {match.format}</span>
          </div>

          {/* Mobile: vertical scoreboard */}
          {/* Impeccable: Crafted Mobile Header — the rows are stacked tight;
              the block should read as one object, not four floating lines. */}
          <div className="mt-2.5 space-y-2 md:hidden">
            <div className="space-y-1.5">
              <MobileTeamRow team={a} score={match.scoreA} leading={match.scoreA > match.scoreB} showScore={showScore} />
              <MobileTeamRow team={b} score={match.scoreB} leading={match.scoreB > match.scoreA} showScore={showScore} />
            </div>
            {maps.length > 0 && <MapScoreStrip maps={maps} pickedBy={pickedBy} />}
          </div>

          {/* sm+: big logos at the edges, names inside, score centered */}
          {/* Impeccable: Crafted Scoreboard Grid — `1fr auto 1fr`, not a flex
              row. With flex the centre column was content-sized between two
              flexible flanks, so the score drifted off true centre whenever the
              two team names had different widths. A grid puts it on the axis and
              keeps it there. The centre column also owns the kickoff time and
              the map strip, so the crests centre against a column that's as tall
              as they are — which is what closes the hole that used to sit under
              the logos. */}
          <div className="mt-4 hidden grid-cols-[1fr_auto_1fr] items-center gap-5 md:grid lg:gap-8">
            <div className="flex items-center gap-4">
              {/* Impeccable: Crafted Team Plinth — brand-coloured pool of light
                  under each crest, so the two sides read at a glance. */}
              <span
                className="relative inline-flex rounded-2xl"
                style={{ boxShadow: `0 8px 34px -20px ${a.brand}` }}
              >
                <TeamLogo team={a} size="2xl" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xl font-bold tracking-tight text-ink lg:text-2xl">{a.name}</p>
                {a.worldRank > 0 && (
                  <p className="whitespace-nowrap text-xs text-ink-subtle">#{a.worldRank} у світі</p>
                )}
              </div>
            </div>

            {/* The centre column: score over series, on the page's true axis. */}
            <div className="flex shrink-0 flex-col items-center gap-3">
              {/* Impeccable: Crafted Scoreboard — the leading number carries a
                  halo of its own light; the divider is a thin rule, not a colon
                  competing with the digits. */}
              {showScore ? (
                <div className="flex items-baseline gap-3 font-mono">
                  <span
                    className={cn(
                      "tnum text-5xl font-bold leading-none tracking-tight lg:text-6xl",
                      match.scoreA > match.scoreB
                        ? "text-accent [text-shadow:0_0_22px_color-mix(in_oklch,var(--accent)_20%,transparent)]"
                        : "text-ink",
                    )}
                  >
                    {match.scoreA}
                  </span>
                  <span
                    aria-hidden
                    className="h-6 w-px shrink-0 self-center bg-[color-mix(in_oklch,var(--ink)_22%,transparent)]"
                  />
                  <span
                    className={cn(
                      "tnum text-5xl font-bold leading-none tracking-tight lg:text-6xl",
                      match.scoreB > match.scoreA
                        ? "text-accent [text-shadow:0_0_22px_color-mix(in_oklch,var(--accent)_20%,transparent)]"
                        : "text-ink",
                    )}
                  >
                    {match.scoreB}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-3xl font-bold tracking-[0.12em] text-ink-subtle">
                  VS
                </span>
              )}
              {maps.length > 0 && <MapScoreStrip maps={maps} pickedBy={pickedBy} />}
            </div>

            <div className="flex items-center justify-end gap-4">
              <div className="min-w-0 text-right">
                <p className="truncate text-xl font-bold tracking-tight text-ink lg:text-2xl">{b.name}</p>
                {b.worldRank > 0 && (
                  <p className="whitespace-nowrap text-xs text-ink-subtle">#{b.worldRank} у світі</p>
                )}
              </div>
              <span
                className="relative inline-flex rounded-2xl"
                style={{ boxShadow: `0 8px 34px -20px ${b.brand}` }}
              >
                <TeamLogo team={b} size="2xl" />
              </span>
            </div>
          </div>

        </div>
      </div>
      </div>

      {/* PRIMARY: predictions */}
      <section className="space-y-4">
        <SectionLabel icon={TargetGlyph} level="h2">Прогнози на матч</SectionLabel>
        {/* `match` is passed for the option crests, not for the match header
            row — that one is gated on `withMatch`, which stays off here. */}
        {questions.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} match={match} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl well px-6 py-10 text-center text-sm text-ink-subtle">
            Для цього матчу прогнози вже закриті.
          </div>
        )}
      </section>

      {/* CONTEXT: subordinate */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {veto.length > 0 && (
        <section className="space-y-4">
          <SectionLabel icon={SwordsGlyph}>Map veto</SectionLabel>
          {/* Impeccable: Crafted Veto Ledger — every row carries the map's own
              art, held to the right and masked so the labels always win. A map
              that survived the veto is lit; a banned one is drained to almost
              nothing and struck through. The team is its crest, not a tag. */}
          <div className="divide-y divide-[color-mix(in_oklch,var(--ink)_6%,transparent)] overflow-hidden rounded-2xl surface-1">
            {veto.map((v, i) => {
              const team = v.team === "a" ? a : v.team === "b" ? b : null;
              const isPick = v.action === "pick";
              const isDecider = v.action === "decider";
              const art = mapArt(v.map);
              const icon = mapIcon(v.map);
              return (
                <div
                  key={i}
                  className={cn(
                    "map-strip flex items-center gap-3 px-3.5 py-2.5 text-sm",
                    !isPick && !isDecider && "map-banned",
                  )}
                  style={
                    { "--map-art": art ? `url(${art})` : "none" } as CSSProperties
                  }
                >
                  <span className="grid size-8 shrink-0 place-items-center">
                    {team ? (
                      <TeamLogo team={team} size="xs" />
                    ) : isDecider ? (
                      <CircleCheck className="size-4 text-accent" />
                    ) : (
                      <Ban className="size-4 text-ink-faint" />
                    )}
                  </span>
                  {icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={icon}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={cn(
                        "size-5 shrink-0 object-contain",
                        isPick || isDecider ? "opacity-90" : "opacity-30 grayscale",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "flex-1 font-bold tracking-tight",
                      isPick || isDecider ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {v.map}
                  </span>
                  <Badge tone={isDecider ? "accent" : isPick ? "accent" : "neutral"}>
                    {isDecider ? "Decider" : isPick ? "Pick" : "Ban"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
        )}

        <section className="space-y-4">
          <SectionLabel icon={History}>Історія зустрічей</SectionLabel>
          {match.h2h && (match.h2h.a > 0 || match.h2h.b > 0) ? (
            <div className="rounded-lg surface-1 p-4">
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
                <div className="mt-4 space-y-2 shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] pt-3">
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
            <div className="rounded-2xl well px-6 py-10 text-center text-sm text-ink-subtle">
              Команди не грали між собою раніше.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Impeccable: Crafted Section Label — the page's only heading style, so
 * "Прогнози на матч", "Map veto" and "Історія зустрічей" are the same size,
 * weight, colour and glyph tone by construction rather than by three matching
 * class strings. The `pl-1` nudges the row off the card edge below it; a
 * heading that starts on exactly the same pixel as the panel under it reads as
 * stuck to it.
 */
function SectionLabel({
  icon: Icon,
  level = "h3",
  children,
}: {
  icon: GlyphIcon;
  level?: "h2" | "h3";
  children: ReactNode;
}) {
  const Tag = level;
  return (
    <Tag className="flex items-center gap-2.5 pl-1 text-[0.8125rem] font-bold uppercase tracking-wide text-ink-muted">
      <Icon className="size-4 shrink-0 text-ink-subtle" />
      {children}
    </Tag>
  );
}

function MapScoreStrip({
  maps,
  pickedBy,
}: {
  maps: PlayedMap[];
  pickedBy: Map<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {/* Impeccable: Crafted Map Chips — each one wears its map's radar glyph,
          so the series reads as places, not words. */}
      {maps.map((m, i) => {
        const picker = pickedBy.get(m.name);
        const icon = mapIcon(m.name);
        return (
          <Tooltip
            key={i}
            className={cn(
              "inline-flex cursor-help items-center gap-1.5 rounded-lg py-1 pl-1.5 pr-2.5 text-xs font-semibold",
              m.status === "live"
                ? "bg-live/15 text-live ring-1 ring-live/30"
                : m.status === "finished"
                  ? "bg-fill-2 text-ink"
                  : m.status === "skipped"
                    ? "bg-fill-1 text-ink-dim"
                    : "bg-fill-1 text-ink-dim",
            )}
            label={
              m.status === "skipped"
                ? `${m.name} · не зіграно`
                : picker
                  ? picker === "Decider"
                    ? `${m.name} · decider`
                    : `${m.name} · пік ${picker}`
                  : m.name
            }
          >
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={icon}
                alt=""
                loading="lazy"
                decoding="async"
                className={cn(
                  "size-4 shrink-0 object-contain",
                  m.status === "skipped" ? "opacity-35 grayscale" : "opacity-95",
                )}
              />
            ) : (
              <span className="w-0.5" />
            )}
            {m.name}
            {m.status === "finished" ? (
              <span className="tnum font-mono">
                {m.a}:{m.b}
              </span>
            ) : m.status === "live" ? (
              <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold uppercase">
                <span className="size-1.5 animate-pulse rounded-full bg-live" /> live
              </span>
            ) : null}
          </Tooltip>
        );
      })}
    </div>
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
    /* Impeccable: Crafted Mobile Scoreline — a recessed slot in the arena
       floor, tinted by the team's own colour, instead of an outlined row. */
    <div
      className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_9%,transparent)_inset,0_0_0_1px_color-mix(in_oklch,var(--ink)_7%,transparent)]"
      style={{
        backgroundImage: `linear-gradient(90deg, color-mix(in oklch, ${team.brand} 22%, transparent), transparent 62%)`,
        backgroundColor: "color-mix(in oklch, var(--ink) 5%, transparent)",
      }}
    >
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
      <span className="truncate text-sm font-bold text-ink">{team.name}</span>
    </div>
  );
}
