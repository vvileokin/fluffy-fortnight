import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Crown, Target, TrendingUp, Flame, Check, Mail, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ProfileEditButton } from "@/components/profile/ProfileEditButton";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PredictionHistory, type HistoryItem } from "@/components/profile/PredictionHistory";
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
    .select("handle, avatar_url, points, bounty_points, correct, streak")
    .eq("id", user.id)
    .maybeSingle();

  const handle =
    profile?.handle ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "гравець";
  const points = profile?.points ?? 0;
  const correct = profile?.correct ?? 0;
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

  const isTelegram = user.user_metadata?.provider === "telegram";
  const authMethod = isTelegram
    ? { label: "Telegram", icon: Send }
    : user.app_metadata?.provider === "google"
      ? { label: "Google", icon: Check }
      : { label: "Пошта", icon: Mail };

  const stats = [
    { icon: Crown, label: "Місце в сезоні", value: `#${rank}` },
    { icon: Target, label: "Поінтів", value: formatInt(points) },
    { icon: TrendingUp, label: "Правильних", value: String(correct) },
    { icon: Flame, label: "Серія", value: String(streak) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={handle} src={profile?.avatar_url} size="lg" ring />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{handle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="success">
              <authMethod.icon className="size-3" strokeWidth={3} />
              {authMethod.label}
            </Badge>
            {user.email && !isTelegram && (
              <span className="text-xs text-ink-subtle">{user.email}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProfileEditButton handle={handle} avatarUrl={profile?.avatar_url} />
          <SignOutButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
            <s.icon className="size-4 text-accent" />
            <p className="tnum mt-2 font-mono text-2xl font-bold text-ink">{s.value}</p>
            <p className="mt-0.5 text-xs text-ink-subtle">{s.label}</p>
          </div>
        ))}
      </div>

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
