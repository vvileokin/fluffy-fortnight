import type { Metadata } from "next";
import {
  Crown,
  Target,
  TrendingUp,
  Flame,
  Check,
  X,
  Clock,
  Link2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ProfileEditButton } from "@/components/profile/ProfileEditButton";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { formatInt } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Профіль" };

const me = { handle: "ти", rank: 42, points: 6120, correct: 78, streak: 2 };

const providers = [
  { name: "Google", linked: true },
  { name: "Telegram", linked: true },
  { name: "Email", linked: false },
];

const history = [
  { q: "Переможець матчу — NAVI vs FaZe", r: "correct", pts: 40 },
  { q: "Точний рахунок — Spirit vs Vitality", r: "wrong", pts: 0 },
  { q: "b1t 20+ кілів на Mirage", r: "correct", pts: 80 },
  { q: "Переможець 1 карти — G2 vs MOUZ", r: "pending", pts: 60 },
] as const;

const stats = [
  { icon: Crown, label: "Місце в сезоні", value: `#${me.rank}` },
  { icon: Target, label: "Поінтів", value: formatInt(me.points) },
  { icon: TrendingUp, label: "Вірних", value: String(me.correct) },
  { icon: Flame, label: "Серія", value: String(me.streak) },
];

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={me.handle} size="lg" ring />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {me.handle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {providers.map((p) => (
              <Badge key={p.name} tone={p.linked ? "success" : "neutral"}>
                {p.linked ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : (
                  <Link2 className="size-3" />
                )}
                {p.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProfileEditButton handle={me.handle} />
          <SignOutButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
            <s.icon className="size-4 text-accent" />
            <p className="tnum mt-2 font-mono text-2xl font-bold text-ink">
              {s.value}
            </p>
            <p className="mt-0.5 text-xs text-ink-subtle">{s.label}</p>
          </div>
        ))}
      </div>

      {/* History */}
      <div>
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
            <Target className="size-4 text-ink-subtle" /> Історія прогнозів
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <ResultDot r={h.r} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                  {h.q}
                </span>
                <span
                  className={cn(
                    "tnum shrink-0 font-mono text-sm font-bold",
                    h.r === "correct"
                      ? "text-accent"
                      : h.r === "pending"
                        ? "text-ink-subtle"
                        : "text-ink-faint",
                  )}
                >
                  {h.r === "wrong" ? "—" : `+${h.pts}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ResultDot({ r }: { r: "correct" | "wrong" | "pending" }) {
  if (r === "correct")
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (r === "pending")
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
        <Clock className="size-3" />
      </span>
    );
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
      <X className="size-3" strokeWidth={3} />
    </span>
  );
}
