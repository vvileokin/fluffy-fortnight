import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Wifi, ChevronRight } from "lucide-react";
import { DateGlyph, GeoGlyph, TrophyGlyph } from "@/components/layout/NavGlyphs";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Badge, LiveBadge } from "@/components/ui/Badge";
import { getTeam, formatPrize, type Tournament } from "@/lib/data";
import { cn } from "@/lib/utils";

export function TournamentCard({ t }: { t: Tournament }) {
  const tr = useTranslations("tournaments");
  const shown = t.teamSlugs.slice(0, 5);
  const extra = t.teamSlugs.length - shown.length;

  return (
    /* Impeccable: Crafted Tournament Card — the layout it always had; what
       changed is the finish. It now wears the same plate as a match card: lit
       from the top corners by its own accent (`.match-plate` reads --team-a and
       --team-b, so passing one colour to both gives a single symmetric wash),
       and closing on the same chevron. Mixed into a feed, the two card types
       now read as one material. */
    <Link
      href={`/tournaments/${t.slug}`}
      style={
        t.skin === "ewc"
          ? ({ "--glow": "rgb(255 88 16)" } as CSSProperties)
          : ({ "--team-a": t.accent, "--team-b": t.accent } as CSSProperties)
      }
      className={cn(
        "group lift relative flex h-full flex-col overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        // An event card wears its event. Everything else keeps the shared plate
        // lit by its own accent.
        t.skin === "ewc" ? "ewc-aura-card" : "surface-1 match-plate",
      )}
    >
      {/* Cover — the tournament's own accent bled through the top of the card,
          so each one is tinted by its identity rather than a uniform grey.
          `.cover-zoom` promotes the image to its own compositing layer and
          pre-scales it a hair, which kills the hairline seam the browser used
          to leave along the edge mid-zoom. */}
      <div
        className="cover-zoom relative h-28 overflow-hidden"
        style={{
          background: `radial-gradient(120% 140% at 15% 0%, color-mix(in oklch, ${t.accent} 38%, var(--surface)) 0%, color-mix(in oklch, ${t.accent} 12%, var(--surface)) 45%, var(--surface) 100%)`,
        }}
      >
        {t.coverImage && (
          <>
            <Image
              src={t.coverImage}
              alt=""
              fill
              sizes="(max-width:640px) 100vw, 380px"
              className="object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out-soft)] will-change-transform group-hover:scale-[1.04] motion-reduce:transform-none"
            />
            {/* Just enough to seat the Tier/LIVE chips; the artwork stays visible. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
          </>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <Badge tone={t.tier === 1 ? "tier1" : "tier2"}>Tier {t.tier}</Badge>
          {t.status === "live" && <LiveBadge />}
          {t.status === "finished" && <Badge tone="neutral">{tr("finished")}</Badge>}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-2.5 p-3.5 sm:gap-3 sm:p-4">
        <h3 className="text-base font-bold leading-snug tracking-tight text-ink text-balance">
          {t.name}
        </h3>

        <dl className="grid grid-cols-1 gap-1.5 text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <DateGlyph className="size-3.5 shrink-0 text-ink-subtle" />
            <span>{t.dateLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {t.online ? (
              <Wifi className="size-3.5 shrink-0 text-ink-subtle" />
            ) : (
              <GeoGlyph className="size-3.5 shrink-0 text-ink-subtle" />
            )}
            <span className="truncate">{t.location}</span>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3 shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)]">
          <div className="flex items-center">
            <div className="flex -space-x-1.5">
              {shown.map((slug) => (
                <TeamLogo key={slug} team={getTeam(slug)} size="sm" ring />
              ))}
            </div>
            {extra > 0 && (
              <span className="ml-2 text-xs font-semibold text-ink-subtle">
                +{extra}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1">
            <span className="tnum font-mono text-sm font-bold text-accent">
              {formatPrize(t.prizeUSD)}
            </span>
            <ChevronRight className="size-4 text-ink-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function TournamentCardWide({ t }: { t: Tournament }) {
  return (
    <Link
      href={`/tournaments/${t.slug}`}
      className={cn(
        "group lift surface-1 flex items-center gap-4 rounded-2xl p-3 pr-4",
      )}
    >
      <div
        className="grid size-12 shrink-0 place-items-center rounded-md"
        style={{ background: `color-mix(in oklch, ${t.accent} 20%, var(--surface-2))` }}
      >
        <TrophyGlyph className="size-5 text-ink" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Badge tone={t.tier === 1 ? "tier1" : "tier2"}>T{t.tier}</Badge>
          <h3 className="truncate text-sm font-bold text-ink">{t.name}</h3>
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-subtle">
          {t.dateLabel} · {t.location}
        </p>
      </div>
      <span className="tnum shrink-0 font-mono text-sm font-bold text-accent">
        {formatPrize(t.prizeUSD)}
      </span>
    </Link>
  );
}
