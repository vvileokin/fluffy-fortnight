import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Gift, Check, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GiveawayEntry } from "@/components/giveaway/GiveawayEntry";
import { formatPrize } from "@/lib/data";
import { getGiveawayBySlug } from "@/lib/db/giveaways";

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
      <Link
        href="/giveaways"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-4" />
        Усі розіграші
      </Link>

      {/* Prize hero */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
        <div
          className="flex items-center gap-5 p-5 sm:p-7"
          style={{
            background: `linear-gradient(120deg, color-mix(in oklch, ${g.cover} 22%, var(--surface)), var(--surface) 70%)`,
          }}
        >
          <span
            className="grid size-16 shrink-0 place-items-center rounded-xl border border-border bg-surface-2 sm:size-20"
            style={{ color: g.cover }}
          >
            <Gift className="size-8 sm:size-10" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {g.status === "ending" ? (
                <Badge tone="live">Завершується</Badge>
              ) : (
                <Badge tone="success">Активний</Badge>
              )}
              <Badge tone="neutral">{formatPrize(g.valueUSD)}</Badge>
            </div>
            <h1 className="text-balance text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {g.prize}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">{g.sponsor}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Left: details */}
        <div className="space-y-6">
          <p className="text-pretty leading-relaxed text-ink-muted">
            {g.description}
          </p>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
              <ListChecks className="size-4 text-ink-subtle" />
              Умови участі
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {g.conditions.map((c) => (
                <li key={c} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-ink">{c}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right: entry / status */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <GiveawayEntry giveaway={g} />
        </div>
      </div>
    </div>
  );
}
