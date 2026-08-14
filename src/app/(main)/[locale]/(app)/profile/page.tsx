import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Target, Package, KeyRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { AuthMethods } from "@/components/profile/AuthMethods";
import { ProfileEditButton } from "@/components/profile/ProfileEditButton";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PredictionHistory, type HistoryItem } from "@/components/profile/PredictionHistory";
import { Inventory } from "@/components/profile/Inventory";
import { getInventory } from "@/lib/db/inventory";
import { createClient } from "@/lib/supabase/server";
import { getQuestion } from "@/lib/data";
import { formatInt } from "@/lib/utils";

export const metadata: Metadata = { title: "Профіль" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, avatar_url, points, bounty_points, streak")
    .eq("id", user.id)
    .maybeSingle();

  // Asked separately, and deliberately not folded into the select above:
  // `telegram_id` arrives with migration 0035, and PostgREST fails the whole
  // select on one unknown column — which would blank the handle, the points
  // and the streak rather than just the link row.
  const { data: tg } = await supabase
    .from("profiles")
    .select("telegram_id")
    .eq("id", user.id)
    .maybeSingle();

  const handle =
    profile?.handle ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "гравець";
  const points = profile?.points ?? 0;
  const streak = profile?.streak ?? 0;

  // Season rank = players strictly above me, + 1.
  const { count: above } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gt("points", points);
  const rank = (above ?? 0) + 1;

  // Prediction history, resolved against real question_results.
  const { data: preds } = await supabase
    .from("predictions")
    .select("question_id, option_id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const qIds = (preds ?? []).map((p) => p.question_id);
  const { data: results } = qIds.length
    ? await supabase
        .from("question_results")
        .select("question_id, correct_option_id")
        .in("question_id", qIds)
    : { data: [] };
  const winners = new Map((results ?? []).map((r) => [r.question_id, r.correct_option_id]));

  const history: HistoryItem[] = (preds ?? [])
    .map((p): HistoryItem | null => {
      const q = getQuestion(p.question_id);
      if (!q) return null;
      const opt = q.options.find((o) => o.id === p.option_id);
      const winner = winners.get(p.question_id);
      const result = winner ? (winner === p.option_id ? "correct" : "wrong") : "pending";
      return {
        id: p.question_id,
        title: opt ? `${q.title} — ${opt.label}` : q.title,
        result,
        pts: result === "correct" && opt ? opt.reward : 0,
      };
    })
    .filter((x): x is HistoryItem => x !== null);

  const inventory = await getInventory(user.id);

  const isTelegram = user.user_metadata?.provider === "telegram";
  const provider = isTelegram
    ? "telegram"
    : user.app_metadata?.provider === "google"
      ? "google"
      : "email";
  const telegramLinked =
    isTelegram || !!(tg?.telegram_id as string | null | undefined);
  // Two writers, two keys: the link route stores `telegram_username`, while the
  // sign-in route has always stored Telegram's handle as `user_name`. Reading
  // only the first left every Telegram-native account with a nameless row.
  const telegramUsername = (user.user_metadata?.telegram_username ??
    user.user_metadata?.user_name) as string | undefined;

  /* Impeccable: Crafted Stat Rail — four big tiles for four small numbers was
     the wrong ratio: most of them read "0" for most of a season, so a quarter
     of the page above the fold was spent saying nothing. One strip welded to
     the bottom of the identity slab does the same job at a fifth of the height.

     The two metrics that have a brand mark carry it; rank doesn't have one, so
     it goes without rather than borrowing a generic glyph to look consistent.
     That was the old failure here — a filled crown sitting beside line-drawn
     lucide icons read as an emoji dropped into the UI. A real mark or nothing. */
  const stats = [
    { label: "Місце", value: `#${rank}`, tone: "var(--accent)" },
    { label: "Поінтів", value: formatInt(points), tone: "var(--accent)", icon: "points" },
    { label: "Серія", value: String(streak), tone: "var(--accent)", icon: "streak" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-xl surface-1">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <Avatar name={handle} src={profile?.avatar_url} size="lg" ring />
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">{handle}</h1>
            {/* The provider badge that used to sit here moved into «Способи
                входу» below. Once an account can carry more than one method,
                naming a single one at the top is both redundant and the less
                useful half of the answer. */}
            {user.email && !isTelegram && (
              <p className="mt-1.5 truncate text-xs text-ink-subtle">{user.email}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ProfileEditButton handle={handle} avatarUrl={profile?.avatar_url} />
            <SignOutButton />
          </div>
        </div>

        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2.5 bg-[color-mix(in_oklch,var(--ink)_3%,transparent)] px-5 py-3 shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)_inset] sm:gap-x-7 sm:px-6">
          {stats.map((s) => (
            /* DOM order is dt → dd so a screen reader hears "Серія, 4"; the
               eye wants the number first, so `order` swaps them visually
               without lying to assistive tech about which is the label. */
            <div key={s.label} className="flex items-center gap-1.5">
              {"icon" in s && <BrandIcon name={s.icon} className="order-1 size-4" />}
              <dt className="order-3 text-xs leading-none text-ink-subtle">{s.label}</dt>
              <dd
                className="tnum order-2 font-mono text-sm font-extrabold leading-none"
                style={{ color: s.tone }}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Sign-in methods. Telegram is the one with a job beyond convenience —
          the EWC giveaway is gated on it — so the section earns its place on
          the page rather than hiding in a settings screen. */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
          <KeyRound className="size-4 text-ink-subtle" /> Способи входу
        </h2>
        <Suspense fallback={null}>
          <AuthMethods
            email={user.email ?? undefined}
            provider={provider}
            telegramLinked={telegramLinked}
            telegramUsername={telegramUsername}
          />
        </Suspense>
      </section>

      {/* Inventory — always shown, because an empty case here is the whole
          point: it tells a new player there's something to win. */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
          <Package className="size-4 text-ink-subtle" /> Інвентар
          {inventory.length > 0 && (
            <span className="tnum font-mono text-ink-subtle">
              {inventory.length}
            </span>
          )}
        </h2>
        <Inventory items={inventory} />
      </section>

      {/* History — only once the player actually has predictions */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
            <Target className="size-4 text-ink-subtle" /> Історія прогнозів
          </h2>
          <PredictionHistory items={history} />
        </section>
      )}
    </div>
  );
}
