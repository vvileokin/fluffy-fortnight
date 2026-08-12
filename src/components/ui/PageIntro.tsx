import { type GlyphIcon } from "@/components/layout/NavGlyphs";
import { cn } from "@/lib/utils";

/**
 * Every page opens the same way: glyph, title, optional subtitle, on one
 * baseline. Keeping this the only page-title component is what makes the
 * headings line up across the whole product.
 */
export function PageIntro({
  icon: Icon,
  title,
  subtitle,
}: {
  icon?: GlyphIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    /* Impeccable: Crafted Page Title — pinned to a 44px box. Matches and
       Результати put a 44px action button beside the title, so with an
       auto-height title block the two pages' headings centred a few pixels
       lower than every other page's. Fixing the box means the h1 lands on the
       same baseline site-wide whether or not anything sits next to it. */
    <div
      className={cn(
        "flex min-h-11 gap-3",
        subtitle ? "items-start" : "items-center",
      )}
    >
      {Icon && (
        <Icon
          className={cn("size-6 shrink-0 text-accent", subtitle ? "mt-1.5" : "mt-0.5")}
        />
      )}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
