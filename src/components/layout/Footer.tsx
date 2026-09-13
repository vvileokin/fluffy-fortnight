"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { primaryNav, majorNav } from "@/lib/nav";
import { Brand } from "./Brand";
import { Partners } from "./Partners";

/** The year the site went up; the copyright runs from here to now. */
const SINCE = 2026;

/**
 * The foot of every page.
 *
 * Deliberately short: the brand, the copyright, and the sections a reader can
 * reach from here. No social icons and no legal links yet — the social URLs in
 * `data.ts` are placeholders pointing at the networks' home pages, and there are
 * no terms or privacy pages to link to. A footer full of links that go nowhere
 * useful is worse than one with four honest lines.
 *
 * Partners appear here on phones only. On a desktop they already sit at the
 * bottom of the sidebar, which is always on screen; a phone has no sidebar, and
 * the bottom bar has no room, so this is the one place they can live without
 * interrupting anything.
 */
export function Footer() {
  const t = useTranslations("nav");
  const f = useTranslations("footer");
  const now = new Date().getFullYear();
  const years = now > SINCE ? `${SINCE}–${now}` : String(SINCE);

  return (
    /* Phones clear the fixed bottom bar here rather than on <main>: the footer
       is now the last thing on the page, so it is the thing that must not sit
       underneath the bar. */
    <footer className="mx-auto w-full max-w-[1320px] px-3 pb-28 pt-10 sm:px-6 lg:pb-10">
      <div className="flex flex-col gap-8 pt-6 shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <Brand compact />
          <p className="text-sm font-semibold text-ink-muted">© {years} CS2 UA</p>
          <p className="max-w-[36ch] text-[0.8125rem] leading-relaxed text-ink-subtle">
            {f("tagline")}
          </p>
        </div>

        <nav aria-label={f("sections")} className="grid grid-cols-2 gap-x-12 gap-y-3 sm:grid-cols-3">
          {[...primaryNav, majorNav].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[0.875rem] font-semibold text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:text-ink"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="lg:hidden">
          <p className="mb-3 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-dim">
            {t("partners")}
          </p>
          <Partners layout="strip" className="justify-start" />
        </div>
      </div>
    </footer>
  );
}
