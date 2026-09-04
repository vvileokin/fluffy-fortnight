-- CS2 UA — серія множить виграш, а не повернення ставки.
-- Run in Supabase → SQL Editor. Requires 0064, 0070.
--
--     payout = floor(stake × odds × multiplier)
--
-- The multiplier lands on the whole return, and the whole return contains the
-- stake coming back. At a streak of ten that is ×2, so a slip on a 1.05
-- certainty pays 2.10 times its stake. The safer the pick, the bigger the edge:
-- a favourite nobody doubts becomes a better bet than a coin flip, which is the
-- exact reverse of what odds are for.
--
-- What it produced: 9 000 staked at 1.05 paid 18 900. Nine thousand of that is
-- the stake returning, 450 is what the odds actually earned, and 9 450 is the
-- multiplier paying a second stake on top. Across every settled slip the
-- multiplier has paid 107 342 — 14.8% of all winnings — and 52 433 of that went
-- to one account, three quarters of its season balance.
--
-- The rule was never meant to work that way. `src/lib/streak.ts` says so in as
-- many words — "applied to winnings exactly as it is to flat rewards" — and for
-- a flat prediction reward it is true, because there is no stake in it to
-- double. Betting is where the two came apart.
--
--     payout = stake + floor(stake × (odds − 1) × multiplier)
--
-- Same ladder, same tiers, same numbers on a prediction. On a slip the streak
-- now doubles what was won and returns what was risked, so 9 000 at 1.05 on a
-- ×2 streak pays 9 900 — a 900 profit rather than a 9 900 one.
--
-- Settled slips are left exactly as they are. Rewriting a fortnight of paid-out
-- history would take gold off accounts that spent it, and the wallets currently
-- reconcile to the point; the correction is worth doing deliberately, from a
-- list, not as a side effect of a schema change.

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
           payout = case
             when b.option_id = p_correct then
               -- The stake comes back whole; only what it won is multiplied.
               b.stake + floor(
                 b.stake
                 * (greatest(case when coalesce(v_live, false) and v_final is not null
                                  then v_final else b.odds end, 1) - 1)
                 * case when pr.streak >= 10 then 2.0
                        when pr.streak >= 5  then 1.5
                        when pr.streak >= 3  then 1.25
                        else 1.0 end
               )::integer
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
