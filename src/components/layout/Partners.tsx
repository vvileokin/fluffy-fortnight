import { cn } from "@/lib/utils";

// Per-partner heights tuned so the marks read at the same visual size
// (BetKing's wordmark fills its box, so it's set a touch smaller than Hellcase).
const partners = [
  {
    name: "BetKing",
    logo: "/brand/partner-betking.svg",
    url: "https://betking.com.ua/sports-book/?refcode=LAGpC3ROEguNo&register=true#/overview",
    row: "h-3.5",
    strip: "h-4",
    offset: "",
  },
  {
    name: "Hellcase",
    logo: "/brand/partner-hellcase.svg",
    url: "https://hellcase.com/ua?utm_source=telegram&utm_medium=collaboration&utm_campaign=cs2ua&promocode=cs2ua",
    row: "h-[17px]",
    strip: "h-[22px]",
    offset: "-translate-y-[2px]",
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
            className={cn(
              "w-auto grayscale transition-[filter] duration-300 group-hover:grayscale-0",
              layout === "strip" ? p.strip : p.row,
              p.offset,
            )}
          />
        </a>
      ))}
    </div>
  );
}
