import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Gift, Users, ArrowRight, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BrandIcon } from "@/components/ui/BrandIcon";
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
        "group lift relative flex h-full flex-col overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
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
          /* No scrim. It existed to seat the chips, but both of them carry
             their own opaque plate, so all the gradient did was mute artwork
             that is the entire reason someone looks at this card. */
          <Image
            src={g.image}
            alt=""
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 440px"
            quality={90}
            className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
          />
        ) : (
          <Gift
            className="size-10 text-ink opacity-80 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5"
            strokeWidth={1.75}
            style={{ color: ewc ? "rgb(255 138 24)" : g.cover }}
          />
        )}
        {/* `flex`, not a bare block: the badge is inline-flex, so inside a block
            it sits on a text baseline and picks up ~3px of leading above it —
            which is exactly how far it hung below the price chip on the right. */}
        <div className="absolute left-3 top-3 flex">
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
            <Badge tone={ewc ? "ewc" : "success"}>Активний</Badge>
          )}
        </div>

        {/* The price of a ticket, opposite the status. A paid giveaway that
            looks free until you open it is the one thing this card must not
            do — the cost is the first question anyone has about it. */}
        {g.entryCost > 0 && g.winners.length === 0 && g.status !== "finished" && (
          <span
            className={cn(
              // Same 22px box as Badge, so the price and the status chip sit on
              // one line across the card instead of each finding its own centre.
              "tnum absolute right-3 top-3 flex h-[1.375rem] items-center gap-1 rounded-md px-2 font-mono text-xs font-bold",
              "bg-black/45 backdrop-blur-[2px]",
              ewc ? "text-[rgb(255_154_64)]" : "text-accent",
            )}
          >
            <BrandIcon
              name={g.entryCurrency === "ewc" ? "points-ewc" : "points"}
              className="size-3.5"
            />
            {g.entryCost}
          </span>
        )}
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
