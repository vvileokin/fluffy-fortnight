import { NextResponse } from "next/server";
import { isFullAdmin } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Role = "admin" | "editor";

/** Accounts and who among them holds admin access. Full admins only. */
export async function GET(request: Request) {
  if (!(await isFullAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const admin = createAdminClient();

  let query = admin
    .from("profiles")
    .select("id, handle, avatar_url, points, created_at")
    .order("points", { ascending: false })
    .limit(100);
  if (q) query = query.ilike("handle", `%${q}%`);

  const [{ data: profiles, error }, { data: grants }] = await Promise.all([
    query,
    admin.from("admin_users").select("user_id, role, created_at"),
  ]);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const roleById = new Map((grants ?? []).map((g) => [g.user_id, g.role as Role]));
  // Everyone holding access is listed first, even if they're outside the search
  // page — otherwise revoking someone means hunting for them.
  const staff = (grants ?? []).map((g) => g.user_id);
  const missing = staff.filter((id) => !(profiles ?? []).some((p) => p.id === id));
  const extra = missing.length
    ? (
        await admin
          .from("profiles")
          .select("id, handle, avatar_url, points, created_at")
          .in("id", missing)
      ).data ?? []
    : [];

  const users = [...extra, ...(profiles ?? [])].map((p) => ({
    id: p.id,
    handle: p.handle,
    avatarUrl: p.avatar_url,
    points: p.points,
    joined: p.created_at,
    role: roleById.get(p.id) ?? null,
  }));

  return NextResponse.json({ ok: true, users });
}

/** Grant or revoke access for one account. Full admins only. */
export async function POST(request: Request) {
  if (!(await isFullAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const userId = typeof body?.user_id === "string" ? body.user_id : "";
  const role = body?.role;
  if (!userId || (role !== null && role !== "admin" && role !== "editor")) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Don't let someone drop their own access — that's how a panel ends up with
  // no one holding the keys.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === userId) {
    return NextResponse.json(
      { ok: false, error: "Не можна змінити власний доступ — попроси іншого адміністратора." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } =
    role === null
      ? await admin.from("admin_users").delete().eq("user_id", userId)
      : await admin
          .from("admin_users")
          .upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
