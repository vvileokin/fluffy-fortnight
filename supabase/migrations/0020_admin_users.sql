-- CS2 UA — per-person admin access.
-- Replaces the single shared password: each admin is a real account, granted and
-- revoked one at a time. Run in Supabase → SQL Editor.

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'editor' check (role in ('admin', 'editor')),
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- A person may see their own row (the panel shows them their role). There is no
-- insert/update/delete policy on purpose: only the service role writes here, so
-- nobody can grant themselves access through the public API.
drop policy if exists "admins read own row" on public.admin_users;
create policy "admins read own row"
  on public.admin_users for select using (auth.uid() = user_id);

-- profiles.is_admin was writable by its owner through the "users update own
-- profile" policy — anyone logged in could flip it on themselves. Nothing writes
-- it legitimately, so freeze the column; admin_users is the source of truth.
create or replace function public.freeze_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_admin := old.is_admin;
  return new;
end;
$$;

drop trigger if exists profiles_freeze_admin on public.profiles;
create trigger profiles_freeze_admin
  before update on public.profiles
  for each row execute function public.freeze_profile_admin_flag();

-- ── First admin ───────────────────────────────────────────────────────────────
-- There is no password way in: the first seat is granted here, by hand. Sign
-- into the site with your own account first so the profile row exists, then run
-- ONE of these (replace the value with your own):
--
--   insert into public.admin_users (user_id, role)
--   select id, 'admin' from public.profiles where handle = 'ТВІЙ_НІК'
--   on conflict (user_id) do update set role = 'admin';
--
-- Not sure which row is yours? List the newest accounts and grant by id:
--   select id, handle, created_at from public.profiles order by created_at desc limit 20;
--   insert into public.admin_users (user_id, role) values ('<твій-uuid>', 'admin')
--   on conflict (user_id) do update set role = 'admin';
--
-- Everyone after you is granted from the panel, on Користувачі та ролі.
