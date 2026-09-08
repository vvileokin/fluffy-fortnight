-- CS2 UA — звичайна ставка списує сезонні поінти, івентова — івентові.
-- Run in Supabase → SQL Editor. Requires 0060, 0075.
--
-- `place_bet` has debited `event_points` since 0060, unconditionally. That was
-- right while the whole site was one tournament: every open question belonged
-- to the World Cup, and later to Porto, so there was only one wallet a stake
-- could come out of.
--
-- Porto is over and ordinary matches are still on the board — and they are
-- charging what is left of the Porto wallet, and stamping `event_joined_at` on
-- players who never entered an event. A bet on a random playoff match should
-- cost season points, because that is the only currency it can honestly be
-- priced in.
--
-- ---------------------------------------------------------------------------
-- Which questions are event questions
-- ---------------------------------------------------------------------------
-- Not `matches.is_event`: twenty-four of Porto's twenty-nine matches have it
-- false, and the site decides an event by the tournament's `skin`, which lives
-- in the code catalogue rather than in the database. Nothing here can read it.
--
-- So the list is explicit. A table of slugs, seeded with the three events that
-- have run, and one row to add whenever the next one starts. Explicit beats
-- inferred for a rule that moves money: when this is wrong it will be wrong in
-- a way somebody can see and fix, rather than wrong because a flag drifted.
create table if not exists public.event_tournaments (
  slug       text primary key,
  started_at timestamptz not null default now()
);

insert into public.event_tournaments (slug) values
  ('ewc-2026'), ('blast-bounty-s2'), ('blast-porto-2026')
on conflict (slug) do nothing;

alter table public.event_tournaments enable row level security;
drop policy if exists event_tournaments_read on public.event_tournaments;
create policy event_tournaments_read on public.event_tournaments for select using (true);
grant select on public.event_tournaments to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Which wallet a bet came out of, recorded on the bet
-- ---------------------------------------------------------------------------
-- Settlement has to pay back into the wallet the stake was taken from, and it
-- cannot work that out later: a tournament can be added to the list above after
-- a bet was placed, and then a stake taken from season points would be repaid
-- into the event wallet. The bet remembers, so the pair can never come apart.
--
-- Everything already on the table was taken from `event_points`, which is what
-- the default records. No existing row changes meaning.
alter table public.bets
  add column if not exists wallet text not null default 'event'
  check (wallet in ('event', 'season'));

-- ---------------------------------------------------------------------------
-- Placing
-- ---------------------------------------------------------------------------
create or replace function public.place_bet(
  p_user uuid, p_question text, p_option text, p_stake integer
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_odds    numeric;
  v_balance integer;
  v_event   boolean;
  v_wallet  text;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_stake is null or p_stake < 1 then
    return jsonb_build_object('ok', false, 'error', 'bad_stake');
  end if;

  select (o ->> 'odds')::numeric into v_odds
    from public.questions q,
         lateral jsonb_array_elements(q.options) o
   where q.id = p_question and o ->> 'id' = p_option;
  if v_odds is null or v_odds < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_odds');
  end if;

  -- Question → match → tournament → is it one of ours.
  select exists (
    select 1
      from public.questions q
      join public.matches m on m.id = q.match_id
      left join public.event_tournaments e on e.slug = m.tournament_slug
     where q.id = p_question
       and (e.slug is not null or coalesce(m.is_event, false))
  ) into v_event;
  v_wallet := case when v_event then 'event' else 'season' end;

  select case when v_event then event_points else points end
    into v_balance
    from public.profiles where id = p_user for update;
  if v_balance is null or v_balance < p_stake then
    return jsonb_build_object('ok', false, 'error', 'insufficient');
  end if;

  begin
    insert into public.bets (user_id, question_id, option_id, stake, odds, wallet)
    values (p_user, p_question, p_option, p_stake, v_odds, v_wallet);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_placed');
  end;

  if v_event then
    -- Unchanged: the event wallet pays, and joining is stamped so the season
    -- ratchet in 0075 knows this player took part.
    update public.profiles
       set event_points = event_points - p_stake,
           event_joined_at = coalesce(event_joined_at, now())
     where id = p_user;
  else
    -- Season gold, and no stamp. A bet on an ordinary match is not entering an
    -- event, and marking it as one is what let the Porto rules reach players
    -- who never played Porto.
    update public.profiles
       set points = points - p_stake
     where id = p_user;
  end if;

  return jsonb_build_object('ok', true, 'odds', v_odds, 'wallet', v_wallet,
                            'balance', v_balance - p_stake);
end;
$$;

grant execute on function public.place_bet(uuid, text, text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Settling
-- ---------------------------------------------------------------------------
-- The event half is exactly 0075: the wallet gets the whole payout back and the
-- season column keeps the profit, never the loss. The season half is simpler
-- because there is only one column — the stake left `points` and the payout
-- returns to it, so a win nets the profit and a loss has already been paid.
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
    returning b.user_id, b.payout, b.stake, b.wallet
  ), credited as (
    update public.profiles p
       set event_points = p.event_points
             + case when paid.wallet = 'event' then paid.payout else 0 end,
           points = p.points
             + case when paid.wallet = 'event'
                    then greatest(paid.payout - paid.stake, 0)
                    else paid.payout end,
           ewc_earned_points = p.ewc_earned_points
             + case when paid.wallet = 'event'
                    then greatest(paid.payout - paid.stake, 0)
                    else 0 end
      from paid
     where p.id = paid.user_id and paid.payout > 0
    returning 1
  )
  select count(*) into touched from paid;
  return touched;
end;
$$;

grant execute on function public.settle_bets(text, text) to service_role;
