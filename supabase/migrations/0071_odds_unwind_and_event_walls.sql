-- CS2 UA — скасована ставка повертає коефіцієнт, подія не тече в сезон,
-- і бали за групи більше не губляться.
-- Run in Supabase → SQL Editor. Requires 0064, 0069, 0070.
--
-- Three things, all of them the same mistake in different places: a rule that
-- was written once and then not applied everywhere it had to be.
--
-- ---------------------------------------------------------------------------
-- 1. The line only moved one way
-- ---------------------------------------------------------------------------
-- `bets_move_odds` fires `after insert`. Nothing fires on delete. So placing a
-- bet pushed the price down and cancelling it left the price down — the stake
-- came back to the wallet, the market kept the weight. Anyone could walk a
-- coefficient to the floor with a large stake, cancel, and leave everybody else
-- on the depressed line; and honest cancellations quietly did the same thing by
-- accident.
--
-- `recompute_odds` is a pure function of the opening line and the bets that
-- exist right now, so there is nothing to reverse by hand: firing it after the
-- row goes away restores exactly the price that was there before. What was
-- missing was the call.
--
-- The update branch is scoped to `stake` and `option_id` deliberately.
-- `settle_bets` writes `payout` and `settled_at` across every row of a
-- question, and recomputing a market that has already closed is pointless work
-- at best.
--
-- ---------------------------------------------------------------------------
-- 2. The event settles once — for predictions too
-- ---------------------------------------------------------------------------
-- 0070 stopped `settle_bets` paying season gold mid-tournament. It did not
-- touch `award_predictions`, which credits `points` and `event_points` in the
-- same statement for every branch — so a correct prediction on a running event
-- was still paid twice, once into the wallet and once into the season table.
--
-- Nothing has come through that path yet: Porto questions all take stakes, so
-- there are no predictions on them and there is nothing to unwind. It is fixed
-- now rather than after it costs something.
--
-- `score_bracket_round` has the same hole and is deliberately left alone; the
-- reason is at the foot of this file.
--
-- What the event pays into the season table is still settled in exactly one
-- place, `settle_event_to_season`, when the tournament ends: everything above
-- the starting 500, and nothing at all for a stake that was never touched.

-- ---------------------------------------------------------------------------
-- Cancelling a bet gives the price back
-- ---------------------------------------------------------------------------

create or replace function public.bet_unmoves_odds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Branch on the operation rather than coalescing: on DELETE there is no
  -- `new` record at all, and PL/pgSQL evaluates both arguments of a coalesce
  -- before it picks one, so the tidy-looking version raises instead of firing.
  if tg_op = 'DELETE' then
    perform public.recompute_odds(old.question_id);
  else
    perform public.recompute_odds(new.question_id);
    -- A stake moved to another question re-prices the one it left, too.
    if new.question_id is distinct from old.question_id then
      perform public.recompute_odds(old.question_id);
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function public.bet_unmoves_odds() from public, anon, authenticated;

drop trigger if exists bets_unmove_odds on public.bets;
create trigger bets_unmove_odds
  after delete on public.bets
  for each row execute function public.bet_unmoves_odds();

-- A stake edited in place moves the market as surely as one placed or removed.
drop trigger if exists bets_restake_odds on public.bets;
create trigger bets_restake_odds
  after update of stake, option_id on public.bets
  for each row execute function public.bet_unmoves_odds();

-- ---------------------------------------------------------------------------
-- Repair: every open market re-priced from the bets that actually exist
-- ---------------------------------------------------------------------------
-- Any question that has had a cancellation since floating odds went live is
-- sitting on a line that was never corrected. This is idempotent — the function
-- derives the price from scratch — so it is safe to run on all of them.

do $$
declare r record;
begin
  for r in
    select q.id from public.questions q
     where coalesce(q.live_odds, false)
       and q.status is distinct from 'resolved'
  loop
    perform public.recompute_odds(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- A running event pays its own wallet and waits
-- ---------------------------------------------------------------------------

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
     set -- Season gold for everything except the running event. That one is
         -- settled once, at the end, from the balance the player finishes with.
         points            = points + case when p_columns = 'event' then 0 else p_reward end,
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

-- ---------------------------------------------------------------------------
-- 3. Winning a group is turning up
-- ---------------------------------------------------------------------------
-- `score_porto_group` pays `event_points` and never stamps `event_joined_at`.
-- That stamp is what puts a player on the event board, and — worse — what
-- `settle_event_to_season` uses to decide who gets paid at the close. A player
-- whose only Porto action was calling a group therefore could not see their own
-- points on the table, and when the tournament ended the "never played" branch
-- would have wiped the wallet and paid them nothing.
--
-- Three accounts are in exactly that position, holding 1 250 between them:
-- points they earned, could not see, and were going to lose. Scoring a group is
-- as much an action as placing a bet, so it stamps like one.

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
      update public.profiles
         set event_points    = event_points + gained,
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

-- Backfill: anyone already paid for a group counts as having turned up.
update public.profiles p
   set event_joined_at = coalesce(p.event_joined_at, now())
 where p.event_joined_at is null
   and exists (
     select 1 from public.porto_groups g
      where g.user_id = p.id and coalesce(g.points, 0) > 0
   );

-- ---------------------------------------------------------------------------
-- Left alone: score_bracket_round
-- ---------------------------------------------------------------------------
-- It has the same shape of hole — it writes `points` unconditionally, so
-- scoring a bracket for a running event would credit the season table
-- mid-tournament. It is not touched here on purpose.
--
-- No bracket exists for the running event: `bracket_predictions` holds
-- ewc-2026 and nothing else, and the Porto brackets were closed before any
-- were taken. So the hole is unreachable today, while rewriting a working
-- scoring function — one with per-round rewards and a champion pick that is a
-- scalar rather than an array — to close it is a real chance of breaking the
-- World Cup history it has already paid out.
--
-- If a bracket is ever opened on a live event, this is the function to guard
-- first, the same way `award_predictions` is guarded above.
