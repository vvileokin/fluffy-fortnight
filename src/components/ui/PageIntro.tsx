import { type LucideIcon } from "lucide-react";

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
    <div className="flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
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
