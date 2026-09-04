-- CS2 UA — серія множить коефіцієнт, і гаманець події конвертується повністю.
-- Run in Supabase → SQL Editor. Requires 0064, 0070.
--
-- Two rulings, both deliberate, both replacing something I had changed.
--
-- ---------------------------------------------------------------------------
-- 1. The streak multiplies the coefficient
-- ---------------------------------------------------------------------------
--     payout = floor(stake × odds × multiplier)
--
-- I had changed this to multiply only the winnings, on the grounds that a ×2
-- streak turns a 1.05 certainty into a 2.10 — the safer the pick, the larger
-- the edge. That is a real property of the rule and it is worth knowing about:
-- the multiplier has paid 107 342 across every settled slip, 14.8% of all
-- winnings.
--
-- It is also the rule as intended, and as every player has seen it work since
-- the streak shipped. A run of ten doubling a slip outright is the reward the
-- ladder was built to hand out. So it stands, and this restores it in case
-- 0072 was applied before the call was made.
--
-- ---------------------------------------------------------------------------
-- 2. Playing at all converts the whole wallet
-- ---------------------------------------------------------------------------
-- The old rule paid `event_points − 500`: the grant was a table stake and only
-- what you made above it became season gold. That punished the player who
-- finished at 300 exactly as hard as the one who never logged in — both got
-- nothing — even though one of them played the tournament and the other did
-- not.
--
-- The rule now is the simpler one, and the one that was announced:
--
--     did something with the 500  →  the whole wallet becomes season gold
--     never touched it            →  nothing, and the stake expires
--
-- So finishing at 300 pays 300. Finishing at 28 910 pays 28 910. Sitting on an
-- untouched 500 pays nothing, which is what keeps the grant from being 300 000
-- points minted for signing up.
--
-- `event_joined_at` is what "did something" means, and it is stamped by every
-- paying path: a bet, a duel, a scored group (0071), a scored prediction. It
-- survives losing the money — a player down to zero still turned up.

-- ---------------------------------------------------------------------------
-- The coefficient carries the streak
-- ---------------------------------------------------------------------------

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
    -- Unchanged from 0070: the payout returns to the wallet the stake left, and
    -- the season table stays still until the event closes.
    update public.profiles p
       set event_points      = p.event_points + paid.payout,
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
-- Closing the event: everything, for everyone who played
-- ---------------------------------------------------------------------------
-- The `p_grant` argument is kept so existing callers do not break, but it now
-- decides only one thing: an account still sitting on exactly the untouched
-- stake and nothing else is treated as not having played, even if something
-- stamped it. Belt and braces — `event_joined_at` is the real test.

create or replace function public.settle_event_to_season(p_grant integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;

  with paid as (
    update public.profiles p
       set points = p.points + greatest(p.event_points, 0),
           event_points = 0,
           event_joined_at = null
     where p.event_joined_at is not null
    returning 1
  )
  select count(*) into touched from paid;

  -- Never played: the stake expires. It was a table stake for a game they did
  -- not sit down to.
  update public.profiles set event_points = 0 where event_joined_at is null;

  return touched;
end;
$$;

revoke execute on function public.settle_event_to_season(integer)
  from public, anon, authenticated;
grant execute on function public.settle_event_to_season(integer) to service_role;
