import { Manrope } from "next/font/google";

/**
 * One family, several weights. Numerals run in Manrope too — its tabular
 * figures hold a column fine, and a scoreboard set in the same face as the
 * rest of the page reads as one product instead of two.
 */
export const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const fontVars = manrope.variable;
