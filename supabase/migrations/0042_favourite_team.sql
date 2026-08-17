-- CS2 UA — back one team through the playoff, and let the streak lift bets too.
-- Run in Supabase → SQL Editor. Requires 0033 (ewc_points) and 0040 (bets).

-- ---------------------------------------------------------------------------
-- 1. The pick
-- ---------------------------------------------------------------------------
-- One team per player per tournament. Changeable while the bracket is open —
-- the same switch closes both, because they are the same decision made at the
-- same moment and closing one but not the other would be arbitrary.

create table if not exists public.favourite_teams (
  user_id         uuid not null references auth.users (id) on delete cascade,
  tournament_slug text not null,
  team_slug       text not null,
  created_at      timestamptz not null default now(),
  primary key (user_id, tournament_slug)
);

alter table public.favourite_teams enable row level security;

drop policy if exists "favourite read own" on public.favourite_teams;
create policy "favourite read own"
  on public.favourite_teams for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. What has already been paid
-- ---------------------------------------------------------------------------
-- A match can be saved many times over — an admin fixing a map score re-saves
-- the row, and every save re-runs the finish hook. This is the guard that makes
-- the payout happen exactly once per player per match.

create table if not exists public.favourite_payouts (
  user_id  uuid not null references auth.users (id) on delete cascade,
  match_id text not null,
  amount   integer not null,
  paid_at  timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.favourite_payouts enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Paying everyone who backed the winner
-- ---------------------------------------------------------------------------
-- The amount is computed by the caller, not here: it depends on the underdog
-- band, which is derived from world rank in the team catalogue rather than
-- stored in the database. Doing half the sum in SQL and half in TypeScript is
-- how the two quietly stop agreeing.

create or replace function public.pay_favourite_team(
  p_match   text,
  p_slug    text,
  p_team    text,
  p_amount  integer
)
-- Returns the players it actually paid, so the caller can notify exactly those
-- and nobody else. A count would leave the route unable to tell a first payout
-- from a re-save that paid no one.
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    return;
  end if;
  if p_amount is null or p_amount <= 0 then
    return;
  end if;

  return query
  with winners as (
    insert into public.favourite_payouts (user_id, match_id, amount)
    select f.user_id, p_match, p_amount
      from public.favourite_teams f
     where f.tournament_slug = p_slug
       and f.team_slug = p_team
    -- The conflict clause is the whole idempotency guard: a player already paid
    -- for this match inserts nothing, so `winners` is empty and the credit
    -- below never runs for them.
    on conflict (user_id, match_id) do nothing
    returning user_id
  ), credited as (
    update public.profiles p
       set ewc_points = p.ewc_points + p_amount
      from winners w
     where p.id = w.user_id
    returning p.id
  )
  select id from credited;
end;
$$;

revoke execute on function public.pay_favourite_team(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.pay_favourite_team(text, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. The streak now lifts winnings too
-- ---------------------------------------------------------------------------
-- Same ladder the flat rewards use, read off the streak the player carried into
-- the match. `settle_bets` runs before streaks are recomputed, so `streak` here
-- is still the figure the slip was placed under — which is the one the card
-- showed them, and the only one they agreed to.

create or replace function public.settle_bets(
  p_question text,
  p_correct  text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  if auth.uid() is not null then
    return 0;
  end if;

  with paid as (
    update public.bets b
       set payout = case
                      when b.option_id = p_correct then
                        floor(
                          b.stake * b.odds *
                          case
                            when pr.streak >= 10 then 2.0
                            when pr.streak >= 5  then 1.5
                            when pr.streak >= 3  then 1.25
                            else 1.0
                          end
                        )::integer
                      else 0
                    end,
           settled_at = now()
      from public.profiles pr
     where b.question_id = p_question
       and b.settled_at is null
       and pr.id = b.user_id
    returning b.user_id, b.payout
  ), credited as (
    update public.profiles p
       set ewc_points = p.ewc_points + paid.payout
      from paid
     where p.id = paid.user_id and paid.payout > 0
    returning 1
  )
  select count(*) into touched from paid;

  return touched;
end;
$$;

revoke execute on function public.settle_bets(text, text)
  from public, anon, authenticated;
grant execute on function public.settle_bets(text, text)
  to service_role;
