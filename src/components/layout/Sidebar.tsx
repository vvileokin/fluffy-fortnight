"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { primaryNav, majorNav } from "@/lib/nav";
import { promoBanner, promoHref, type PromoBanner } from "@/lib/data";
import { Brand } from "./Brand";
import { Partners } from "./Partners";
import { OnlineCount } from "./OnlineCount";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ promo = promoBanner }: { promo?: PromoBanner }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    /* Impeccable: Crafted Sidebar — no seam, and only one step of separation.
       `surface-2` put the rail two steps above the canvas, which read as a
       different panel bolted on; one step is enough to say "docked" while the
       two planes still belong to the same room. */
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-surface lg:flex">
      <div className="flex h-16 items-center justify-between gap-3 px-5">
        <Brand />
        <OnlineCount />
      </div>

      {promo.enabled && promo.image && (
        <Link
          href={promoHref(promo)}
          /* Held at the artwork's own ratio, like the hero. A fixed 120px height
             cropped the banner top and bottom, so whatever it was built around
             sat outside the frame — and 16:9 was still 5% too wide for it,
             which on a card with crests at both edges is a clipped logo. The
             art is 1344×795; this class is the one line that follows it if the
             art is ever replaced with a different shape. */
          className="group relative mx-3 mb-1 block aspect-[1344/795] overflow-hidden rounded-lg border border-border"
          aria-label="Promo"
        >
          {/* Artwork, so it gets the same treatment as the covers and the hero
              rather than the default 75 the icons are happy with.

              No hover zoom. A banner is a finished composition — scaling it
              pushes its own edges out of the frame, which is the one thing a
              banner cannot afford. The cards zoom because their covers are
              backdrops with nothing to lose at the margin; the hero doesn't,
              and this is a hero in a narrower column. */}
          <Image
            src={promo.image}
            alt=""
            width={448}
            height={265}
            quality={90}
            className="h-full w-full object-cover object-center"
          />
          <span className="absolute inset-0 ring-1 ring-inset ring-white/5" />
        </Link>
      )}

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {primaryNav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              /* Impeccable: Crafted Nav Pill — the live section is a solid
                 yellow lozenge with a filled glyph, the same selector the
                 mobile bar uses. One selection language across the product. */
              style={
                item.accent
                  ? ({
                      "--accent": item.accent,
                      "--accent-ink": "var(--major-ink)",
                    } as React.CSSProperties)
                  : undefined
              }
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-md px-3.5 text-[0.9375rem] font-extrabold tracking-tight transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                active
                  ? "bg-accent text-accent-ink"
                  : item.accent
                    // The label goes with the glyph. Colouring the mark alone
                    // left a red crown beside grey type, which reads as an
                    // icon that has not finished loading rather than as a
                    // section with its own identity.
                    ? "text-[var(--major)] hover:bg-surface-2"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {/* The height lives on a wrapper so the optical correction is one
                  number here rather than a prop threaded through ten glyphs
                  that only ever needed a className. */}
              <span
                className="grid shrink-0 place-items-center"
                style={{ height: 18 * (item.iconScale ?? 1) }}
              >
                <Icon
                  className={cn(
                    "h-full w-auto",
                    active
                      ? "text-accent-ink"
                      : item.accent
                        ? "text-[var(--major)]"
                        : "text-ink-subtle group-hover:text-ink-muted",
                  )}
                />
              </span>
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      {/* The Major, in its own cell at the foot of the rail.
          Not a sixth row in the list: it is one event with its own colour and
          its own season, and inline it read as a section of this product that
          would still be here in March. The cell is lit from within — the same
          light the page itself is built on — so the rail has one warm thing at
          the bottom instead of six cold ones in a column. */}
      <div className="px-3 pb-5">
        <Link
          href={majorNav.href}
          aria-current={isActive(pathname, majorNav.href) ? "page" : undefined}
          className={cn(
            "major-cell group relative flex h-11 items-center gap-3 overflow-hidden rounded-lg px-3.5 text-[0.9375rem] font-extrabold tracking-tight",
            isActive(pathname, majorNav.href) && "major-cell-live",
          )}
        >
          <span
            className="relative grid shrink-0 place-items-center"
            style={{ height: 18 * (majorNav.iconScale ?? 1) }}
          >
            <majorNav.icon className="h-full w-auto text-[var(--major-hot)]" />
          </span>
          <span className="relative text-white">{t(majorNav.key)}</span>
        </Link>
      </div>

      <div className="px-3 pb-4">
        {/* Partners — dim and unobtrusive (sign-in lives in the topbar) */}
        <div className="shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] px-1 pt-3">
          <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-dim">
            {t("partners")}
          </p>
          <Partners />
        </div>
      </div>
    </aside>
  );
}
