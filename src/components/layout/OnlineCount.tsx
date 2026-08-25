"use client";

import { useOnlineCount } from "@/lib/supabase/use-online";

/**
 * Impeccable: Crafted Presence — how many others are here, beside the mark.
 *
 * The rail's header row was a logo and 150px of nothing, and the one fact worth
 * putting there is the one a visitor cannot work out alone: whether the place
 * is busy. On a site whose whole point is other people predicting against each
 * other, "37 online" is the difference between a board and a room.
 *
 * Deliberately small and unlit. It is context, not a metric — the moment it
 * competes with the wordmark beside it, the header stops being a header. So:
 * the same subtle ink as the nav's resting state, a dot at the size of a
 * full stop, and no card, border or pill around either.
 *
 * Nothing renders until the count is known, and nothing renders if realtime
 * never answers. A live figure that silently falls back to a stale or invented
 * one is worse than an empty corner.
 *
 * Desktop only by construction: the rail it lives in is `hidden lg:flex`, so
 * this needs no breakpoint of its own — and the phone header, which carries
 * three stat capsules and a bell across ~360px, has nothing to spare.
 */
export function OnlineCount() {
  const online = useOnlineCount();
  if (online === null) return null;

  return (
    <span
      className="flex items-center gap-1.5 text-xs font-semibold text-ink-subtle"
      title={`${online} на сайті зараз`}
    >
      {/* Brand yellow, not the usual green. Green is the site's "correct" —
          it marks a prediction that landed — and spending it on an ambient
          count would put the reward colour somewhere nothing was won. The mark
          it sits beside is already yellow, so the dot reads as part of the
          logo's row rather than a status light bolted onto it.

          The pulse is the only motion in the rail, which is why it is a slow
          opacity breath and not a ping: a ring expanding out of the corner of
          the header would pull the eye off the page every two seconds. */}
      <span
        aria-hidden
        className="online-dot size-1.5 shrink-0 rounded-full bg-accent"
      />
      <span className="tnum font-mono">{online}</span>
    </span>
  );
}
