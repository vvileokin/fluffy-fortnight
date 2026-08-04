import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron-auth";
import { runValveStandingsSync } from "@/lib/valve-standings-sync";

/**
 * Weekly Valve Regional Standings sync, run by Vercel Cron (see vercel.json).
 * Valve publishes a new table every few weeks, not live, so weekly is already
 * more often than the data changes.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const r = await runValveStandingsSync();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 502 },
    );
  }
}

export const dynamic = "force-dynamic";
