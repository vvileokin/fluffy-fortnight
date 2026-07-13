import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Favicon: the real CS2 UA logo, contained (never stretched) on a dark square.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  const data = readFileSync(join(process.cwd(), "public/brand/logo-cs2.png"));
  const src = `data:image/png;base64,${data.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000B18",
          borderRadius: 12,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={56} height={41} style={{ objectFit: "contain" }} />
      </div>
    ),
    size,
  );
}
