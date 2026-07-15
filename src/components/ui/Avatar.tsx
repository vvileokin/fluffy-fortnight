import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
} as const;

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

  // Avatars can come from arbitrary OAuth/Telegram hosts, so a plain <img> is
  // used instead of next/image to avoid remote-host allow-listing.
  if (src) {
    return (
      <span className={cn(base, "bg-surface-3")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="size-full object-cover" />
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
