"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { primaryNav } from "@/lib/nav";
import { promoBanner, promoHref, type PromoBanner } from "@/lib/data";
import { Brand } from "./Brand";
import { Partners } from "./Partners";
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
      <div className="flex h-16 items-center px-5">
        <Brand />
      </div>

      {promo.enabled && promo.image && (
        <Link
          href={promoHref(promo)}
          className="group relative mx-3 mb-1 block h-[120px] overflow-hidden rounded-lg border border-border"
          aria-label="Promo"
        >
          <Image
            src={promo.image}
            alt=""
            width={448}
            height={240}
            className="h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
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
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-md px-3.5 text-[0.9375rem] font-extrabold tracking-tight transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                active
                  ? "bg-accent text-accent-ink"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  active ? "text-accent-ink" : "text-ink-subtle group-hover:text-ink-muted",
                )}
              />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

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
