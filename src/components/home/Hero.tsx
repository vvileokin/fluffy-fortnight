import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { TargetGlyph } from "@/components/layout/NavGlyphs";
import { Button } from "@/components/ui/Button";

/**
 * Impeccable: Crafted Hero Bay — dressable. With no artwork set it stays the
 * floating slab of near-black with one cool pool of light low-left. Give it an
 * `image` and the photo becomes the bay, with a scrim keyed to the reading
 * direction so the headline sits on solid ground no matter what was uploaded —
 * an editor should not have to think about contrast to get a usable banner.
 *
 * One upload serves both screens, and it is never cropped. The bay holds a
 * fixed 3:1 box, so the artwork keeps its proportions everywhere and simply
 * gets smaller on a phone — 1180×393 on a desktop, 343×114 on a 375px screen.
 * A dressed bay carries no overlay copy: at 114px tall there is no room for a
 * headline, and a designed banner brings its own. The h1 survives as `sr-only`
 * so the page still has exactly one heading for search and screen readers.
 */
export function Hero({ image, href }: { image?: string; href?: string }) {
  const t = useTranslations("home");

  if (image) {
    return (
      /* A dressed banner is an advert for one thing, so it behaves like one:
         the whole bay is the link. `group` + `lift` give it the same press and
         hover the cards use, so it doesn't look decorative when it's clickable. */
      <Link
        href={href ?? "/tournaments"}
        className="group relative block aspect-[3/1] w-full overflow-hidden rounded-2xl bg-[color-mix(in_oklch,var(--surface)_60%,var(--bg))] shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_5%,transparent)_inset,0_30px_60px_-40px_oklch(0_0_0/1)] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:rounded-3xl"
      >
        <h1 className="sr-only">
          {t("heroTitleStart")} {t("heroTitleAccent")}
        </h1>
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 1180px, 100vw"
          className="object-cover object-center"
        />
      </Link>
    );
  }

  return (
    <section className="relative flex flex-col overflow-hidden rounded-3xl bg-[color-mix(in_oklch,var(--surface)_60%,var(--bg))] shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_5%,transparent)_inset,0_30px_60px_-40px_oklch(0_0_0/1)]">
      <div className="pointer-events-none absolute inset-0 aura-accent" />
      {/* Two pools, far apart and different temperatures: azure low-left,
          a cooler violet drifting off the right edge. One pool read as a
          gradient; two read as a room with lights in it. Both stay under
          half opacity — the slab is still dark navy first. */}
      <div
        className="pointer-events-none absolute -bottom-44 -left-24 h-[24rem] w-[40rem] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--info) 18%, transparent), transparent 68%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-28 -top-32 hidden h-[22rem] w-[30rem] rounded-full opacity-40 blur-3xl sm:block"
        style={{
          background:
            "radial-gradient(circle, oklch(0.58 0.17 292 / 0.3), transparent 68%)",
        }}
      />

      <div className="relative flex flex-1 flex-col justify-end px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11">
        <h1 className="max-w-[16ch] text-balance text-[clamp(1.9rem,6vw,3.4rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink">
          {t("heroTitleStart")}{" "}
          <span className="text-accent">{t("heroTitleAccent")}</span>
        </h1>

        <p className="mt-4 max-w-[52ch] text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
          {t("heroSubtitle")}
        </p>

        {/* One filled action, one bare one. The secondary route doesn't need a
            box drawn round it to be found. */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button href="/interactives" size="lg">
            <TargetGlyph className="size-4" />
            {t("startPredicting")}
          </Button>
          <Button href="/tournaments" variant="ghost" size="lg">
            {t("viewTournaments")}
          </Button>
        </div>
      </div>
    </section>
  );
}
