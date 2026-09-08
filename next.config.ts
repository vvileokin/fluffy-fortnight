import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    /* The optimizer is off, and the site is the better for it.
     *
     * Vercel's image optimization answers 402 on this plan — its quota is
     * spent — so every `next/image` on the site was serving a broken image
     * while the file behind it sat there returning 200. That is what took the
     * team crests down last week and the Major banner today; the crests were
     * fixed by taking them off the optimizer one at a time, which was right for
     * them and does not scale to the other seven places that still use it.
     *
     * Unoptimized, `next/image` emits the original file and keeps every layout
     * prop it already has, so nothing about these components changes except
     * that they work. The cost is bytes: the hero is 265 KB, the crests are a
     * couple each. Worth paying while the alternative is a page of broken
     * pictures. Turn it back on when the quota is. */
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    // AVIF first. Most of the artwork here is skin renders — smooth gradients,
    // glow, dark backgrounds — which is exactly what WebP at the default
    // quality mangles into banding. AVIF holds those at a smaller file than
    // WebP needs, and browsers that don't take it fall through to WebP.
    formats: ["image/avif", "image/webp"],
    // Next 16 refuses any `quality` not listed here, so raising it on a
    // component means allowing it here first. 75 stays for everything that
    // doesn't ask.
    qualities: [75, 90],
  },
};

export default withNextIntl(nextConfig);
