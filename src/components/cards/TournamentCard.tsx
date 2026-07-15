import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Calendar, MapPin, Wifi, Trophy } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Badge, LiveBadge } from "@/components/ui/Badge";
import { getTeam, formatPrize, type Tournament } from "@/lib/data";
import { cn } from "@/lib/utils";

export function TournamentCard({ t }: { t: Tournament }) {
  const tr = useTranslations("tournaments");
  const shown = t.teamSlugs.slice(0, 5);
  const extra = t.teamSlugs.length - shown.length;

  return (
    <Link
      href={`/tournaments/${t.slug}`}
      className="group card-interactive relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    >
      {/* Cover */}
      <div
        className="relative h-24 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, ${t.accent} 22%, var(--surface)) 0%, var(--surface) 70%)`,
        }}
      >
        {t.coverImage && (
          <>
            <Image
              src={t.coverImage}
              alt=""
              fill
              sizes="(max-width:640px) 100vw, 380px"
              className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface/70 via-transparent to-transparent" />
          </>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <Badge tone={t.tier === 1 ? "tier1" : "tier2"}>Tier {t.tier}</Badge>
          {t.status === "live" && <LiveBadge />}
          {t.status === "finished" && <Badge tone="neutral">{tr("finished")}</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-base font-bold leading-snug tracking-tight text-ink text-balance">
          {t.name}
        </h3>

        <dl className="grid grid-cols-1 gap-1.5 text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 shrink-0 text-ink-subtle" />
            <span>{t.dateLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {t.online ? (
              <Wifi className="size-3.5 shrink-0 text-ink-subtle" />
            ) : (
              <MapPin className="size-3.5 shrink-0 text-ink-subtle" />
            )}
            <span className="truncate">{t.location}</span>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
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
          <span className="tnum font-mono text-sm font-bold text-accent">
            {formatPrize(t.prizeUSD)}
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
        "group card-interactive flex items-center gap-4 rounded-lg border border-border bg-surface p-3 pr-4",
        "hover:border-border-strong hover:bg-surface-2",
      )}
    >
      <div
        className="grid size-12 shrink-0 place-items-center rounded-md"
        style={{ background: `color-mix(in oklch, ${t.accent} 20%, var(--surface-2))` }}
      >
        <Trophy className="size-5 text-ink" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Badge tone={t.tier === 1 ? "tier1" : "tier2"}>T{t.tier}</Badge>
          <h3 className="truncate text-sm font-bold text-ink">{t.shortName}</h3>
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
