"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import {
  ChevronLeft,
  Wifi,
  Trophy,
  Users,
  GitFork,
  History,
  Swords,
} from "lucide-react";
import { Badge, LiveBadge } from "@/components/ui/Badge";
import {
  TrophyGlyph,
  SwordsGlyph,
  CrownGlyph,
  DateGlyph,
  GeoGlyph,
  TeamGlyph,
  ResultsGlyph,
} from "@/components/layout/NavGlyphs";
import { BlastMark } from "@/components/ui/BlastMark";
import { EwcMark } from "@/components/ui/EwcMark";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { MatchDayGroups } from "@/components/cards/MatchDayGroups";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { BracketPredictor } from "@/components/tournament/BracketPredictor";
import { TournamentBracket } from "@/components/tournament/TournamentBracket";
import { EwcBracket } from "@/components/tournament/EwcBracket";
import { PortoBracket } from "@/components/tournament/PortoBracket";
import { PlayoffBracketEntry } from "@/components/tournament/PlayoffBracketEntry";
import { FavouriteTeam } from "@/components/tournament/FavouriteTeam";
import type { CSSProperties } from "react";
import {
  getTeam,
  formatPrize,
  type Tournament,
  type Match,
  type LeaderRow,
  type EventSkin,
  isAuraSkin,
} from "@/lib/data";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "teams" | "matches" | "results" | "predictor" | "leaderboard";

export function TournamentView({
  tournament: t,
  matches,
  leaderboard,
  ranks = {},
}: {
  tournament: Tournament;
  matches: Match[];
  leaderboard: LeaderRow[];
  /** Live world ranks by slug, from Valve's standings. */
  ranks?: Record<string, number>;
}) {
  const tabs: {
    id: Tab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Overrides the default height for marks that aren't roughly square. */
    iconClass?: string;
  }[] = [
    { id: "overview", label: "Огляд", icon: TrophyGlyph },
    { id: "teams", label: "Команди", icon: TeamGlyph },
    { id: "matches" as Tab, label: "Матчі", icon: SwordsGlyph },
    { id: "results", label: "Результати", icon: ResultsGlyph },
    // The event gets a predictor too, it just plays a different game: one
    // one-shot playoff bracket for real event points instead of the sandbox
    // simulator a regular tournament shows — so on the event it flies the
    // event's own mark rather than a generic bracket glyph.
    //
    // Porto has none yet: its mechanics are still being built, and a tab that
    // opens EWC's bracket on a different tournament is worse than no tab.
    ...(t.skin === "porto"
      ? []
      : [
          t.skin === "ewc"
            ? {
                id: "predictor" as Tab,
                label: "Прогнозатор",
                icon: EwcMark,
                // The wordmark is a 5:1 lockup: at the row's 16px it would run
                // 80px wide and read as a banner wedged into a tab. 8px, the
                // cap height of the label beside it — a 5:1 lockup carries far
                // more ink across than a letter does, so equal height reads as
                // bigger.
                iconClass: "h-2 w-auto shrink-0",
              }
            : { id: "predictor" as Tab, label: "Прогнозатор", icon: GitFork },
        ]),
    {
      id: "leaderboard",
      label: "Лідерборд",
      icon: CrownGlyph,
      // The crown is a 1.4:1 shape, so at the row's 16px it runs 22px across
      // and carries half again the ink of the square glyphs beside it. Height
      // matching fixed the team mark reading small; the same rule overshoots on
      // the widest shape in the set, and this is the trim that settles it.
      iconClass: "h-3.5 w-auto shrink-0",
    },
  ];

  const [tab, setTab] = React.useState<Tab>("overview");

  // At the event, every cue that would normally be the season's yellow burns
  // ember instead — the prize, the selected tab, the tier chip. A yellow
  // control sitting on the EWC's maroon floor reads as belonging to a
  // different page.
  const ewc = isAuraSkin(t.skin);

  const teams = t.teamSlugs.map(getTeam);
  const finishedMatches = matches.filter((m) => m.status === "finished");
  const upcomingMatches = matches.filter((m) => m.status !== "finished");

  return (
    <div data-skin={t.skin} className="space-y-6">
      {/* Impeccable: Crafted Return — plain text, close to what it belongs to.
          Same construction as the match page, and for the same reason: Tailwind
          v4's `space-y-*` puts `margin-bottom` on the child, so the link's old
          `-my-2` overrode it and deleted the gap entirely. The negative margin
          now only tucks the top; the space below is the container's, and it's
          small because the link already carries 12px of its own padding inside
          the 44px hit area. */}
      <div className="space-y-2">
      <Link
        href="/tournaments"
        className="-mt-2 inline-flex min-h-11 items-center gap-1 py-2 pr-2 text-sm font-semibold text-ink-subtle transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-4" />
        Усі турніри
      </Link>

      {/* Header */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          t.skin === "blast"
            ? "event-aura"
            : isAuraSkin(t.skin)
              ? cn("skin-aura", t.skin === "ewc" && "skin-art")
              : "surface-2",
        )}
      >
        {/* Impeccable: Crafted Tournament Bay — the event's own accent pooled
            wide and low, mixed against a raised surface so a neon brand never
            blows out. Same lighting language as a match arena, one colour
            instead of two, because a tournament has one identity. */}
        {!t.skin && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(90% 130% at 0% 128%, color-mix(in oklch, ${t.accent} 38%, var(--surface-3)), transparent 58%), radial-gradient(70% 110% at 100% 118%, color-mix(in oklch, ${t.accent} 20%, var(--surface-3)), transparent 60%), linear-gradient(180deg, color-mix(in oklch, var(--ink) 5%, transparent), transparent 38%)`,
            }}
          />
        )}
        {/* Readability scrim over the neon so the title and meta stay legible.
            Phones used to keep it near-opaque because the facts sat here; they
            moved into «Про турнір» below, so the banner now only carries a
            large bold title — which clears contrast easily at this weight and
            leaves the event's heat visible on the screen most people use. */}
        {t.skin && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/65 via-black/45 to-black/40 sm:from-black/60 sm:via-black/30 sm:to-transparent" />
        )}
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Over artwork this is a line, not a row of chips.

                Three plates above a title never balanced, and restyling them
                into one material did not fix it: the problem was that three
                boxes were carrying three words. A banner already has a frame —
                the artwork — so the facts don't need three more. They read as
                one small-caps line with the event's mark at its head and thin
                separators between, which is the same shape as the facts under
                the title and makes the header one object instead of two.

                Off a banner the filled chips stay: on a plain surface they are
                the site's own pattern and there is no artwork for a bare line
                to sit against. */}
            {t.skin ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-white/60 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
                <span className="flex items-center gap-1.5 text-white">
                  {t.skin === "ewc" ? (
                    <EwcMark className="h-[0.4375rem] w-auto" />
                  ) : (
                    <BlastMark className="size-[0.6875rem]" />
                  )}
                  Event
                </span>
                <Sep />
                {t.status === "live" ? (
                  <span className="flex items-center gap-1.5 text-live">
                    <span className="live-dot inline-block size-1.5 rounded-full bg-live" />
                    Live
                  </span>
                ) : (
                  <span>{t.status === "upcoming" ? "Незабаром" : "Завершено"}</span>
                )}
                <Sep />
                <span className={cn(isAuraSkin(t.skin) && "text-[rgb(var(--skin-ring))]")}>
                  Tier {t.tier}
                </span>
              </p>
            ) : (
              <>
                {t.status === "live" ? (
                  <LiveBadge />
                ) : t.status === "upcoming" ? (
                  <Badge tone="info">Незабаром</Badge>
                ) : (
                  <Badge tone="neutral">Завершено</Badge>
                )}
                <Badge tone={t.tier === 1 ? "tier1" : "tier2"}>Tier {t.tier}</Badge>
              </>
            )}
          </div>
          <h1 className="mt-2.5 text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t.name}
          </h1>
          {/* Laptop and up: the facts run as one tight line under the title,
              prize last and in the accent — it's the number people look for.
              On phones they move into the Огляд tab, keeping the banner clean. */}
          {/* 16px glyphs, not 14. Against 14px text these sat a shade under
              the cap height and read as faint marks rather than as labels for
              the facts beside them. */}
          <dl className="mt-2.5 hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted sm:flex">
            <div className="flex items-center gap-1.5">
              <DateGlyph className="size-4 shrink-0 text-ink-subtle" />
              {t.dateLabel}
            </div>
            <Dot />
            <div className="flex items-center gap-1.5">
              {t.online ? (
                <Wifi className="size-4 shrink-0 text-ink-subtle" />
              ) : (
                <GeoGlyph className="size-4 shrink-0 text-ink-subtle" />
              )}
              {t.location}
            </div>
            <Dot />
            <div className="flex items-center gap-1.5">
              {/* Height-matched, not box-matched. Its viewBox is 20×14, so a
                  square class fits it by width and leaves it 11px tall — the
                  smallest mark in a row of 16px ones, floating in the middle of
                  its own box. The crown two components down carries the mirror
                  of this note for the opposite reason. */}
              <TeamGlyph className="h-4 w-auto shrink-0 text-ink-subtle" />
              {teams.length} команд
            </div>
            <Dot />
            <div className="flex items-center gap-1.5">
              <SwordsGlyph className="size-4 shrink-0 text-ink-subtle" />
              {t.format}
            </div>
            <div
              className={cn(
                "tnum ml-auto flex items-center gap-1.5 font-mono text-base font-extrabold",
                ewc ? "text-[rgb(var(--skin-ring))]" : "text-accent",
              )}
            >
              <TrophyGlyph className="size-4 shrink-0" />
              {formatPrize(t.prizeUSD)}
            </div>
          </dl>
        </div>
      </div>
      </div>

      {/* Tabs */}
      {/* Impeccable: Crafted Tournament Switch — a recessed channel with a
          solid lit segment, the same control language as every other filter on
          the site instead of a one-off underline rule. */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto overflow-y-hidden rounded-xl bg-[color-mix(in_oklch,var(--bg)_70%,var(--surface))] p-1 shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_7%,transparent),0_2px_5px_-2px_oklch(0_0_0/0.6)_inset]">
        {tabs.map((tb) => {
          const active = tb.id === tab;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                "relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
                "transition-[background-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "active:translate-y-px motion-reduce:active:translate-y-0",
                active
                  ? ewc
                    ? "seg-on bg-[rgb(var(--skin-ring))] text-[var(--skin-base)]"
                    : "seg-on bg-accent text-accent-ink"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {/* Height, not a square box. These glyphs are cropped to their
                  real ink, so their boxes have honestly different ratios — the
                  team mark is 20:14, the crown 202:144. Forced into `size-4`
                  they were width-constrained and came out a third shorter than
                  the square trophy beside them, which is why Команди read as a
                  smaller icon. Matching on height is what makes a row of mixed
                  shapes look the same size. */}
              <tb.icon className={tb.iconClass ?? "h-4 w-auto shrink-0"} />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Phones only: the tournament facts live here instead of the banner —
              a plain label/value list so every value shows in full. */}
          <section className="space-y-3 sm:hidden">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              Про турнір
            </h2>
            {/* Same glyph set the desktop banner uses — the phone was still on
                the old lucide icons, so the two read as different products. */}
            <dl
              className={cn(
                "divide-y overflow-hidden rounded-xl",
                // White hairlines are the only cool thing on an ember plate and
                // read as scratches across it; warm them into the same family.
                ewc ? "skin-aura-card skin-divide" : "surface-1 divide-white/[0.06]",
              )}
            >
              <MetaRow icon={DateGlyph} label="Дати" value={t.dateLabel} />
              <MetaRow icon={t.online ? Wifi : GeoGlyph} label="Локація" value={t.location} />
              <MetaRow
                icon={TrophyGlyph}
                label="Призовий"
                value={formatPrize(t.prizeUSD)}
                accent
                ewc={ewc}
              />
              <MetaRow icon={SwordsGlyph} label="Формат" value={t.format} />
            </dl>
          </section>
          <TeamsGrid slugs={t.teamSlugs} ranks={ranks} skin={t.skin} compact />
          {/* The event's ladder, below the field it's drawn from. It's a view of
              the admin's matches — see EwcBracket — not a second copy of them. */}
          {isAuraSkin(t.skin) && (
            <section className="space-y-3">
              {/* No mark in front of the words. Every other section heading on
                  this page starts its text at the container edge, and the mark
                  pushed this one ~28px right of them — one heading indented
                  against the rest is exactly the kind of unevenness the eye
                  catches without being able to name. The page is already
                  unmistakably the event's: hero badge, tab, palette. */}
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                Сітка турніру
              </h2>
              {t.skin === "porto" ? (
                <PortoBracket matches={matches} />
              ) : (
                <EwcBracket matches={matches} />
              )}
            </section>
          )}
          {/* The generic stage list is for tournaments with no bracket of their
              own. The event draws its real one above, so showing both put two
              things called "Сітка турніру" on one page. */}
          {!t.skin && matches.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                Сітка турніру
              </h2>
              <TournamentBracket matches={matches} />
            </div>
          )}
        </div>
      )}

      {tab === "teams" && <TeamsGrid slugs={t.teamSlugs} ranks={ranks} skin={t.skin} />}

      {/* Everything not yet played — the counterpart to Результати. */}
      {tab === "matches" && (
        <div className="space-y-3">
          {upcomingMatches.length > 0 ? (
            <MatchDayGroups matches={upcomingMatches} />
          ) : (
            <EmptyPanel text="Найближчих матчів цього турніру поки немає." />
          )}
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-3">
          {finishedMatches.length > 0 ? (
            <MatchDayGroups matches={finishedMatches} />
          ) : (
            <EmptyPanel text="Ще немає зіграних матчів цього турніру." />
          )}
        </div>
      )}

      {/* Two different things share the tab. The event's is a real, scored,
          one-shot entry; every other tournament gets the sandbox simulator,
          which saves nothing and pays nothing. */}
      {tab === "predictor" &&
        (ewc ? (
          <div className="space-y-3">
            {/* Above the bracket: it's one tap against sixteen, so it's the
                thing a player can finish before deciding whether to fill in a
                whole ladder. */}
            <FavouriteTeam />
            <PlayoffBracketEntry />
          </div>
        ) : (
          <div className="rounded-xl surface-1 p-5">
            <h2 className="text-base font-bold text-ink">Прогнозатор плейоф</h2>
            <p className="mt-1 text-sm text-ink-subtle">
              Версія прогнозу зберігається та блокується після дедлайну стадії.
            </p>
            <div className="mt-5">
              <BracketPredictor teamSlugs={t.teamSlugs} />
            </div>
          </div>
        ))}

      {tab === "leaderboard" && (
        <div className="space-y-3">
          {/* EWC keeps no event streak — a streak is a season-long property of
              the player, so it lives on the general board only. */}
          {leaderboard.length > 0 ? (
            <LeaderboardTable
              rows={leaderboard}
              blastPoints={t.skin === "blast"}
              pointsIcon={
                t.skin === "ewc" ? "points-ewc" : t.skin === "porto" ? "points-porto" : "points"
              }
              // A streak belongs to a player across the season, not to one
              // tournament, so no event board carries the column.
              showStreak={!isAuraSkin(t.skin)}
              ewc={isAuraSkin(t.skin)}
              topN={10}
              expandable
              podium
            />
          ) : (
            <EmptyPanel text="Ще ніхто не зробив прогноз на цей турнір." />
          )}
        </div>
      )}
    </div>
  );
}

function TeamsGrid({
  slugs,
  ranks = {},
  skin,
  compact,
}: {
  slugs: string[];
  ranks?: Record<string, number>;
  skin?: EventSkin;
  compact?: boolean;
}) {
  // Seeded order: best in the world first. A field this size is otherwise an
  // unordered wall — sorting it means the top of the grid is always the answer
  // to "who's actually here". Unranked teams sink to the bottom rather than
  // sorting as rank 0 and jumping to the front.
  const seeded = React.useMemo(() => {
    const rankOf = (slug: string) => {
      const r = ranks[slug] ?? getTeam(slug).worldRank;
      return r > 0 ? r : Number.POSITIVE_INFINITY;
    };
    return [...slugs].sort(
      (a, b) => rankOf(a) - rankOf(b) || getTeam(a).name.localeCompare(getTeam(b).name),
    );
  }, [slugs, ranks]);

  const [expanded, setExpanded] = React.useState(false);
  // On the overview, collapse to two rows (8 on desktop); full list on Teams tab.
  const collapsible = compact && seeded.length > 8;
  const shown = collapsible && !expanded ? seeded.slice(0, 8) : seeded;

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
          const rank = ranks[slug] ?? team.worldRank;
          return (
            /* Impeccable: Crafted Roster Tile — each team's own colour rakes in
               from the left, so a 32-team field reads as a wall of identities
               rather than 32 identical grey rows. */
            <div
              key={slug}
              className={cn(
                "lift surface-1 relative flex items-center gap-3 overflow-hidden rounded-xl p-3",
                isAuraSkin(skin) && "skin-tile",
              )}
              style={
                isAuraSkin(skin)
                  ? ({ "--team": team.brand } as CSSProperties)
                  : {
                      backgroundImage: `linear-gradient(100deg, color-mix(in oklch, ${team.brand} 14%, transparent), transparent 58%)`,
                    }
              }
            >
              <TeamLogo team={team} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-tight text-ink">{team.name}</p>
                {rank > 0 && (
                  <p
                    className={cn(
                      "tnum whitespace-nowrap text-xs",
                      // The rank takes the event's accent on a skinned tile —
                      // it is the one number on the tile, and grey on a lit
                      // plate reads as switched off.
                      isAuraSkin(skin) ? "font-semibold text-[rgb(var(--skin-ring))]" : "text-ink-subtle",
                    )}
                  >
                    #{rank} у світі
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors",
            // The expander belongs to the grid above it, so at an event it
            // wears the event's plate rather than the generic surface — which
            // is what left a plain dark bar under sixteen lit tiles.
            isAuraSkin(skin)
              ? "skin-aura-card text-white hover:brightness-110"
              : "surface-1 text-ink-muted hover:bg-surface-2 hover:text-ink",
          )}
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

/** Hairline separator between facts in the header line. */
/** Separator for the banner line — always visible, unlike the meta-row Dot. */
function Sep() {
  return (
    <span aria-hidden className="size-1 rounded-full bg-white/30" />
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="hidden size-1 rounded-full bg-[color-mix(in_oklch,var(--ink)_22%,transparent)] lg:block"
    />
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  accent,
  ewc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  /** Burn the accented value ember instead of season yellow. */
  ewc?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="flex shrink-0 items-center gap-2.5 text-sm text-ink-muted">
        {/* Geometrically these are already centred — measured, the cap band of
            the label and the icon box share a midpoint. The unevenness is in
            the glyphs: each fills its viewBox edge to edge while its solid mass
            sits in the lower two thirds (the calendar body under two hairline
            ticks, the pin head over a point). Centring the box therefore hangs
            the weight low. One pixel up puts the mass on the line. */}
        <Icon className="size-4 shrink-0 -translate-y-px text-ink-subtle" />
        {label}
      </dt>
      <dd
        className={cn(
          "text-right text-sm font-semibold",
          accent
            ? ewc
              ? "font-mono text-[rgb(var(--skin-ring))]"
              : "font-mono text-accent"
            : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl well px-6 py-12 text-center text-sm text-ink-subtle">
      {text}
    </div>
  );
}
