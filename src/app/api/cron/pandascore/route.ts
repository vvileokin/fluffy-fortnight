import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { runPandaScoreSync } from "@/lib/pandascore-sync";

/**
 * Hourly PandaScore sync, run by Vercel Cron (see vercel.json).
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Without that secret this
 * endpoint would be an open button for anyone to burn the API quota, so it is
 * checked here — there's no admin session on a cron request to check instead.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const sent = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !sameSecret(sent, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const r = await runPandaScoreSync();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // Returning 200 would tell Vercel the run succeeded; it didn't.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 502 },
    );
  }
}

/** Constant-time compare over digests — fixed width, no length leak. */
function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const dynamic = "force-dynamic";
