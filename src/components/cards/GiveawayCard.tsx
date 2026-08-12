import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Gift, Users, ArrowRight, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatInt, cn } from "@/lib/utils";
import { type Giveaway } from "@/lib/data";

export function GiveawayCard({ g }: { g: Giveaway }) {
  const ewc = g.skin === "ewc";
  return (
    /* Impeccable: Crafted Giveaway Card — a prize card should feel like a
       prize. The body carries the giveaway's own colour pooled up from the
       bottom, so the card is lit end to end rather than only in its header
       strip, and the artwork sits in a stronger pool of the same hue. */
    <Link
      href={`/giveaways/${g.slug}`}
      style={
        {
          "--aura-1": g.cover,
          "--aura-2": "var(--accent)",
          // What the card throws onto the canvas when it lifts.
          "--glow": ewc ? "rgb(255 88 16)" : g.cover,
        } as CSSProperties
      }
      className={cn(
        "group lift relative flex flex-col overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        ewc ? "ewc-aura-card" : "surface-1 aura",
      )}
    >
      {/* A fixed 3:1 slot rather than a fixed 96px height: the card is a
          different width in each grid it appears in, so a height made the crop
          unpredictable and there was no single artwork size that fit. */}
      <div
        className="relative flex aspect-[3/1] items-center justify-center"
        style={
          ewc
            ? undefined
            : {
                background: `radial-gradient(90% 130% at 50% 128%, color-mix(in oklch, ${g.cover} 34%, transparent), transparent 62%), linear-gradient(135deg, color-mix(in oklch, ${g.cover} 20%, var(--surface)), var(--surface) 78%)`,
              }
        }
      >
        {g.image ? (
          <>
            <Image
              src={g.image}
              alt=""
              fill
              sizes="(max-width:640px) 100vw, 480px"
              className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
            />
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-t to-transparent",
                ewc ? "from-black/70" : "from-surface/80",
              )}
            />
          </>
        ) : (
          <Gift
            className="size-10 text-ink opacity-80 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5"
            strokeWidth={1.75}
            style={{ color: ewc ? "rgb(255 138 24)" : g.cover }}
          />
        )}
        <div className="absolute left-3 top-3">
          {/* A drawn giveaway is a different thing from an open one, and the
              card is where most people meet it — showing "Активний" on a prize
              that already has a winner is the one wrong answer here. */}
          {g.winners.length > 0 || g.status === "finished" ? (
            <Badge tone="neutral">
              <Trophy className="size-3" /> Розіграно
            </Badge>
          ) : g.status === "ending" ? (
            <Badge tone="live">Завершується</Badge>
          ) : (
            <Badge tone="success">Активний</Badge>
          )}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-bold leading-snug text-ink text-balance">
          {g.prize}
        </h3>
        <p className="text-xs text-ink-subtle">{g.sponsor}</p>

        <div className="mt-auto flex items-center justify-between pt-3 shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)]">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Users className="size-3.5 text-ink-subtle" />
            <span className="tnum font-semibold">{formatInt(g.entrants)}</span>
            учасників
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-semibold",
              ewc ? "text-[rgb(255_154_64)]" : "text-accent",
            )}
          >
            Участь
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
