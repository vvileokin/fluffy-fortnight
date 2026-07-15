import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type OptionInput = { id?: string; label?: string; sublabel?: string; reward?: number };

// Create / update a prediction question tied to a match. Admin only.
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const q = await request.json().catch(() => null);
  if (!q?.title || !q.match_id) {
    return NextResponse.json({ ok: false, error: "Вкажи матч і формулювання" }, { status: 400 });
  }

  const rawOptions: OptionInput[] = Array.isArray(q.options) ? q.options : [];
  const options = rawOptions
    .filter((o) => (o.label ?? "").trim().length > 0)
    .map((o, i) => ({
      id: o.id || `o${i + 1}`,
      label: String(o.label).trim(),
      ...(o.sublabel ? { sublabel: String(o.sublabel).trim() } : {}),
      reward: Number(o.reward ?? 0),
    }));
  if (options.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Потрібно щонайменше два варіанти" },
      { status: 400 },
    );
  }

  const id = q.id || `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const row = {
    id,
    match_id: String(q.match_id),
    kind: String(q.kind ?? "custom"),
    title: String(q.title),
    difficulty: String(q.difficulty ?? "medium"),
    status: String(q.status ?? "open"),
    deadline_label: q.deadline_label ? String(q.deadline_label) : null,
    options,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin.from("questions").upsert(row, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await request.json().catch(() => ({ id: "" }));
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("questions").delete().eq("id", String(id));
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
