import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Gift, Users, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatInt } from "@/lib/utils";
import { type Giveaway } from "@/lib/data";

export function GiveawayCard({ g }: { g: Giveaway }) {
  return (
    <Link
      href={`/giveaways/${g.slug}`}
      className="group card-interactive relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    >
      <div
        className="relative flex h-24 items-center justify-center"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, ${g.cover} 24%, var(--surface)), var(--surface) 75%)`,
        }}
      >
        {g.image ? (
          <>
            <Image
              src={g.image}
              alt=""
              fill
              sizes="(max-width:640px) 100vw, 360px"
              className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" />
          </>
        ) : (
          <Gift
            className="size-10 text-ink opacity-80 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5"
            strokeWidth={1.75}
            style={{ color: g.cover }}
          />
        )}
        <div className="absolute left-3 top-3">
          {g.status === "ending" ? (
            <Badge tone="live">Завершується</Badge>
          ) : (
            <Badge tone="success">Активний</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-bold leading-snug text-ink text-balance">
          {g.prize}
        </h3>
        <p className="text-xs text-ink-subtle">{g.sponsor}</p>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Users className="size-3.5 text-ink-subtle" />
            <span className="tnum font-semibold">{formatInt(g.entrants)}</span>
            учасників
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-accent">
            Участь
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
