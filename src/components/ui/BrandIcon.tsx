import { cn } from "@/lib/utils";

/**
 * Impeccable: Crafted Brand Icons — the low-poly render set.
 *
 * Every file in this set is a 128×128 transparent artboard with the subject
 * optically centred (see `scripts/brand-icons.mjs`, which is what puts them
 * there). That matters: because the artboards are identical squares, any single
 * size class renders any two of them on exactly the same axis, at exactly the
 * same apparent weight, with no per-call-site nudging. Alignment is baked into
 * the asset instead of being re-solved at every use.
 *
 * So the sizing rule here is one square class — `size-4`, `size-5` — never a
 * bare height. A height-only class would let the intrinsic aspect ratio set the
 * width, and the two icons have very different ratios (the gem is 1.06, the
 * flame 0.61), which is exactly how they drift out of line.
 *
 * These are decoration next to a number that already states the value, so they
 * are `aria-hidden` throughout; the accessible name lives on the parent.
 */
const SOURCES = {
  points: "/brand/points.webp",
  streak: "/brand/streak.webp",
  /** Event currency for EWC 2026 — same solid, the event's fire palette. */
  "points-ewc": "/brand/points-ewc.webp",
} as const;

export type BrandIconName = keyof typeof SOURCES;

export function BrandIcon({
  name,
  className,
  priority = false,
}: {
  name: BrandIconName;
  /** Must include a square size class, e.g. `size-4`. */
  className?: string;
  /** Set on icons above the fold (the top bar) so they don't pop in late. */
  priority?: boolean;
}) {
  return (
    <img
      src={SOURCES[name]}
      alt=""
      aria-hidden
      width={128}
      height={128}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      className={cn(
        "inline-block shrink-0 select-none object-contain",
        // A faceted render sitting on near-black otherwise reads as a sticker
        // pasted onto the page. One tight shadow grounds it without adding a
        // glow the design system hasn't asked for.
        "[filter:drop-shadow(0_1px_2px_oklch(0_0_0/0.55))]",
        className,
      )}
    />
  );
}
