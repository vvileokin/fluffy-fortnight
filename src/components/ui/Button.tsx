import * as React from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Variant = "accent" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-150 " +
  "ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-[2px] motion-reduce:active:translate-y-0 " +
  "disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

// Impeccable: Crafted Button Set — the primary action is a lit key with real
// travel (`.key` supplies the bevel + body + press collapse). The quiet
// variants trade their outlines for hairline rings and inset light, so a page
// of controls stops reading as a spreadsheet of boxes.
const variants: Record<Variant, string> = {
  accent:
    "key bg-accent text-accent-ink hover:bg-accent-hover",
  secondary:
    "bg-surface-3 text-ink hover:bg-surface-2 shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_10%,transparent),0_1px_0_0_color-mix(in_oklch,var(--ink)_12%,transparent)_inset]",
  outline:
    "text-ink hover:bg-surface-2 shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_18%,transparent)] hover:shadow-[0_0_0_1px_color-mix(in_oklch,var(--ink)_30%,transparent)]",
  ghost: "text-ink-subtle hover:text-ink",
  danger:
    "bg-danger text-white hover:opacity-90 shadow-[0_1px_0_0_color-mix(in_oklch,#fff_28%,transparent)_inset,0_8px_24px_-12px_var(--danger)]",
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
