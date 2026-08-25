import { cn } from "@/lib/utils";
import { BETKING_URL } from "@/components/ui/BetkingMark";

// Per-partner heights tuned so the marks read at the same visual size.
// BetKing's lockup is much wider than it is tall (mark + wordmark, ~8:1), so
// matching Hellcase on height would make it dominate the row — it's matched on
// width instead.
const partners = [
  {
    name: "BetKing",
    logo: "/brand/partner-betking.svg",
    url: BETKING_URL,
    row: "h-2.5",
    strip: "h-3",
    offset: "",
    // Solid red artwork: greyscale turns it a muddy mid-grey that reads far
    // dimmer than Hellcase's white wordmark, so it's forced white instead and
    // drops back to its own red on hover.
    idle: "brightness-0 invert",
    hover: "group-hover:brightness-100 group-hover:invert-0",
  },
  {
    name: "Hellcase",
    logo: "/brand/partner-hellcase.svg",
    url: "https://hellcase.com/ua?utm_source=telegram&utm_medium=collaboration&utm_campaign=cs2ua&promocode=cs2ua",
    row: "h-[17px]",
    strip: "h-[22px]",
    offset: "-translate-y-[2px]",
    // Its wordmark is already white; only the gradient mark needs desaturating.
    idle: "grayscale",
    hover: "group-hover:grayscale-0",
  },
];

/**
 * Partner logos — dim and unobtrusive by default, brighten on hover.
 * `layout="row"` for the sidebar footer, `layout="strip"` for wider footers.
 */
export function Partners({
  layout = "row",
  className,
}: {
  layout?: "row" | "strip";
  className?: string;
}) {
  return (
    <div
      className={cn(
        layout === "strip"
          ? "flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
          : "flex items-center gap-4",
        className,
      )}
    >
      {partners.map((p) => (
        <a
          key={p.name}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={p.name}
          className="group inline-flex items-center opacity-45 transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.logo}
            alt={p.name}
            loading="lazy"
            decoding="async"
            className={cn(
              "w-auto transition-[filter] duration-300",
              p.idle,
              p.hover,
              layout === "strip" ? p.strip : p.row,
              p.offset,
            )}
          />
        </a>
      ))}
    </div>
  );
}
