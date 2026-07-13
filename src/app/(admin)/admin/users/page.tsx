"use client";

import * as React from "react";
import { Search, ShieldAlert } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { Avatar } from "@/components/ui/Avatar";
import { formatInt } from "@/lib/utils";

type Role = "admin" | "editor" | "user";
type User = { handle: string; email: string; role: Role; points: number; joined: string };

const initial: User[] = [
  { handle: "zaraza_ua", email: "zaraza@mail.com", role: "admin", points: 18420, joined: "12.01.2026" },
  { handle: "editor_kyiv", email: "editor@cs2ua.com", role: "editor", points: 9200, joined: "03.02.2026" },
  { handle: "kv1tka", email: "kv1tka@mail.com", role: "user", points: 17980, joined: "20.02.2026" },
  { handle: "molotok", email: "molotok@mail.com", role: "user", points: 17110, joined: "28.02.2026" },
  { handle: "b1t_believer", email: "b1t@mail.com", role: "user", points: 16240, joined: "11.03.2026" },
  { handle: "shadow_kyiv", email: "shadow@mail.com", role: "editor", points: 15870, joined: "15.03.2026" },
];

const roleLabel: Record<Role, string> = { admin: "Адмін", editor: "Редактор", user: "Гравець" };

export default function UsersAdmin() {
  const [users, setUsers] = React.useState(initial);
  const [q, setQ] = React.useState("");

  const filtered = users.filter(
    (u) => u.handle.includes(q) || u.email.includes(q),
  );

  return (
    <>
      <AdminHead
        title="Користувачі та ролі"
        subtitle="Керування доступом. Ролі та критичні налаштування — лише для адміністратора."
      />

      <div className="mb-4 relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук за ніком або поштою"
          className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-3 font-semibold">Користувач</th>
                <th className="px-4 py-3 font-semibold">Поінти</th>
                <th className="px-4 py-3 font-semibold">Реєстрація</th>
                <th className="px-4 py-3 font-semibold">Роль</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u, i) => (
                <tr key={u.handle} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.handle} size="sm" />
                      <div>
                        <p className="font-semibold text-ink">{u.handle}</p>
                        <p className="text-xs text-ink-subtle">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="tnum px-4 py-2.5 font-mono font-semibold text-accent">
                    {formatInt(u.points)}
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{u.joined}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((x, j) =>
                            j === users.indexOf(u) ? { ...x, role: e.target.value as Role } : x,
                          ),
                        )
                      }
                      className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                    >
                      {(["user", "editor", "admin"] as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {roleLabel[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="mt-3 flex items-center gap-2 text-xs text-ink-subtle">
        <ShieldAlert className="size-3.5 text-warning" />
        Зміна ролі записується в журнал аудиту.
      </p>
    </>
  );
}
