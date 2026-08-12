import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { type GlyphIcon } from "@/components/layout/NavGlyphs";
import { cn } from "@/lib/utils";

export function SectionHeader({
  icon: Icon,
  iconTone = "accent",
  title,
  hint,
  href,
  hrefLabel,
  className,
}: {
  icon?: GlyphIcon;
  /**
   * `accent` for a page's own sections; `muted` when the header shares a page
   * with the small uppercase section labels, so all the marks read as one set
   * instead of one of them shouting.
   */
  iconTone?: "accent" | "muted";
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  const t = useTranslations("home");
  const seeAll = hrefLabel ?? t("seeAll");
  return (
    /* Impeccable: Crafted Section Rail — aligned on the baseline, not the box.
       Centring put the two boxes' midpoints on the same line, which is not the
       same thing: 20px and 14px text centred together sit ~2px apart at the
       baseline, and that's the drift you could see. The link keeps a full 44px
       hit area via padding that cancels itself out, so the target is untouched
       while the type lines up. */
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <div className="flex min-w-0 items-baseline gap-2.5">
        {/* Impeccable: Crafted Section Mark — bare glyph in the accent, sized to
            the heading beside it. No tile, no ring. */}
        {/* An <svg> has no baseline of its own, so it would hijack the group's.
            `self-center` keeps it out of the baseline calculation and optically
            centred on the heading it labels. */}
        {Icon && (
          <Icon
            className={cn(
              "size-4 shrink-0 self-center sm:size-5",
              iconTone === "muted" ? "text-ink-subtle" : "text-accent",
            )}
          />
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-tight tracking-tight text-ink sm:text-xl">
            {title}
          </h2>
          {hint && <p className="truncate text-xs text-ink-subtle">{hint}</p>}
        </div>
      </div>
      {/* Impeccable: Crafted See-All — a link, not a button. It brightens from
          grey to white on hover; it never grows a plate under the cursor. */}
      {href && (
        <Link
          href={href}
          className="group -my-2.5 inline-flex shrink-0 items-center gap-1 py-2.5 text-sm font-semibold leading-6 text-ink-subtle transition-colors hover:text-ink"
        >
          {seeAll}
          <ArrowRight className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
