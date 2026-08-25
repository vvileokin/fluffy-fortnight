/** Where the partner's name points, everywhere it appears. */
export const BETKING_URL =
  "https://betking.com.ua/sports-book/?refcode=LAGpC3ROEguNo&register=true#/overview";

/**
 * BETKING lockup — the peaks mark plus the wordmark, as supplied.
 *
 * The viewBox is cropped to the artwork's real bounds. As delivered it carried
 * ~22px of empty margin on the left and ~21px above, which is exactly the sort
 * of baked-in padding that makes one size class produce a mark that looks
 * smaller than everything beside it. Cropped, a height class is the optical
 * height.
 *
 * Colour comes from `currentColor` so the one component covers the red-on-white
 * badge and any inverted placement later. It is a partner's mark: it is never
 * recoloured to the site's palette, and `SponsorBadge` is the only thing that
 * should be setting it.
 */
export function BetkingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="22.5 21.9 208.2 26.1"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M222.921 21.9521H219.268C213.297 21.9521 210.067 24.5836 209.155 29.759L207.548 38.826C207.109 41.3025 207.415 43.1425 208.497 44.4683C209.706 45.9491 211.845 46.7095 215.046 46.7879H218.659C224.53 46.6037 227.692 44.1182 228.595 38.9902L229.808 32.1461H218.945L217.964 37.7009H221.807L221.67 38.4558C221.391 39.9457 221.311 40.4727 219.797 40.5712H215.918C214.437 40.4727 214.351 40.1226 214.614 38.6309L216.122 30.0891C216.387 28.5992 216.605 28.1488 218.108 28.1488H221.998C223.581 28.1488 223.426 28.4898 223.198 29.7809H230.224L230.333 29.1627C230.638 26.8522 230.607 25.7744 229.16 24.1934C227.712 22.6123 225.945 21.9521 222.921 21.9521Z" />
      <path d="M105.832 46.8409H124.391L125.555 40.141H114.025L114.51 37.3436H123.638L124.674 31.3804H115.547L115.994 28.8036H127.524L128.684 22.1055H110.131L105.834 46.8428L105.832 46.8409Z" />
      <path d="M151.143 22.1035H130.72L129.558 28.8016H136.153L133.021 46.8408H140.519L143.651 28.8016H149.981L151.143 22.1035Z" />
      <path d="M198.483 31.6138H198.485C198.319 32.5694 198.297 33.5796 198.299 34.1048H198.149L193.515 22.1055H186.838L182.543 46.8428H189.57C189.57 46.8428 191.056 38.2791 191.304 36.8512C191.478 35.8519 191.518 34.8543 191.523 34.3437H191.675L196.661 46.8428H202.864L207.161 22.1055H200.133C200.133 22.1055 198.722 30.2479 198.485 31.6156L198.483 31.6138Z" />
      <path d="M176.066 22.1035L171.771 46.8408H179.033L183.328 22.1035H176.066Z" />
      <path d="M98.961 22.1035H86.2364L81.9414 46.8408H95.1128C101.277 46.8372 103.435 44.1419 104.237 39.5117C104.79 36.3313 104.13 34.1868 100.269 34.0719L100.294 33.9315C103.865 33.1674 104.963 31.9145 105.56 28.488C106.364 23.8597 103.812 22.1017 98.9647 22.1035H98.961ZM96.6612 38.6364C96.457 39.7634 96.3056 40.2758 94.6459 40.2776H90.1065L90.6172 37.3416H95.3955C96.8345 37.3416 96.8527 37.5769 96.6631 38.6364H96.6612ZM97.8339 30.0818C97.6187 31.3182 97.1117 31.3766 95.9846 31.3784H91.6531L92.1255 28.6594H96.4241C97.6753 28.6576 97.9889 29.1992 97.8339 30.0836V30.0818Z" />
      <path d="M174.224 22.1035H165.652L158.549 33.481H158.466L160.442 22.1035H153.179L148.884 46.8408H156.147L158.39 33.9205H158.477L162.51 46.8408H170.591L166.095 33.9424L174.224 22.1053V22.1035Z" />
      <path d="M71.7096 22.1045L58.56 33.451L49.3481 22.1045L36.1967 33.451L26.9847 22.1045L22.5693 47.5293L46.8312 44.6297L43.4718 47.8721L67.741 44.9708L71.7114 22.1045H71.7096Z" />
    </svg>
  );
}

/**
 * "Fueled by BETKING" — the sponsor plate on anything you can stake points on.
 *
 * White ground, always. The mark is a fixed red (#FF0043) that has to hold its
 * own value to stay legible as the partner's colour, and the site's surfaces
 * run from near-black to the event's deep maroon — on any of them the red goes
 * muddy. Giving it its own white plate is what keeps it correct everywhere
 * rather than correct on one page.
 *
 * Meant as the last child of a card that clips its own corners: full-bleed
 * across the bottom edge, so it reads as the card standing on the sponsor's
 * plate rather than a sticker dropped inside the padding. That's the same
 * device the tournament card already uses for its own partner strip.
 */
export function SponsorStrip({ className }: { className?: string }) {
  return (
    /* The plate is the link. It carries the partner's name on a card about
       staking, which is the one place on the site where a reader is already
       thinking about odds — so leaving it inert was leaving the most relevant
       impression on the page unclickable.

       `sponsored` on the rel is not decoration: it is the declaration search
       engines expect on a paid or affiliate destination, and it travels with
       `noopener noreferrer`, which stop the opened tab from reaching back into
       this one. The strip sits inside cards that are themselves links, so the
       click is stopped from bubbling — otherwise pressing the sponsor would
       navigate to the match instead. */
    <a
      href={BETKING_URL}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={(e) => e.stopPropagation()}
      aria-label="BetKing"
      className={
        "flex items-center justify-center gap-1.5 bg-white py-1.5 transition-[filter] hover:brightness-95 " +
        (className ?? "")
      }
    >
      <span className="text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-black/55">
        Fueled by
      </span>
      <BetkingMark className="h-2.5 w-auto text-[#FF0043]" />
    </a>
  );
}
