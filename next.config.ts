import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
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
