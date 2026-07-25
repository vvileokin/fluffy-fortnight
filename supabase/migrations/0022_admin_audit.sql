-- CS2 UA — real audit trail for the admin panel.
-- Every change made through /api/admin lands here with who did it. Written and
-- read by the service role only: no client policy, so the log can't be read or
-- rewritten from the browser. Run in Supabase → SQL Editor.

create table if not exists public.admin_audit (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  handle     text not null default '—',   -- who, as they were named at the time
  role       text,                        -- admin | editor at the time
  area       text not null,               -- matches | bounty | users | …
  action     text not null,               -- human-readable description
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_time_idx
  on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;
-- Deliberately no policies: only the service role touches this table.
