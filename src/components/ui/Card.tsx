import * as React from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type CardProps = {
  as?: "div" | "article" | "section";
  href?: string;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
};

const shell =
  "relative rounded-lg border border-border bg-surface";

const interactiveShell =
  "card-interactive hover:border-border-strong hover:bg-surface-2 " +
  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

export function Card({
  as: Tag = "div",
  href,
  interactive,
  className,
  children,
}: CardProps) {
  if (href) {
    return (
      <Link
        href={href}
        className={cn(shell, interactiveShell, "block", className)}
      >
        {children}
      </Link>
    );
  }
  return (
    <Tag className={cn(shell, interactive && interactiveShell, className)}>
      {children}
    </Tag>
  );
}
