import { cn } from "@/lib/utils";
import { type Team } from "@/lib/data";

const sizeMap = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 56,
  xl: 72,
} as const;

/**
 * Team logo rendered as a monochrome silhouette on the team's brand-colored
 * rounded tile (white on dark/saturated brands, black on light ones).
 */
export function TeamLogo({
  team,
  size = "md",
  ring = false,
  className,
}: {
  team: Team;
  size?: keyof typeof sizeMap;
  ring?: boolean;
  className?: string;
}) {
  const px = sizeMap[size];
  const radius = Math.max(4, Math.round(px * 0.22));
  const inner = Math.round(px * 0.64);
  const filter =
    team.ink === "black" ? "brightness(0)" : "brightness(0) invert(1)";

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        background: team.brand,
        boxShadow: ring
          ? "inset 0 0 0 1px rgba(255,255,255,0.12), 0 0 0 2px var(--surface)"
          : "inset 0 0 0 1px rgba(255,255,255,0.12)",
      }}
    >
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo}
          alt={team.name}
          width={inner}
          height={inner}
          style={{ width: inner, height: inner, objectFit: "contain", filter }}
        />
      ) : (
        <span
          style={{ fontSize: Math.round(px * 0.28), color: team.ink }}
          className="font-extrabold leading-none tracking-tight"
        >
          {team.tag}
        </span>
      )}
    </span>
  );
}
