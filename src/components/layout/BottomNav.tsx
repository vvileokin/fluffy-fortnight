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
    /* Impeccable: Crafted Bottom Bar — icons only. Five Ukrainian labels at
       10px under five glyphs was noise; the icons already say it. The live tab
       is a solid yellow lozenge, the way a physical selector reads. Labels
       stay in the accessible name for screen readers and long-press. */
    <nav className="fixed inset-x-0 bottom-0 z-30 shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] bg-[color-mix(in_oklch,var(--surface)_86%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="relative grid grid-cols-5 px-2 py-2">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={t(item.key)}
              title={t(item.key)}
              className="flex h-12 items-center justify-center"
            >
              <span
                className={cn(
                  "grid h-11 w-[3.5rem] place-items-center rounded-md transition-[background-color,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  // Impeccable: Crafted Tab Light — the glow belongs to the
                  // selected key, not to the bar. It reads as the lozenge
                  // throwing light onto the surface under it.
                  active
                    ? "bg-accent text-accent-ink shadow-[0_2px_12px_-6px_color-mix(in_oklch,var(--accent)_45%,transparent),0_6px_20px_-14px_color-mix(in_oklch,var(--accent)_50%,transparent)]"
                    : "text-ink-subtle",
                )}
              >
                {/* Matched on height — see the tournament tab bar. A square box
                    renders the wide glyphs (team, crown) a third short. */}
                <Icon className="h-[21px] w-auto" />
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
