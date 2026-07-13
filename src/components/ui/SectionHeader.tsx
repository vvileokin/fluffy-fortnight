import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  icon: Icon,
  title,
  hint,
  href,
  hrefLabel,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  const t = useTranslations("home");
  const seeAll = hrefLabel ?? t("seeAll");
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-accent">
            <Icon className="size-4" strokeWidth={2.25} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-ink sm:text-xl">
            {title}
          </h2>
          {hint && (
            <p className="truncate text-xs text-ink-subtle">{hint}</p>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
        >
          {seeAll}
          <ArrowRight className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
