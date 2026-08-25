import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { render, send, type Outbox } from "@/lib/telegram-notify";

/**
 * Drains the Telegram outbox.
 *
 * Queued rather than sent inline because settling one popular question touches
 * a couple of hundred players and Telegram is an HTTP call each: a route that
 * sent them itself would hold the admin's request open for minutes and lose the
 * whole settlement to one API hiccup. The settlement writes rows; this empties
 * them.
 *
 * `tg_claim` bumps `attempts` and takes its rows with `skip locked`, so two
 * runs overlapping cannot both pick up the same message — which on a
 * notification queue means one person hearing the same thing twice.
 *
 * A row that fails three times stops being retried. It is kept, with the error
 * on it, because "the bot stopped writing to me" is only diagnosable if the
 * refusals are still there to read.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 25;

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("tg_claim", { p_limit: BATCH });
  if (error) {
    // Migration 0059 may not have run yet, and a cron that 500s every minute
    // is noise, not a signal.
    const missing = error.code === "PGRST202" || error.code === "42883";
    return NextResponse.json(
      { ok: missing, pending: 0, ...(missing ? {} : { error: error.message }) },
      { status: missing ? 200 : 500 },
    );
  }

  const rows = (data ?? []) as Outbox[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, failed: 0 });
  }

  // One read for every recipient's chat id rather than one per message: a
  // batch is usually the same question resolving for many people.
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, telegram_id")
    .in("id", ids);
  const chat = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.telegram_id as string) ?? null]),
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const to = chat.get(row.user_id);
    const message = render(row.kind, row.payload ?? {});

    // Nothing to say, or nowhere to say it. Marked done rather than retried —
    // neither of those gets better on a second attempt.
    if (!to || !message) {
      await admin
        .from("tg_outbox")
        .update({ sent_at: new Date().toISOString(), error: !to ? "no_chat" : "no_template" })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    const out = await send(token, to, message);
    if (out.ok) {
      await admin
        .from("tg_outbox")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
      continue;
    }

    // Blocked, deleted, never started the bot: the message will never land, so
    // it is retired now instead of burning two more attempts.
    const permanent = /blocked|deactivated|chat not found|user is deactivated/i.test(
      out.error ?? "",
    );
    await admin
      .from("tg_outbox")
      .update({
        error: out.error ?? "unknown",
        ...(permanent ? { failed_at: new Date().toISOString() } : {}),
      })
      .eq("id", row.id);
    failed++;
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}
