import * as React from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Variant = "accent" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-150 " +
  "ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

const variants: Record<Variant, string> = {
  accent:
    "bg-accent text-accent-ink hover:bg-accent-hover shadow-[0_6px_24px_-12px_var(--accent)]",
  secondary: "bg-surface-3 text-ink hover:bg-surface-2 border border-border",
  outline:
    "border border-border-strong text-ink hover:bg-surface-2 hover:border-ink-faint",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-md",
  md: "h-11 px-4 text-sm rounded-lg", // 44px min touch target
  lg: "h-12 px-6 text-base rounded-lg",
};

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: undefined;
  };

type AnchorProps = BaseProps &
  Omit<React.ComponentProps<typeof Link>, "className" | "children"> & {
    href: string;
  };

export function Button(props: ButtonProps | AnchorProps) {
  const {
    variant = "accent",
    size = "md",
    className,
    children,
    href,
    ...rest
  } = props as BaseProps & { href?: string } & Record<string, unknown>;
  const classes = cn(base, variants[variant], sizes[size], className);

  if (typeof href === "string") {
    return (
      <Link
        href={href}
        className={classes}
        {...(rest as Omit<AnchorProps, keyof BaseProps | "href">)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      {...(rest as Omit<ButtonProps, keyof BaseProps>)}
    >
      {children}
    </button>
  );
}
