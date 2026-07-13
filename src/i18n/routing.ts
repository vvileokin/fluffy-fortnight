import { defineRouting } from "next-intl/routing";

// Ukrainian only. (English was removed — single-language site, clean URLs.)
export const routing = defineRouting({
  locales: ["uk"],
  defaultLocale: "uk",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
