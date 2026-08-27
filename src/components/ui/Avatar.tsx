import Image from "next/image";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
  /** Podium first place — the one avatar on the site that gets to be a portrait. */
  xl: "size-[4.25rem] text-2xl",
} as const;

/** Rendered pixels per size, so the optimiser is asked for what is displayed. */
const px = { sm: 32, md: 36, lg: 48, xl: 68 } as const;

/**
 * Our own storage, which `next.config` already allows the optimiser to touch.
 *
 * Everything else — Telegram, Google, whatever an OAuth provider hands back —
 * stays a plain `<img>`, because allow-listing arbitrary hosts is worse than
 * shipping their bytes.
 */
const OPTIMISABLE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//;

export function Avatar({
  name,
  src,
  size = "md",
  ring = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  ring?: boolean;
  className?: string;
}) {
  const base = cn(
    "inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-accent-ink",
    ring && "ring-2 ring-accent/40 ring-offset-2 ring-offset-bg",
    sizes[size],
    className,
  );

  if (src) {
    // Ours goes through the optimiser: a 236 KB upload was being shipped whole
    // to draw a 32px circle, on every page that lists players — which is most
    // of them. Resized and re-encoded it is a couple of kilobytes, and the
    // leaderboard stops being the heaviest thing on the site.
    if (OPTIMISABLE.test(src)) {
      const n = px[size];
      return (
        <span className={cn(base, "bg-surface-3")}>
          <Image
            src={src}
            alt={name}
            width={n}
            height={n}
            sizes={`${n}px`}
            loading="lazy"
            className="size-full object-cover"
          />
        </span>
      );
    }
    return (
      <span className={cn(base, "bg-surface-3")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} loading="lazy" decoding="async" className="size-full object-cover" />
      </span>
    );
  }

  const initials = name
    .split(/[\s_]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cn(base, "bg-[linear-gradient(135deg,var(--accent),oklch(0.78_0.16_92))]")}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}
