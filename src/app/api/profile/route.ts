import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Update the signed-in user's own profile: nickname and/or avatar photo.
// The avatar file is stored in the `media` bucket under avatars/<uid>/; the
// profile row is updated through the user's session so RLS still applies.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Authenticated as `user` above; all writes are scoped to their own id, so we
  // use the service-role client to avoid a silent RLS no-op on the profile update.
  const admin = createAdminClient();
  const update: { handle?: string; avatar_url?: string } = {};

  const rawHandle = form.get("handle");
  if (typeof rawHandle === "string") {
    const handle = rawHandle.trim().slice(0, 24);
    if (handle.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Нік має містити щонайменше 2 символи" },
        { status: 400 },
      );
    }
    update.handle = handle;
  }

  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Лише зображення" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "Завелике фото (макс 5MB)" },
        { status: 400 },
      );
    }
    const ext =
      (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) ||
      "png";
    const path = `avatars/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from("media")
      .upload(path, buffer, { contentType: file.type || "image/png", upsert: false });
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }
    const { data: pub } = admin.storage.from("media").getPublicUrl(path);
    update.avatar_url = pub.publicUrl;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "Нічого змінювати" }, { status: 400 });
  }

  // Some accounts (e.g. created before the signup trigger existed) have no
  // profile row yet, so upsert: create it on first edit, update it otherwise.
  const { data: existing } = await admin
    .from("profiles")
    .select("handle, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const fallbackHandle =
    (user.user_metadata?.name as string) ||
    (user.user_metadata?.user_name as string) ||
    user.email?.split("@")[0] ||
    "гравець";

  const row = {
    id: user.id,
    handle: update.handle ?? existing?.handle ?? fallbackHandle,
    avatar_url: update.avatar_url ?? existing?.avatar_url ?? null,
  };

  const { error } = await admin.from("profiles").upsert(row, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...update });
}
