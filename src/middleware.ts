import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on all paths except API, the (non-localized) admin panel, generated
  // metadata routes (icon/sitemap/robots), Next internals and files with an
  // extension.
  matcher: [
    "/((?!api|auth|admin|icon|sitemap|robots|_next|_vercel|.*\\..*).*)",
  ],
};
