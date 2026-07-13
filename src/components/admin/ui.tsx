import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  tone = "ink",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "ink" | "accent" | "success" | "warning" | "danger";
}) {
  const toneCls = {
    ink: "text-ink",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Icon className={cn("size-4", toneCls)} />
      <p className={cn("tnum mt-2 font-mono text-2xl font-bold", toneCls)}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-subtle">{label}</p>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface",
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
