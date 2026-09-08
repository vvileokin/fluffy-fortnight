"use client";

import * as React from "react";

/**
 * Turns the whole product the Major's colour while its page is open.
 *
 * The site's palette is one set of custom properties on the document root, and
 * nothing hard-codes yellow — every button, the sidebar's selected key, the
 * focus ring and the light in the background all ask for `--accent`. So the
 * entire look can be moved by re-pointing those properties once, which is what
 * `:root[data-major]` in globals.css does. This component's only job is to say
 * when.
 *
 * It has to be a client component and it has to be an attribute on the root: a
 * layout cannot know the pathname, and scoping the palette to a container would
 * leave the sidebar and the top bar still blue while the page beside them went
 * scarlet — which reads as a broken page rather than a themed one.
 *
 * Removed on the way out, including on a back-navigation, because the effect
 * belongs to the page and not to the session.
 */
export function MajorMode() {
  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-major", "");
    return () => root.removeAttribute("data-major");
  }, []);

  return null;
}
