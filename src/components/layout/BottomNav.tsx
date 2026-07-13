"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { bottomNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[color-mix(in_oklch,var(--surface)_86%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-16 flex-col items-center justify-center gap-1"
            >
              {active && (
                <span className="absolute top-0 h-[2px] w-8 rounded-full bg-accent" />
              )}
              <Icon
                className={cn("size-[22px]", active ? "text-accent" : "text-ink-subtle")}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={cn(
                  "text-[0.625rem] font-semibold leading-none",
                  active ? "text-ink" : "text-ink-subtle",
                )}
              >
                {t(item.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
