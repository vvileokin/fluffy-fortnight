import { notFound } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Check, ListChecks, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GiveawayEntry } from "@/components/giveaway/GiveawayEntry";
import { formatPrize } from "@/lib/data";
import { getGiveawayBySlug } from "@/lib/db/giveaways";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGiveawayBySlug(slug);
  return { title: g?.prize ?? "Розіграш" };
}

export default async function GiveawayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = await getGiveawayBySlug(slug);
  if (!g) notFound();

  return (
    <div className="space-y-6">
      {/* Same back link as the tournament and match pages: no plate on hover,
          no left inset. It was the only one styled as a button, which made the
          page look like it belonged to a different site. */}
      <Link
        href="/giveaways"
        className="-mt-2 inline-flex min-h-11 items-center gap-1 py-2 pr-2 text-sm font-semibold text-ink-subtle transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-4" />
        Усі розіграші
      </Link>

      {/* Prize hero — the same banner language the tournament and match pages
          use, so a giveaway run for the event is dressed by the event rather
          than by a generic panel.

          The stock gift glyph that used to sit on the left is gone: it was a
          placeholder standing in for artwork on a page whose whole subject is
          a picture of a skin, and it made every giveaway look identical. With
          `image` set the artwork *is* the hero; without it the block is simply
          shorter. */}
      {(() => {
        const ewc = g.skin === "ewc";
        return (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl",
              ewc ? "ewc-aura ewc-fire" : "surface-1",
            )}
            style={
              ewc
                ? undefined
                : {
                    background: `linear-gradient(120deg, color-mix(in oklch, ${g.cover} 22%, var(--surface)), var(--surface) 70%)`,
                  }
            }
          >
            {/* The artwork stays on the card in the listings and doesn't get
                repeated here: at full page width it needed a scrim heavy
                enough to bury the skin, which made the hero worse at both
                jobs. This block is the title, and the title only. */}
            <div className="relative flex flex-col justify-end p-5 sm:p-6">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {g.winners.length > 0 || g.status === "finished" ? (
                  <Badge tone="neutral">
                    <Trophy className="size-3" /> Розіграно
                  </Badge>
                ) : g.status === "ending" ? (
                  <Badge tone="live">Завершується</Badge>
                ) : (
                  <Badge tone={ewc ? "ewc" : "success"}>Активний</Badge>
                )}
                {/* A dollar figure is worth showing when there is one. This
                    giveaway is priced in EWC points, so the chip was rendering
                    a literal "$0" next to a prize that costs ten of them. */}
                {g.valueUSD > 0 && <Badge tone="neutral">{formatPrize(g.valueUSD)}</Badge>}
              </div>
              <h1 className="text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {g.prize}
              </h1>
              <p className="mt-1 text-sm text-ink-muted">{g.sponsor}</p>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Left: details */}
        <div className="space-y-6">
          {/* Smaller on phones, where this paragraph sat above the fold and
              pushed the entry card off it. */}
          <p className="text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
            {g.description}
          </p>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
              <ListChecks className="size-4 text-ink-subtle" />
              Умови участі
            </h2>
            <ul
              className={cn(
                "divide-y overflow-hidden rounded-lg",
                // A white hairline across an ember plate is the one seam that
                // reads as a scratch rather than a division — it's the only
                // cool-toned thing on the panel. Warm it to the same family.
                g.skin === "ewc"
                  ? "ewc-aura-card divide-[rgb(var(--ewc-ring)/0.16)]"
                  : "surface-1 divide-[color-mix(in_oklch,var(--ink)_6%,transparent)]",
              )}
            >
              {g.conditions.map((c) => (
                <li key={c} className="flex items-center gap-3 px-4 py-3">
                  {/* Green is the site's "done" colour, and these aren't done —
                      they're the terms. On the event they take the ember, same
                      as every other cue on an EWC surface. */}
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full",
                      g.skin === "ewc"
                        ? "bg-[rgb(var(--ewc-ember)/0.20)] text-[rgb(255_154_64)]"
                        : "bg-success/15 text-success",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-ink">{c}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right: entry / status.
            It used to be `self-start` so it could stick, which left its plate
            ending 25px short of the conditions beside it — a step with nothing
            to explain it. The page is one short paragraph and four rules long,
            so there was never enough scroll for sticky to earn that. */}
        <div className="flex flex-col">
          <GiveawayEntry giveaway={g} />
        </div>
      </div>
    </div>
  );
}
