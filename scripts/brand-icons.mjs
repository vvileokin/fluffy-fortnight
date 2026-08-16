/**
 * Brand icon pipeline.
 *
 * The house style is low-poly faceted 3D renders on a transparent field. They
 * arrive as large square PNGs with the subject floating somewhere in the middle,
 * which means two files never line up with each other by themselves.
 *
 * This normalises them onto one artboard so alignment is a property of the
 * assets rather than something every call site has to fix with nudge classes:
 *
 *   1. trim to actual content
 *   2. scale into a per-icon optical box (not the full artboard — see below)
 *   3. centre on a transparent ARTBOARD×ARTBOARD canvas
 *
 * The optical box is the whole point. A chunky near-square gem contained in the
 * same box as a tall narrow flame reads about twice as heavy, because perceived
 * size follows area, not bounding box. Wide shapes get inset; tall narrow ones
 * fill. These percentages are eyeballed against each other and then checked in
 * the browser, which is the only way this ever gets settled.
 *
 * Run: node scripts/brand-icons.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTBOARD = 128;

const ICONS = [
  {
    src: "C:/Users/LNU/Downloads/points icon.png",
    out: "public/brand/points.webp",
    // 652×615 — nearly square and visually dense, so it sits inside the board.
    optical: 0.86,
  },
  {
    src: "C:/Users/LNU/Downloads/streak icon (2).png",
    out: "public/brand/streak.webp",
    // 409×673 — tall and narrow, so it fills the height to match the gem's mass.
    optical: 1.0,
  },
  {
    // EWC event currency. Same solid as the points gem, in the event's fire
    // palette, so it inherits the identical optical inset and lines up with it
    // wherever the two ever appear in the same column.
    src: "C:/Users/LNU/Downloads/Untitled - 11. August 2026 um 23.18.53.png",
    out: "public/brand/points-ewc.webp",
    optical: 0.86,
  },
  // Daily-reward tiers. These two arrived rendered on black with a glow rather
  // than on transparency, so they need lifting before the usual treatment —
  // see `liftFromBlack`.
  //
  // Same 0.86 box as the single gem, deliberately. Measured, a cluster fills
  // 73% of the artboard against the single gem's 47%, so letting them fill
  // would have made a tier icon read nearly twice as heavy as the currency it
  // is counting. Sharing the box lets the extra gems carry the tier on their
  // own — denser, not bigger.
  {
    src: "C:/Users/LNU/Downloads/ChatGPT Image 16. Aug. 2026, 22_36_55.png",
    out: "public/brand/points-stack.webp",
    optical: 0.86,
    liftFromBlack: true,
  },
  {
    src: "C:/Users/LNU/Downloads/ChatGPT Image 16. Aug. 2026, 22_45_34.png",
    out: "public/brand/points-pile.webp",
    optical: 0.86,
    liftFromBlack: true,
  },
];

/**
 * Turn a render that sits on black into one that sits on nothing.
 *
 * The subject's own luminance becomes the alpha channel, which is exactly right
 * for a glowing object photographed against black: the gem is bright so it goes
 * opaque, and the halo around it fades out on its own instead of needing a
 * hand-drawn mask. The `linear` boost steepens that curve so the gem's darker
 * facets don't come out semi-transparent — without it the solid reads as
 * see-through wherever a face turns away from the light.
 */
async function liftFromBlack(src) {
  const meta = await sharp(src).metadata();
  // Steep on purpose. A gentle curve leaves the halo at partial alpha, and
  // since the RGB underneath it is the original near-black, those pixels
  // composite as a dirty grey fringe around the subject. Pushing the toe hard
  // to zero drops the glow entirely and keeps only the solid.
  const alpha = await sharp(src)
    .greyscale()
    .linear(5.5, -120)
    .raw()
    .toBuffer();
  return sharp(src)
    .removeAlpha()
    .joinChannel(alpha, { raw: { width: meta.width, height: meta.height, channels: 1 } })
    .png()
    .toBuffer();
}

for (const icon of ICONS) {
  const box = Math.round(ARTBOARD * icon.optical);

  const source = icon.liftFromBlack ? await liftFromBlack(icon.src) : icon.src;

  const subject = await sharp(source)
    .trim({ threshold: 1 })
    .resize(box, box, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // `contain` pads the short axis, so the subject is already centred in `box`;
  // extending to the artboard keeps it centred.
  const pad = Math.round((ARTBOARD - box) / 2);
  const info = await sharp(subject)
    .extend({
      top: pad,
      bottom: ARTBOARD - box - pad,
      left: pad,
      right: ARTBOARD - box - pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 92, effort: 6 })
    .toFile(path.join(ROOT, icon.out));

  console.log(
    `${icon.out.padEnd(26)} ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)} KB`,
  );
}
