import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { logAdmin } from "@/lib/admin-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/db/paginate";
import { recomputeStreaks } from "@/lib/db/streaks";

/**
 * Write everyone's streak record in, once.
 *
 * `recomputeStreaks` replays a player's entire resolved history from scratch,
 * so the record is derived rather than accumulated — running it over every
 * profile is the whole backfill. It is also safe to re-run at any time, which
 * is why this is a button and not a one-shot migration: if the replay rule ever
 * changes, the fix is to press it again.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { rows, error } = await fetchAllRows<{ id: string }>((from, to) =>
    admin.from("profiles").select("id").order("id", { ascending: true }).range(from, to),
  );
  if (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }

  const ids = rows.map((r) => r.id);
  // Chunked so one run can't hold a huge working set in memory; the replay
  // itself reads the full prediction history per call, so the chunks stay big.
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    await recomputeStreaks(admin, ids.slice(i, i + CHUNK));
  }

  await logAdmin("users", `Перерахував стріки — ${ids.length} профілів`);
  return NextResponse.json({ ok: true, profiles: ids.length });
}
