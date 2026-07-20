import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageIntro({
  icon: Icon,
  title,
  subtitle,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    // With a subtitle the icon lines up with the title; on its own it centres.
    <div className={cn("flex gap-3", subtitle ? "items-start" : "items-center")}>
      {Icon && (
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent",
            subtitle && "mt-0.5",
          )}
        >
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
      )}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
