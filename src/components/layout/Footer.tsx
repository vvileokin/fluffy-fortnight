"use client";

import { useTranslations } from "next-intl";
import { Partners } from "./Partners";

/**
 * The foot of the page on phones: the partners, and nothing else.
 *
 * On a desktop the partners sit at the bottom of the sidebar, which is always
 * on screen, so there is no footer there at all. A phone has no sidebar and the
 * bottom bar has no room, so this strip is the one place they can live without
 * interrupting anything.
 *
 * A fuller footer — brand, copyright, section links — was here briefly and was
 * taken out on request. If it comes back, it belongs in this component.
 */
export function Footer() {
  const t = useTranslations("nav");

  return (
    /* Phones clear the fixed bottom bar here rather than on <main>: this is the
       last thing on the page, so it is the thing that must not sit underneath
       the bar. */
    <footer className="mx-auto w-full max-w-[1320px] px-3 pb-28 pt-6 sm:px-6 lg:hidden">
      <div className="pt-5 shadow-[0_-1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)]">
        <p className="mb-3 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-dim">
          {t("partners")}
        </p>
        <Partners layout="strip" className="justify-start" />
      </div>
    </footer>
  );
}
