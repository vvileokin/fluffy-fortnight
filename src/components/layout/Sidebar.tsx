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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-surface lg:flex">
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
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                active
                  ? "bg-surface-2 text-ink"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
              )}
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  active ? "text-accent" : "text-ink-subtle group-hover:text-ink-muted",
                )}
                strokeWidth={2.25}
              />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        {/* Partners — dim and unobtrusive (sign-in lives in the topbar) */}
        <div className="border-t border-border px-1 pt-3">
          <p className="mb-2 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-faint">
            {t("partners")}
          </p>
          <Partners />
        </div>
      </div>
    </aside>
  );
}
