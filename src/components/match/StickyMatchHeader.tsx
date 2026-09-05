"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The match banner, kept on screen after it has scrolled away.
 *
 * On a phone the header is the tallest thing on the page — two crests, two
 * names, a map strip — and it is also the only thing that says which match the
 * questions below it belong to. Scroll past it and every card underneath is a
 * coefficient with no teams attached, which is exactly when a reader is most
 * likely to be placing one.
 *
 * So the full banner stays where it is and a compact line of it takes over:
 * crest, tag, score, tag, crest, sitting under the top bar. It is not a second
 * header competing with the first — the two are never on screen together. An
 * observer watches the real banner and hands over at the moment it goes under.
 *
 * Only on phones. With a mouse the page is short enough, and the desktop
 * scoreboard is wide rather than tall.
 */
/** The top bar's own height on a phone. The scrim starts here, so the band
 *  under the chrome is continuous rather than a floating rectangle. */
const TOPBAR = 56;

/** Where the strip sits: the bar, then 10px, so it reads as a separate object
 *  resting under the chrome rather than welded to it. One number, used both to
 *  place the strip and to decide when it appears, so the two can't drift. */
const BAR_TOP = 66;

export function StickyMatchHeader({
  children,
  bar,
}: {
  children: React.ReactNode;
  bar: React.ReactNode;
}) {
  const heroRef = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    /* The top bar is 56px on a phone and sticks at the top of the document, and
       the strip rests 16px below it. Pulling the observer's own top edge down
       to exactly where the strip will appear means the handover happens as the
       banner passes that line — the compact copy arrives where the real one
       left, and the two are never on screen together. */
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting),
      { rootMargin: `-${BAR_TOP}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* The strip comes first in the markup for a layout reason, not a reading
          one: this pair is dropped into a `space-y-*` parent, and Tailwind v4
          spaces children by giving every one but the last a bottom margin. A
          fixed element ignores a bottom margin but would be pushed by a top
          one, so putting it first means it inherits the harmless half and the
          banner below keeps the spacing it had before this wrapper existed. */}
      {/* Inert until it is wanted: `hidden` would drop the transition, so it
          keeps its box and gives up its pointer events and its place in the
          reading order instead. */}
      <div
        aria-hidden={!shown}
        {...(shown ? {} : { inert: "" as unknown as boolean })}
        style={{ top: TOPBAR, paddingTop: BAR_TOP - TOPBAR }}
        className={cn(
          "fixed inset-x-0 z-30 px-3 pb-3.5 md:hidden",
          "transition-[opacity,transform] duration-200 ease-out",
          "motion-reduce:transition-none motion-reduce:transform-none",
          shown
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1.5 opacity-0",
        )}
      >
        {/* A scrim, not a border. The strip floats over content that keeps
            moving underneath it, and an opaque plate on its own still reads as
            pasted onto whatever happens to be passing — a pale card behind it
            and the two merge. So the page colour is laid back over the strip's
            whole band and blurs what shows through, then both are faded out
            below by the same mask, which is what keeps the bottom edge of the
            effect from being a visible line of its own.

            The band starts at the top bar rather than at the strip, so the
            10px above the plate is page colour too. The plate still reads as
            separate: it wears the event's violet floor and ember ring against
            the site's near-black navy. */}
        {/* Solid only where it has to be — the 10px window above the strip,
            where content would otherwise glow through and draw a pale seam that
            moves as the page does. Everything past that is already behind the
            strip's own opaque plate, so the scrim starts giving way there and
            is nearly gone by the time it reappears underneath. Held any longer
            and the band reads as a dark shelf in its own right, which is worse
            than the seam it was put there to cover. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,var(--bg)_0%,var(--bg)_58%,transparent_100%)] backdrop-blur-sm [mask-image:linear-gradient(to_bottom,black_58%,transparent)]"
        />
        <div className="relative">{bar}</div>
      </div>
      <div ref={heroRef}>{children}</div>
    </>
  );
}
