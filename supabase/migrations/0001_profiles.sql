-- CS2 UA — profiles table + auto-provision on signup.
-- Run this in Supabase → SQL Editor (or via the Supabase CLI).

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        text not null,
  avatar_url    text,
  points        integer not null default 0,
  bounty_points integer not null default 0,
  correct       integer not null default 0,
  streak        integer not null default 0,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone can read profiles (needed for the public leaderboard).
create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);

-- A user can update only their own profile.
create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, handle, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name',
      split_part(new.email, '@', 1),
      'гравець'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
