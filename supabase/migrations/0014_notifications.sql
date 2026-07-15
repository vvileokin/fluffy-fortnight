-- CS2 UA — per-user notifications (predictions resolved, bounty points, giveaways).
-- Rows are written by admin/service-role actions; users read + mark their own.
-- Run in Supabase → SQL Editor.

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null default 'reward',  -- reward | match | giveaway | rank
  title      text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
  on public.notifications for update using (auth.uid() = user_id);
