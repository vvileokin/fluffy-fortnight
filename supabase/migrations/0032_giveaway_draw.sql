-- CS2 UA — make giveaways actually drawable.
-- Until now the flow was a mockup: "Взяти участь" only set local React state,
-- `entrants` was a number an admin typed in by hand, and the admin draw picked
-- a name out of a client-side array without persisting anything. This migration
-- turns all three into real, auditable data. Run in Supabase → SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Winners
-- ---------------------------------------------------------------------------

alter table public.giveaways
  add column if not exists winners_count integer not null default 1,
  add column if not exists drawn_at      timestamptz;

create table if not exists public.giveaway_winners (
  id            uuid primary key default gen_random_uuid(),
  giveaway_slug text not null references public.giveaways (slug) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  place         integer not null default 1,
  created_at    timestamptz not null default now(),
  unique (giveaway_slug, user_id)
);

create index if not exists giveaway_winners_slug_idx
  on public.giveaway_winners (giveaway_slug);

alter table public.giveaway_winners enable row level security;

-- A draw is a public result — the whole point is that anyone can verify who won.
-- But there is deliberately NO insert/update/delete policy: winners can only be
-- written through the service role in the admin draw route, so a player can
-- never declare themselves the winner. Same lockdown as profiles.points.
drop policy if exists "giveaway winners are public" on public.giveaway_winners;
create policy "giveaway winners are public"
  on public.giveaway_winners for select using (true);

-- ---------------------------------------------------------------------------
-- 2. Entering is immediate; the admin disqualifies rather than approves
-- ---------------------------------------------------------------------------
-- `confirmed` defaulted to false, which would have meant an admin hand-approving
-- every single entry before the participant count moved off zero. For a public
-- community giveaway that doesn't scale past the first hundred people. Entries
-- are now eligible on arrival and an admin flips the flag to disqualify.

alter table public.giveaway_entries
  alter column confirmed set default true;

update public.giveaway_entries set confirmed = true where confirmed = false;

-- Let a player withdraw before the draw happens.
drop policy if exists "users delete own entries" on public.giveaway_entries;
create policy "users delete own entries"
  on public.giveaway_entries for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.giveaways g
       where g.slug = giveaway_slug and g.drawn_at is null
    )
  );

-- The eligibility rules live in the policy, not in the client. A crafted request
-- straight at PostgREST hits exactly the same gate the UI shows: right account,
-- giveaway still open, undrawn, and enough season points.
drop policy if exists "users insert own entries" on public.giveaway_entries;
create policy "users insert own entries"
  on public.giveaway_entries for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
        from public.giveaways g
        join public.profiles p on p.id = auth.uid()
       where g.slug = giveaway_slug
         and g.status <> 'finished'
         and g.drawn_at is null
         and p.points >= g.min_points
    )
  );

-- ---------------------------------------------------------------------------
-- 3. `entrants` becomes a real count, maintained by the database
-- ---------------------------------------------------------------------------
-- Entries stay private (a player reads only their own row), so the public count
-- can't be a live `count(*)` from the browser without opening the table up.
-- A trigger keeps the number on `giveaways`, which is already world-readable —
-- the figure is public, the list of who entered is not.

create or replace function public.sync_giveaway_entrants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target text := coalesce(new.giveaway_slug, old.giveaway_slug);
begin
  update public.giveaways g
     set entrants = (
           select count(*) from public.giveaway_entries e
            where e.giveaway_slug = target
         )
   where g.slug = target;
  return null;
end;
$$;

drop trigger if exists giveaway_entries_count on public.giveaway_entries;
create trigger giveaway_entries_count
  after insert or update or delete on public.giveaway_entries
  for each row execute function public.sync_giveaway_entrants();

-- Replace the seeded demo figures (2840, 5210) with the truth.
update public.giveaways g
   set entrants = (
     select count(*) from public.giveaway_entries e where e.giveaway_slug = g.slug
   );
