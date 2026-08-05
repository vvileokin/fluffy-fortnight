"use client";

import * as React from "react";
import { Search, ShieldAlert, Loader2 } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Avatar } from "@/components/ui/Avatar";
import { formatInt, cn } from "@/lib/utils";

type Role = "admin" | "editor" | null;
type User = {
  id: string;
  handle: string;
  avatarUrl: string | null;
  points: number;
  joined: string;
  role: Role;
};

const roleLabel = { admin: "Адмін", editor: "Редактор", user: "Гравець" } as const;

function joinedLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("uk-UA");
}

export default function UsersAdmin() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (search: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`).catch(() => null);
    const j = await res?.json().catch(() => null);
    setLoading(false);
    if (j?.ok) {
      setUsers(j.users as User[]);
      setError(null);
    } else {
      setError(
        j?.error === "unauthorized"
          ? "Ця сторінка лише для адміністраторів."
          : "Не вдалося завантажити список.",
      );
    }
  }, []);

  // Debounce the search so typing doesn't hammer the endpoint.
  React.useEffect(() => {
    const t = window.setTimeout(() => void load(q), q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [q, load]);

  async function setRole(user: User, role: Role) {
    setBusyId(user.id);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.id, role }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setBusyId(null);
    if (res?.ok) setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    else setError(j?.error || "Не вдалося змінити доступ.");
  }

  const staff = users.filter((u) => u.role);
  const rest = users.filter((u) => !u.role);

  return (
    <>
      <AdminHead
        title="Користувачі та ролі"
        subtitle="Доступ до панелі прив’язаний до акаунта — видавай і забирай його поштучно. Адміністратор керує доступом, редактор працює лише з контентом."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      )}

      <div className="relative mb-4 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук за ніком"
          className="h-10 w-full rounded-lg surface-1 pl-10 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
      </div>

      {staff.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Мають доступ ({staff.length})
          </p>
          <Panel>
            <UserTable users={staff} busyId={busyId} onRole={setRole} />
          </Panel>
        </div>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Усі акаунти
      </p>
      <Panel>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-ink-subtle">
            <Loader2 className="size-4 animate-spin" /> Завантаження…
          </div>
        ) : rest.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-subtle">Нічого не знайдено.</p>
        ) : (
          <UserTable users={rest} busyId={busyId} onRole={setRole} />
        )}
      </Panel>

      <p className="mt-3 flex items-center gap-2 text-xs text-ink-subtle">
        <ShieldAlert className="size-3.5 text-warning" />
        Власний доступ змінити не можна — щоб панель не лишилася без адміністратора.
      </p>
    </>
  );
}

function UserTable({
  users,
  busyId,
  onRole,
}: {
  users: User[];
  busyId: string | null;
  onRole: (u: User, role: Role) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="shadow-[0_1px_0_0_color-mix(in_oklch,var(--ink)_7%,transparent)] text-left text-xs uppercase tracking-wide text-ink-subtle">
            <th className="px-4 py-3 font-semibold">Користувач</th>
            <th className="px-4 py-3 font-semibold">Поінти</th>
            <th className="px-4 py-3 font-semibold">Реєстрація</th>
            <th className="px-4 py-3 font-semibold">Доступ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color-mix(in_oklch,var(--ink)_6%,transparent)]">
          {users.map((u) => (
            <tr key={u.id} className="transition-colors hover:bg-surface-2">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={u.handle} src={u.avatarUrl} size="sm" />
                  <span className="font-semibold text-ink">{u.handle}</span>
                  {u.role === "admin" && <ShieldAlert className="size-3.5 text-accent" />}
                </div>
              </td>
              <td className="tnum px-4 py-2.5 font-mono font-semibold text-accent">
                {formatInt(u.points)}
              </td>
              <td className="px-4 py-2.5 text-ink-muted">{joinedLabel(u.joined)}</td>
              <td className="px-4 py-2.5">
                {busyId === u.id ? (
                  <Loader2 className="size-4 animate-spin text-ink-subtle" />
                ) : (
                  <div className="flex gap-1.5">
                    {([null, "editor", "admin"] as Role[]).map((r) => {
                      const on = u.role === r;
                      const label = r ? roleLabel[r] : roleLabel.user;
                      return (
                        <button
                          key={label}
                          onClick={() => !on && onRole(u, r)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-[0.6875rem] font-semibold transition-colors",
                            on
                              ? r === "admin"
                                ? "border-accent/50 bg-accent/10 text-accent"
                                : r === "editor"
                                  ? "border-info/50 bg-info/10 text-info"
                                  : "border-border bg-surface-2 text-ink-muted"
                              : "border-border text-ink-subtle hover:bg-surface-2",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
