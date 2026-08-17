-- CS2 UA — staking EWC points at odds.
-- Run in Supabase → SQL Editor. Requires 0033 (ewc_points).
--
-- A betting question is an ordinary question with `betting` set and an `odds`
-- number on each of its options. Odds live inside the existing `options` jsonb
-- rather than in a new table: an option has never had a row of its own, and
-- giving it one only to hold a single number would split the definition of an
-- option across two places for the admin to keep in sync.
--
-- EWC points only. The season balance is earned by being right; the event
-- balance is the one you are allowed to risk, and mixing them would let a bad
-- night at the event eat a season's standing.

alter table public.questions
  add column if not exists betting boolean not null default false;

create table if not exists public.bets (
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  option_id   text not null,
  stake       integer not null check (stake > 0),
  -- The coefficient is copied onto the bet, not read back off the question at
  -- settlement. An admin correcting odds after people have staked must not
  -- silently reprice bets that were already accepted at the old number.
  odds        numeric(6,2) not null check (odds >= 1),
  payout      integer,
  settled_at  timestamptz,
  created_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists bets_question_idx on public.bets (question_id);

alter table public.bets enable row level security;

-- A player may read their own slips and nothing else. Writes go exclusively
-- through `place_bet`, which is the only thing that can move a balance.
drop policy if exists "bets read own" on public.bets;
create policy "bets read own"
  on public.bets for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Placing a bet
-- ---------------------------------------------------------------------------
-- Everything happens under one row lock on the profile: read the balance,
-- check it covers the stake, write the slip, deduct. Without the lock two
-- requests could both read the same balance and both be affordable, and a
-- player could stake more than they hold.

create or replace function public.place_bet(
  p_user     uuid,
  p_question text,
  p_option   text,
  p_stake    integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_status  text;
  v_betting boolean;
  v_odds    numeric(6,2);
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- Superseded by 0046, which drops this floor to 1. Left as it shipped:
  -- editing an applied migration changes nothing in a database that already
  -- ran it, and only hides what that database actually contains.
  if p_stake is null or p_stake < 50 then
    return jsonb_build_object('ok', false, 'error', 'min_stake');
  end if;

  select status, betting into v_status, v_betting
    from public.questions where id = p_question;
  if not found or not coalesce(v_betting, false) then
    return jsonb_build_object('ok', false, 'error', 'not_betting');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  -- The odds are whatever the question says right now, for the option the
  -- player actually named. An option id that isn't on the question has no
  -- coefficient and the bet is refused rather than defaulted to something.
  select (o ->> 'odds')::numeric into v_odds
    from public.questions q,
         lateral jsonb_array_elements(q.options) o
   where q.id = p_question and o ->> 'id' = p_option;
  if v_odds is null or v_odds < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_odds');
  end if;

  select ewc_points into v_balance
    from public.profiles where id = p_user for update;
  if v_balance is null or v_balance < p_stake then
    return jsonb_build_object('ok', false, 'error', 'insufficient');
  end if;

  -- The primary key is what makes a bet one-shot; a second attempt is the
  -- guard working, not a fault.
  begin
    insert into public.bets (user_id, question_id, option_id, stake, odds)
    values (p_user, p_question, p_option, p_stake, v_odds);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_placed');
  end;

  update public.profiles
     set ewc_points = ewc_points - p_stake
   where id = p_user;

  return jsonb_build_object('ok', true, 'odds', v_odds,
                            'balance', v_balance - p_stake);
end;
$$;

revoke execute on function public.place_bet(uuid, text, text, integer)
  from public, anon;
grant execute on function public.place_bet(uuid, text, text, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Settling a question
-- ---------------------------------------------------------------------------
-- Winners are paid stake × odds; losers already paid when they staked, so
-- there is nothing to take. `settled_at` is the idempotency guard, so a
-- re-resolved question tops up what it missed without paying anyone twice.

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
       set payout = case when b.option_id = p_correct
                         then floor(b.stake * b.odds)::integer
                         else 0 end,
           settled_at = now()
     where b.question_id = p_question
       and b.settled_at is null
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
