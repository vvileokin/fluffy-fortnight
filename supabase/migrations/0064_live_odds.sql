-- CS2 UA — коефіцієнти, що рухаються за грошима. Тоталізатор, не букмекер.
-- Run in Supabase → SQL Editor. Requires 0040 (bets), 0056 (event currency).
--
-- A bookmaker locks your price when you take it and carries the risk himself.
-- A totalisator does not: everyone in the pool settles at the same final
-- number, and that number is decided by where the money ended up. This is the
-- second kind. Bet at 4.00, watch the crowd pile onto your pick until it reads
-- 2.00, and 2.00 is what you are paid.
--
-- That is the whole rule, and it is why the price on screen is information
-- rather than a promise: it is the crowd telling you what it thinks, updated
-- every time somebody disagrees with it in points.
--
--
-- HOW THE NUMBER IS BUILT
--
-- Each option carries a weight: what the house opened it at, plus every point
-- staked on it since.
--
--     weight_i = SEED × opening_probability_i + staked_i
--     odds_i   = ANCHOR × (total weight) / weight_i
--
-- The seed is what stops the first bet of the day from being priced against an
-- empty pool. Without it one 50-point bet would own 100% of the market and
-- return 50 points — technically correct and useless. With SEED = 2000 the
-- opening line holds until real money is comparable to it, then the crowd takes
-- over. It is a prior, in the plain sense: an opinion held only until evidence
-- arrives.
--
-- ANCHOR is not a margin of our own. It is the one constant that makes a market
-- with no bets price at exactly the odds it opened with, which matters because
-- the alternative — normalising to 1 and taking a house cut — would have shaved
-- every existing line the instant this switched on. Aurora's 2.05 would have
-- become 1.67 with nobody having bet a point. And since the anchor is constant,
-- the book keeps whatever margin the opening line already had, however the
-- money moves afterwards.
--
--
-- WHAT MAKES THIS SAFE
--
-- Opt-in per question. `live_odds` is false everywhere by default, so every
-- question that already exists — including the resolved ones — keeps the fixed
-- price it was settled at. Nothing is repriced retroactively.
--
-- The opening price is kept. `open` is written into each option the first time
-- it is touched and never rewritten, so the prior stays the prior even after
-- the visible odds have moved far from it.
--
-- Bounded. Clamped to [1.05, 25]: an option nobody backs cannot print, and one
-- everybody backs still returns more than the stake.
--
-- Computed in the database, not the client. Odds decide payouts, so a figure
-- the browser could post by hand is a figure somebody will.

alter table public.questions
  add column if not exists live_odds boolean not null default false;

comment on column public.questions.live_odds is
  'Totalisator pricing: odds move with the money and everybody settles at the
   final number. False means the fixed price this question has always had.';

-- ---------------------------------------------------------------------------
-- The recompute
-- ---------------------------------------------------------------------------

create or replace function public.recompute_odds(p_question text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  SEED   constant numeric := 2000;   -- house prior, in points
  FLOOR_ constant numeric := 1.05;
  CEIL_  constant numeric := 25;
  v_opts   jsonb;
  v_live   boolean;
  v_inv    numeric := 0;
  v_total  numeric := 0;
  v_new    jsonb := '[]'::jsonb;
  o        jsonb;
  v_open   numeric;
  v_weight numeric;
  v_stake  numeric;
begin
  select options, live_odds into v_opts, v_live
    from public.questions where id = p_question for update;
  if v_opts is null or not coalesce(v_live, false) then
    return;
  end if;

  -- Opening prices, normalised into probabilities. `open` is the original
  -- figure; on the first pass the visible odds still are it.
  for o in select * from jsonb_array_elements(v_opts) loop
    v_open := coalesce((o ->> 'open')::numeric, (o ->> 'odds')::numeric);
    if v_open is null or v_open <= 0 then return; end if;
    v_inv := v_inv + 1 / v_open;
  end loop;
  if v_inv <= 0 then return; end if;

  -- Total weight: the seed, plus every point staked on this question.
  select SEED + coalesce(sum(stake), 0) into v_total
    from public.bets where question_id = p_question;

  for o in select * from jsonb_array_elements(v_opts) loop
    v_open := coalesce((o ->> 'open')::numeric, (o ->> 'odds')::numeric);
    select coalesce(sum(stake), 0) into v_stake
      from public.bets
     where question_id = p_question and option_id = o ->> 'id';

    v_weight := SEED * ((1 / v_open) / v_inv) + v_stake;

    v_new := v_new || jsonb_build_object(
      'id',     o ->> 'id',
      'label',  o ->> 'label',
      'reward', (o ->> 'reward'),
      'open',   v_open,
      -- Anchored on the opening line rather than on a margin of its own.
      -- `1 / v_inv` is exactly the constant that makes an unbet market price at
      -- its opening odds — and because it is a constant, the book's overround
      -- stays whatever the opening line set it to no matter how the money
      -- moves. Nothing is silently made stingier the moment this switches on.
      'odds',   round(least(greatest((1 / v_inv) * v_total / v_weight, FLOOR_), CEIL_), 2)
    );
  end loop;

  update public.questions set options = v_new, updated_at = now()
   where id = p_question;
end;
$$;

revoke execute on function public.recompute_odds(text) from public, anon, authenticated;
grant execute on function public.recompute_odds(text) to service_role;

-- ---------------------------------------------------------------------------
-- Moving the line
-- ---------------------------------------------------------------------------
-- After the insert, so the bettor is priced at what they saw rather than at
-- what their own stake did to the market. Their money moves it for the next
-- person, which is the correct order of events.

create or replace function public.bet_moves_odds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_odds(new.question_id);
  return null;
end;
$$;

drop trigger if exists bets_move_odds on public.bets;
create trigger bets_move_odds
  after insert on public.bets
  for each row execute function public.bet_moves_odds();

revoke execute on function public.bet_moves_odds() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Settling at the final number
-- ---------------------------------------------------------------------------
-- The one change that makes this a totalisator rather than a bookmaker: the
-- price used is the question's, read at settlement, not the one the bet was
-- taken at. `b.odds` is overwritten with it as we go, so a settled bet shows
-- what it was actually paid at rather than what it was quoted at — a row that
-- says 4.00 next to a payout computed from 2.00 is a row that looks like a bug.
--
-- Fixed-odds questions are untouched: `live_odds` false falls back to `b.odds`,
-- which is the price they locked, so every existing question behaves exactly as
-- it did before this migration ran.

create or replace function public.settle_bets(p_question text, p_correct text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  touched integer;
  v_live  boolean;
  v_final numeric;
begin
  if auth.uid() is not null then return 0; end if;

  select q.live_odds,
         (select (o ->> 'odds')::numeric
            from jsonb_array_elements(q.options) o
           where o ->> 'id' = p_correct)
    into v_live, v_final
    from public.questions q where q.id = p_question;

  with paid as (
    update public.bets b
       set odds = case when coalesce(v_live, false) and v_final is not null
                       then v_final else b.odds end,
           payout = case when b.option_id = p_correct
                         then floor(b.stake
                                * (case when coalesce(v_live, false) and v_final is not null
                                        then v_final else b.odds end)
                                * case when pr.streak >= 10 then 2.0
                                       when pr.streak >= 5  then 1.5
                                       when pr.streak >= 3  then 1.25
                                       else 1.0 end)::integer
                         else 0 end,
           settled_at = now()
      from public.profiles pr
     where b.question_id = p_question and b.settled_at is null and pr.id = b.user_id
    returning b.user_id, b.payout, b.stake
  ), credited as (
    -- The stake left `event_points` when the bet was placed, so the whole
    -- payout comes back to it. Season gold takes the profit only, which is the
    -- part that was actually earned rather than returned.
    update public.profiles p
       set event_points      = p.event_points + paid.payout,
           points            = p.points + greatest(paid.payout - paid.stake, 0),
           ewc_earned_points = p.ewc_earned_points + greatest(paid.payout - paid.stake, 0)
      from paid
     where p.id = paid.user_id and paid.payout > 0
    returning 1
  )
  select count(*) into touched from paid;
  return touched;
end;
$$;

revoke execute on function public.settle_bets(text, text) from public, anon, authenticated;
grant execute on function public.settle_bets(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- A duel cannot be joined after the whistle
-- ---------------------------------------------------------------------------
-- Found while closing the 0-2 club: both duel paths asked whether the match was
-- still marked `upcoming`, and that column is set by a person. On the opening
-- day nobody set it — Aurora — G2 kicked off at 09:00 and still read `upcoming`
-- an hour later. A gate that depends on somebody remembering is not a gate, so
-- the clock is checked too.

create or replace function public.match_open(p_match text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(m.status = 'upcoming' and m.start_at > now(), false)
    from public.matches m where m.id = p_match;
$$;

grant execute on function public.match_open(text) to anon, authenticated, service_role;

-- Lifted from 0062/0063 unchanged apart from the gate, so the notification
-- wiring and the free stake both survive this.

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
  v_balance integer;
  v_open    integer;
  v_id      uuid;
  v_from    text;
  v_match   text;
  v_when    text;
  v_side    text;
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

  select m.tournament_slug into v_slug
    from public.matches m where m.id = p_match;
  if v_slug is distinct from 'blast-porto-2026' then
    return jsonb_build_object('ok', false, 'error', 'not_porto');
  end if;
  if not public.match_open(p_match) then
    return jsonb_build_object('ok', false, 'error', 'started');
  end if;

  if p_stake < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_stake');
  end if;

  if exists (
    select 1 from public.duels d
     where d.match_id = p_match
       and d.status in ('open', 'matched')
       and (d.challenger = p_user or d.opponent = p_user)
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_in');
  end if;

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

  update public.profiles
     set event_points = event_points - p_stake
   where id = p_user;

  -- Only a named challenge has somebody to tell. An open one is an offer to
  -- the room, and the room is the board.
  if p_opponent is not null then
    select handle into v_from from public.profiles where id = p_user;
    select coalesce(m.team_a_name, initcap(m.team_a)) || ' — ' || coalesce(m.team_b_name, initcap(m.team_b)),
           coalesce(m.time_label, ''),
           case when p_side = 'a' then coalesce(m.team_a_name, initcap(m.team_a))
                else coalesce(m.team_b_name, initcap(m.team_b)) end
      into v_match, v_when, v_side
      from public.matches m where m.id = p_match;

    perform public.duel_notify(
      p_opponent,
      'duel_challenge',
      coalesce(v_from, 'Суперник') || ' викликав тебе на дуель · ' || p_stake,
      jsonb_build_object('from', coalesce(v_from, 'Суперник'), 'match', v_match,
                         'when', v_when, 'side', v_side, 'stake', p_stake),
      jsonb_build_object('duel', v_id, 'match', p_match)
    );
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'balance', v_balance - p_stake);
end;
$$;

revoke execute on function public.duel_create(uuid, text, text, integer, uuid) from public, anon;
grant execute on function public.duel_create(uuid, text, text, integer, uuid) to authenticated, service_role;

create or replace function public.duel_accept(p_user uuid, p_duel uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d         record;
  v_balance integer;
  v_from    text;
  v_match   text;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into d from public.duels where id = p_duel for update;
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

  if not public.match_open(d.match_id) then
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

  -- The challenger posted this and left. They should not have to come back and
  -- check whether anybody bit.
  select handle into v_from from public.profiles where id = p_user;
  select coalesce(m.team_a_name, initcap(m.team_a)) || ' — ' || coalesce(m.team_b_name, initcap(m.team_b))
    into v_match
    from public.matches m where m.id = d.match_id;

  perform public.duel_notify(
    d.challenger,
    'duel_accepted',
    coalesce(v_from, 'Суперник') || ' прийняв твій виклик · ' || d.stake,
    jsonb_build_object('from', coalesce(v_from, 'Суперник'), 'match', v_match,
                       'stake', d.stake),
    jsonb_build_object('duel', p_duel, 'match', d.match_id)
  );

  return jsonb_build_object('ok', true, 'balance', v_balance - d.stake);
end;
$$;

revoke execute on function public.duel_accept(uuid, uuid) from public, anon;
grant execute on function public.duel_accept(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Turning it on
-- ---------------------------------------------------------------------------
-- Porto's open staking questions only. Resolved ones keep the price they were
-- settled at, and the free predictions have no price to move.

update public.questions q
   set live_odds = true
  from public.matches m
 where m.id = q.match_id
   and m.tournament_slug = 'blast-porto-2026'
   and q.betting is true
   and q.status = 'open';

-- Seed the visible odds from the opening line so nothing shows a stale price
-- before its first bet arrives.
do $$
declare r record;
begin
  for r in select id from public.questions where live_odds is true loop
    perform public.recompute_odds(r.id);
  end loop;
end $$;
