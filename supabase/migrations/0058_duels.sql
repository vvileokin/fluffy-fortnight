-- CS2 UA — duels, one against one, BLAST Porto only.
-- Run in Supabase → SQL Editor. Requires 0052 (event_points).
--
-- Two players take opposite sides of one match for equal stakes; the winner
-- takes both. There are no odds: the price is the other person's disagreement,
-- so a match nobody argues about simply produces no duels, and the market
-- balances itself.
--
-- The property that matters is that a duel **cannot print a point**. The pot is
-- exactly two stakes, both of which left a balance before the match began. That
-- is also why the streak stays out of it: a streak multiplies rewards that *are*
-- printed, so letting duels feed it would let two accounts trade losses to pump
-- one streak and convert moved points into minted ones. Duels keep their own
-- record instead.
--
-- Every path that removes a duel returns the money. There is no state in which
-- a stake is held by nothing.

create table if not exists public.duels (
  id            uuid primary key default gen_random_uuid(),
  match_id      text not null,
  challenger    uuid not null references auth.users (id) on delete cascade,
  -- Which side of the match the challenger backed. The opponent is always the
  -- other one — storing both would allow a row where they agree.
  side          text not null check (side in ('a', 'b')),
  -- NULL is an open challenge on the match; a user id is a direct one.
  opponent      uuid references auth.users (id) on delete cascade,
  stake         integer not null check (stake > 0),
  status        text not null default 'open'
                  check (status in ('open', 'matched', 'settled', 'expired', 'void')),
  winner        uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  matched_at    timestamptz,
  settled_at    timestamptz,
  constraint duel_not_self check (opponent is null or opponent <> challenger)
);

create index if not exists duels_match_idx on public.duels (match_id, status);
create index if not exists duels_challenger_idx on public.duels (challenger, status);
create index if not exists duels_opponent_idx on public.duels (opponent, status);

alter table public.duels enable row level security;

-- Open duels are public — that is the board. A matched or settled one is
-- readable by the two people in it. Nothing is writable from the client: every
-- change moves money, so every change goes through a function.
drop policy if exists "duels readable" on public.duels;
create policy "duels readable" on public.duels
  for select using (
    -- The board is open challenges with nobody named on them. A *direct*
    -- challenge is a private message between two people and must not be
    -- readable by the rest of the site just because it is unanswered.
    (status = 'open' and opponent is null)
    or auth.uid() = challenger
    or auth.uid() = opponent
  );

-- ---------------------------------------------------------------------------
-- Creating one
-- ---------------------------------------------------------------------------

create or replace function public.duel_create(
  p_user     uuid,
  p_match    text,
  p_side     text,
  p_stake    integer,
  p_opponent uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_slug    text;
  v_status  text;
  v_balance integer;
  v_open    integer;
  v_id      uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_side not in ('a', 'b') then
    return jsonb_build_object('ok', false, 'error', 'bad_side');
  end if;
  if p_opponent = p_user then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;

  select m.tournament_slug, m.status into v_slug, v_status
    from public.matches m where m.id = p_match;
  if v_slug is distinct from 'blast-porto-2026' then
    return jsonb_build_object('ok', false, 'error', 'not_porto');
  end if;
  if v_status is distinct from 'upcoming' then
    return jsonb_build_object('ok', false, 'error', 'started');
  end if;

  -- Fixed tiers on the open board, any amount for a named opponent. An open
  -- challenge has to *find* a pair, and 137 never meets 140; a direct one is
  -- asking one person who either accepts or does not, so the freedom is free.
  if p_opponent is null and p_stake not in (50, 100, 250, 500) then
    return jsonb_build_object('ok', false, 'error', 'bad_tier');
  end if;
  if p_stake < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_stake');
  end if;

  -- One duel per match per person, on either side of it: a duel is a position,
  -- not a portfolio, and holding both sides is a trade with yourself.
  if exists (
    select 1 from public.duels d
     where d.match_id = p_match
       and d.status in ('open', 'matched')
       and (d.challenger = p_user or d.opponent = p_user)
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_in');
  end if;

  -- Without a cap on open challenges one large balance blankets the board and
  -- everybody else is only ever playing against that person.
  select count(*) into v_open
    from public.duels d
   where d.challenger = p_user and d.status = 'open';
  if v_open >= 3 then
    return jsonb_build_object('ok', false, 'error', 'too_many_open');
  end if;

  select event_points into v_balance
    from public.profiles where id = p_user for update;
  if v_balance is null or v_balance < p_stake then
    return jsonb_build_object('ok', false, 'error', 'insufficient');
  end if;

  insert into public.duels (match_id, challenger, side, opponent, stake)
  values (p_match, p_user, p_side, p_opponent, p_stake)
  returning id into v_id;

  -- Escrowed on creation. The stake is committed the moment the challenge
  -- exists, or a player could post four challenges against one balance.
  update public.profiles
     set event_points = event_points - p_stake
   where id = p_user;

  return jsonb_build_object('ok', true, 'id', v_id, 'balance', v_balance - p_stake);
end;
$$;

revoke execute on function public.duel_create(uuid, text, text, integer, uuid) from public, anon;
grant execute on function public.duel_create(uuid, text, text, integer, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Taking one
-- ---------------------------------------------------------------------------

create or replace function public.duel_accept(p_user uuid, p_duel uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d         record;
  v_status  text;
  v_balance integer;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- Locked for the length of the transaction: two people taking the same open
  -- challenge at once must not both succeed.
  select * into d from public.duels where id = p_duel for update;
  -- `FOUND`, not `d is null`: a record variable with no row assigned raises on
  -- field access rather than comparing as null, so the null test would have
  -- thrown instead of returning "not found".
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if d.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;
  if d.challenger = p_user then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;
  if d.opponent is not null and d.opponent <> p_user then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;

  select m.status into v_status from public.matches m where m.id = d.match_id;
  if v_status is distinct from 'upcoming' then
    return jsonb_build_object('ok', false, 'error', 'started');
  end if;

  if exists (
    select 1 from public.duels x
     where x.match_id = d.match_id
       and x.id <> d.id
       and x.status in ('open', 'matched')
       and (x.challenger = p_user or x.opponent = p_user)
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_in');
  end if;

  select event_points into v_balance
    from public.profiles where id = p_user for update;
  if v_balance is null or v_balance < d.stake then
    return jsonb_build_object('ok', false, 'error', 'insufficient');
  end if;

  update public.duels
     set opponent = p_user, status = 'matched', matched_at = now()
   where id = p_duel;

  update public.profiles
     set event_points = event_points - d.stake
   where id = p_user;

  return jsonb_build_object('ok', true, 'balance', v_balance - d.stake);
end;
$$;

revoke execute on function public.duel_accept(uuid, uuid) from public, anon;
grant execute on function public.duel_accept(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Withdrawing one
-- ---------------------------------------------------------------------------
-- The challenger can pull an untaken challenge, and a named opponent can turn
-- one down. Both are the same event as far as the money goes: the stake goes
-- back and the row is closed.

create or replace function public.duel_withdraw(p_user uuid, p_duel uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare d record;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into d from public.duels where id = p_duel for update;
  if not found or d.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;
  if d.challenger <> p_user and d.opponent is distinct from p_user then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;

  update public.duels set status = 'expired' where id = p_duel;
  update public.profiles
     set event_points = event_points + d.stake
   where id = d.challenger;

  return jsonb_build_object('ok', true, 'refunded', d.stake);
end;
$$;

revoke execute on function public.duel_withdraw(uuid, uuid) from public, anon;
grant execute on function public.duel_withdraw(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Closing a match out
-- ---------------------------------------------------------------------------
-- One call does both halves, because they are the same moment: anything still
-- open never found a pair and is refunded, anything matched is decided.
-- Idempotent on `settled_at` and on the status check, so a re-run of a match's
-- finish hook pays nothing twice.

create or replace function public.duel_close_match(p_match text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d         record;
  v_a       text;
  v_b       text;
  v_sa      integer;
  v_sb      integer;
  v_status  text;
  v_win     text;
  v_settled integer := 0;
  v_refund  integer := 0;
begin
  if auth.uid() is not null then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select m.team_a, m.team_b, m.score_a, m.score_b, m.status
    into v_a, v_b, v_sa, v_sb, v_status
    from public.matches m where m.id = p_match;
  if v_a is null then
    return jsonb_build_object('ok', false, 'error', 'no_match');
  end if;

  -- Never taken. Refunded whether the match was played or cancelled.
  for d in
    select * from public.duels
     where match_id = p_match and status = 'open' for update
  loop
    update public.duels set status = 'expired' where id = d.id;
    update public.profiles
       set event_points = event_points + d.stake
     where id = d.challenger;
    v_refund := v_refund + 1;
  end loop;

  -- A cancelled match or a tie decides nothing, so both stakes go back. All
  -- Porto matches are BO3 or BO5 and cannot tie, but a voided fixture can sit
  -- at 0-0 and must not hand the pot to whoever happened to be side A.
  if v_status is distinct from 'finished' or v_sa = v_sb then
    for d in
      select * from public.duels
       where match_id = p_match and status = 'matched' for update
    loop
      update public.duels set status = 'void', settled_at = now() where id = d.id;
      update public.profiles set event_points = event_points + d.stake
       where id in (d.challenger, d.opponent);
      v_refund := v_refund + 1;
    end loop;
    return jsonb_build_object('ok', true, 'settled', 0, 'refunded', v_refund);
  end if;

  v_win := case when v_sa > v_sb then 'a' else 'b' end;

  for d in
    select * from public.duels
     where match_id = p_match and status = 'matched' for update
  loop
    update public.duels
       set status = 'settled',
           settled_at = now(),
           winner = case when d.side = v_win then d.challenger else d.opponent end
     where id = d.id;

    -- The whole pot, which is exactly the two stakes that left when the duel
    -- was made. Nothing is created here and nothing touches season gold: a
    -- transfer between two players is not a measure of reading the game.
    update public.profiles
       set event_points = event_points + (d.stake * 2)
     where id = case when d.side = v_win then d.challenger else d.opponent end;

    v_settled := v_settled + 1;
  end loop;

  return jsonb_build_object('ok', true, 'settled', v_settled, 'refunded', v_refund);
end;
$$;

revoke execute on function public.duel_close_match(text) from public, anon, authenticated;
grant execute on function public.duel_close_match(text) to service_role;

-- ---------------------------------------------------------------------------
-- A player's record
-- ---------------------------------------------------------------------------
-- Duels keep their own tally rather than feeding the season streak. Two
-- accounts trading losses could otherwise pump one streak indefinitely, and
-- that streak multiplies rewards that are minted — which would turn moved
-- points into printed ones.

create or replace function public.duel_record(p_user uuid)
returns table (won integer, lost integer)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where d.winner = p_user)::integer,
    count(*) filter (where d.winner is not null and d.winner <> p_user)::integer
  from public.duels d
 where d.status = 'settled'
   and (d.challenger = p_user or d.opponent = p_user);
$$;

revoke execute on function public.duel_record(uuid) from public;
grant execute on function public.duel_record(uuid) to anon, authenticated, service_role;
