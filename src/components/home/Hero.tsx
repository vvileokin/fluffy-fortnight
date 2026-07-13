import { useTranslations } from "next-intl";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Hero() {
  const t = useTranslations("home");
  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-surface">
      <div className="pointer-events-none absolute inset-0 aura-accent" />
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent) 18%, transparent), transparent 70%)",
        }}
      />

      <div className="relative px-5 py-8 sm:px-8 sm:py-11 lg:px-10 lg:py-14">
        <h1 className="max-w-[16ch] text-balance text-[clamp(1.9rem,6vw,3.4rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink">
          {t("heroTitleStart")}{" "}
          <span className="text-accent">{t("heroTitleAccent")}</span>
        </h1>

        <p className="mt-4 max-w-[52ch] text-pretty text-sm leading-relaxed text-ink-muted sm:text-base">
          {t("heroSubtitle")}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button href="/interactives" size="lg" className="glow-accent">
            <Target className="size-4" strokeWidth={2.5} />
            {t("startPredicting")}
          </Button>
          <Button href="/tournaments" variant="outline" size="lg">
            {t("viewTournaments")}
          </Button>
        </div>
      </div>
    </section>
  );
}
