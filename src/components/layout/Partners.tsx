import { cn } from "@/lib/utils";
import { BETKING_URL } from "@/components/ui/BetkingMark";
import ticker from "./PartnerTicker.module.css";

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
    ticker: "h-[9px]",
    tickerLogo: "/brand/partner-betking.svg",
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
    ticker: "h-[15px] -translate-y-px",
    // The ticker is a white ribbon, where the white wordmark would vanish —
    // same artwork with the wordmark inked dark.
    tickerLogo: "/brand/partner-hellcase-dark.svg",
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

// Twelve passes of the pair, so the track is two identical halves and sliding
// it by exactly half lands on a frame indistinguishable from the start. Six
// pairs run ~1400px, which still covers the widest screen the bottom bar is
// shown on (it goes away at lg, 1024px).
const TICKER_PASSES = 12;

/**
 * Partner ticker — the strip riding on top of the mobile bottom bar. Phones
 * have no sidebar, so this is where the partners live there. Only the first
 * pass is announced and focusable; the rest are the same links repeated for
 * the loop.
 */
export function PartnerTicker({ className }: { className?: string }) {
  return (
    <div
      aria-label="Партнери"
      role="group"
      // White in both themes: it is the partners' ribbon, not a surface of
      // this product, and their marks are drawn to be read on white.
      className={cn(ticker.ticker, "overflow-hidden bg-white", className)}
    >
      <div className={ticker.mask}>
        <div className={cn(ticker.track, "flex w-max items-center")}>
          {Array.from({ length: TICKER_PASSES }, (_, pass) =>
            partners.map((p) => (
              <a
                key={`${pass}-${p.name}`}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                aria-label={pass === 0 ? p.name : undefined}
                aria-hidden={pass === 0 ? undefined : true}
                tabIndex={pass === 0 ? undefined : -1}
                className="flex h-7 shrink-0 items-center px-6"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.tickerLogo}
                  alt=""
                  decoding="async"
                  className={cn("w-auto", p.ticker)}
                />
              </a>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
