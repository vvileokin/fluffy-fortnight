-- CS2 UA — the 0-2 club: one card per Porto group.
-- Run in Supabase → SQL Editor.
--
-- A GSL group of eight sends three through and sends two home without a single
-- win. Naming the three is the ordinary prediction every site asks for; naming
-- the two is the one nobody does, and it is much harder — a favourite can lose
-- twice, and it is not enough to know who is good, you have to know who is
-- brittle. That is why the 0-2 pays double.
--
-- One row per player per group, so group B stays open a day longer than group
-- A and each closes on its own first match.

create table if not exists public.porto_groups (
  user_id    uuid not null references auth.users (id) on delete cascade,
  group_id   text not null check (group_id in ('a', 'b')),
  -- Exactly three who qualify and exactly two who go out 0-2. Enforced here as
  -- well as in the route: the route is the door, this is the wall.
  advance    text[] not null check (array_length(advance, 1) = 3),
  zero_two   text[] not null check (array_length(zero_two, 1) = 2),
  points     integer not null default 0,
  scored_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

alter table public.porto_groups enable row level security;

-- A player reads and writes only their own card, and only while it is unscored.
-- Everything about *when* a group closes lives in the route, which can see the
-- fixtures; RLS only has to make sure nobody edits somebody else's.
drop policy if exists "own card readable" on public.porto_groups;
create policy "own card readable" on public.porto_groups
  for select using (auth.uid() = user_id);

drop policy if exists "own card writable" on public.porto_groups;
create policy "own card writable" on public.porto_groups
  for insert with check (auth.uid() = user_id);

drop policy if exists "own card updatable" on public.porto_groups;
create policy "own card updatable" on public.porto_groups
  for update using (auth.uid() = user_id and scored_at is null)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Paying a group out
-- ---------------------------------------------------------------------------
-- Idempotent by `scored_at`: a second press pays nobody a second time, which is
-- the property that makes it safe to run the moment a group ends rather than
-- waiting until everything is certain.

create or replace function public.score_porto_group(
  p_group    text,
  p_advance  text[],   -- the three who actually qualified
  p_zero_two text[]    -- the two who actually went out 0-2
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec    record;
  hit_a  integer;
  hit_z  integer;
  gained integer;
  paid   integer := 0;
begin
  if auth.uid() is not null then
    return 0;
  end if;
  if p_advance is null or p_zero_two is null then
    return 0;
  end if;

  for rec in
    select pg.user_id, pg.advance, pg.zero_two
      from public.porto_groups pg
     where pg.group_id = p_group and pg.scored_at is null
  loop
    select count(*) into hit_a
      from unnest(rec.advance) t where t = any (p_advance);
    select count(*) into hit_z
      from unnest(rec.zero_two) t where t = any (p_zero_two);

    -- 50 a qualifier, 100 a collapse, and 200 more for calling the whole group.
    gained := hit_a * 50 + hit_z * 100;
    if hit_a = 3 and hit_z = 2 then
      gained := gained + 200;
    end if;

    update public.porto_groups
       set points = gained, scored_at = now(), updated_at = now()
     where user_id = rec.user_id and group_id = p_group;

    if gained > 0 then
      update public.profiles
         set event_points = event_points + gained
       where id = rec.user_id;
    end if;

    paid := paid + 1;
  end loop;

  return paid;
end;
$$;

revoke execute on function public.score_porto_group(text, text[], text[])
  from public, anon, authenticated;
grant execute on function public.score_porto_group(text, text[], text[]) to service_role;
