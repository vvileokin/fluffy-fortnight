import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Ukrainian-locale integer formatting with a thin-space grouping. */
export function formatInt(n: number): string {
  return new Intl.NumberFormat("uk-UA").format(n);
}

/** Compact follower/prize formatting: 12 500 -> 12,5K. */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat("uk-UA", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
