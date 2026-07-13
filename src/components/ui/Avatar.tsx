import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
} as const;

export function Avatar({
  name,
  size = "md",
  ring = false,
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  ring?: boolean;
  className?: string;
}) {
  const initials = name
    .split(/[\s_]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold text-accent-ink",
        "bg-[linear-gradient(135deg,var(--accent),oklch(0.78_0.16_92))]",
        ring && "ring-2 ring-accent/40 ring-offset-2 ring-offset-bg",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}
