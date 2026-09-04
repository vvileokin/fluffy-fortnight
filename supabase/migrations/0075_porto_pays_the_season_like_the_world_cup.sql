-- CS2 UA — Porto нараховує в сезонні за правилом EWC: виграш додає, програш не знімає.
-- Run in Supabase → SQL Editor. Requires 0071, 0073, 0074.
--
-- The rule Porto now follows is the one every previous tournament followed, and
-- 0048 stated it outright when the World Cup opened:
--
--     `points` is a lifetime score: everything that writes it adds, nothing
--     subtracts. That is why a losing bet must not take season points away, and
--     why a winning one adds only what it made above the stake.
--
-- The data agrees. Thirty-seven accounts finished the World Cup down on their
-- betting — 4 279 lost between them — and not one of them carries that loss in
-- the season column; they hold the 4 151 their winning slips made and nothing
-- was taken back. So the season total was never a mirror of the event wallet.
-- It was a ratchet.
--
-- 0074 made Porto a mirror instead: the wallet copied into the season column
-- live, losses coming off both. That is a defensible rule and it is not this
-- one, and introducing it in the middle of a tournament that had been running
-- under the other for a fortnight is what produced the complaints. It is undone
-- here.
--
-- So, for Porto, exactly as for the World Cup:
--
--     winning slip     → wallet gets the payout, season gets the profit
--     losing slip      → wallet pays, season does not move
--     group call       → wallet and season both get it, like a bracket round
--     the 500 grant    → never converts; it is a stake, not earnings
--     tournament ends  → nothing left to convert, the season already has it
--
-- Balances, before and after:
--
--     season now                                569 253
--     less the mirror 0074 wrote               −194 689
--     plus the profit of every winning slip    +205 065
--     plus the group stage, as a bracket pays   +29 800
--     season after                              609 429
--
-- Nobody goes negative. The accounts that come out lower are the ones holding a
-- barely-touched 500: under this rule the grant is a stake and never was season
-- gold, which is exactly how the World Cup worked, where there was no grant at
-- all.

-- ---------------------------------------------------------------------------
-- A mark, so a re-run cannot pay twice
-- ---------------------------------------------------------------------------

create table if not exists public.migration_marks (
  id         text primary key,
  applied_at timestamptz not null default now()
);
revoke all on public.migration_marks from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Take the mirror out
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_mirror_event on public.profiles;
drop function if exists public.mirror_event_into_season();

-- ---------------------------------------------------------------------------
-- 2. Rebalance, once
-- ---------------------------------------------------------------------------
-- Order matters: unwind the mirror first, then pay what the ratchet owes.
-- Subtracting the current wallet is the exact reverse of what 0074 added,
-- because the mirror kept the two in step until the moment it was dropped.

do $$
begin
  if exists (select 1 from public.migration_marks where id = '0075_ratchet') then
    raise notice '0075 вже застосовано — пропускаю перерахунок';
    return;
  end if;

  -- Undo 0074's backfill and everything the mirror tracked since.
  update public.profiles p
     set points = greatest(coalesce(p.points, 0) - greatest(coalesce(p.event_points, 0), 0), 0)
   where p.event_joined_at is not null;

  -- The profit of every winning Porto slip, losses ignored — the World Cup rule.
  with win as (
    select b.user_id, sum(greatest(b.payout - b.stake, 0))::integer as gain
      from public.bets b
      join public.questions q on q.id = b.question_id
      join public.matches   m on m.id = q.match_id
     where m.tournament_slug = 'blast-porto-2026'
       and b.settled_at is not null
       and b.payout > b.stake
     group by b.user_id
  )
  update public.profiles p
     set points = coalesce(p.points, 0) + win.gain
    from win
   where p.id = win.user_id;

  -- Group calls pay the season too, the way a bracket round did on the World
  -- Cup. They only ever reached `event_points`, so this is the first time they
  -- have counted where the season board can see them.
  with g as (
    select user_id, sum(points)::integer as gain
      from public.porto_groups
     where coalesce(points, 0) > 0
     group by user_id
  )
  update public.profiles p
     set points = coalesce(p.points, 0) + g.gain
    from g
   where p.id = g.user_id;

  insert into public.migration_marks (id) values ('0075_ratchet');
end $$;

-- ---------------------------------------------------------------------------
-- 3. A winning slip pays the season again
-- ---------------------------------------------------------------------------
-- The streak stays on the coefficient (0073). What changes is the season line:
-- the profit above the stake, and only on a win.

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
    -- The wallet gets the whole payout back; the season gets what the slip made
    -- above the stake. A loser writes nothing here at all, which is the point.
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
-- 4. Predictions and groups pay the season again
-- ---------------------------------------------------------------------------
-- 0071 walled the running event out of `points`, which was right for a rule
-- that settles once at the end and wrong for this one. Both branches go back to
-- paying both columns, as every other event does.

create or replace function public.award_predictions(
  p_users uuid[], p_reward integer, p_columns text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;

  update public.profiles
     set points            = points  + p_reward,
         correct           = correct + 1,
         bounty_points     = bounty_points  + case when p_columns = 'bounty' then p_reward else 0 end,
         bounty_correct    = bounty_correct + case when p_columns = 'bounty' then 1 else 0 end,
         ewc_points        = ewc_points     + case when p_columns = 'ewc' then p_reward else 0 end,
         ewc_correct       = ewc_correct    + case when p_columns = 'ewc' then 1 else 0 end,
         event_points      = event_points   + case when p_columns = 'event' then p_reward else 0 end,
         event_joined_at   = case when p_columns = 'event'
                                  then coalesce(event_joined_at, now())
                                  else event_joined_at end,
         ewc_earned_points = ewc_earned_points
                             + case when p_columns in ('ewc', 'event') then p_reward else 0 end
   where id = any (p_users);

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke execute on function public.award_predictions(uuid[], integer, text)
  from public, anon, authenticated;
grant execute on function public.award_predictions(uuid[], integer, text) to service_role;

create or replace function public.score_porto_group(
  p_group text, p_advance text[], p_zero_two text[]
)
returns integer
language plpgsql security definer set search_path = public
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
      -- Both columns, the way a bracket round pays: there is no stake in a
      -- group call, so the whole thing is winnings.
      update public.profiles
         set event_points    = event_points + gained,
             points          = points + gained,
             event_joined_at = coalesce(event_joined_at, now())
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

-- ---------------------------------------------------------------------------
-- 5. Closing the tournament converts nothing
-- ---------------------------------------------------------------------------
-- The season column has been paid as the tournament went along, so there is
-- nothing left to hand over. The wallet is cleared and the event closes — the
-- same way `ewc_points` was simply left where it stood when the World Cup
-- finished.

create or replace function public.settle_event_to_season(p_grant integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;

  with closed as (
    update public.profiles p
       set event_points = 0,
           event_joined_at = null
     where p.event_joined_at is not null
    returning 1
  )
  select count(*) into touched from closed;

  update public.profiles set event_points = 0
   where event_joined_at is null and event_points <> 0;

  return touched;
end;
$$;

revoke execute on function public.settle_event_to_season(integer)
  from public, anon, authenticated;
grant execute on function public.settle_event_to_season(integer) to service_role;
