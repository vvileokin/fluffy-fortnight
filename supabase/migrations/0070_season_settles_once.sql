-- CS2 UA — сезонне золото нараховується один раз, наприкінці.
-- Run in Supabase → SQL Editor. Requires 0064.
--
-- A winning bet was credited twice over. `settle_bets` added its profit to
-- season gold the moment it resolved, and `settle_event_to_season` was written
-- to add `event_points - 500` again when the tournament closes — 179 316 paid
-- already, and 99 749 more waiting to be paid on top of it.
--
-- The immediate credit was also the wrong measure. It takes the profit of each
-- *winning* slip and ignores every losing one, so a player who won 1 000 and
-- lost 900 was credited 1 000 for an event they finished 100 up. The closing
-- settlement asks the only question that has an answer — what did you finish
-- with — and that is the one kept.
--
-- So the event pays into the event's wallet and nowhere else, and the season
-- table stops moving until the tournament ends. Which is what was agreed when
-- the event opened: everybody starts level, and it settles once.
--
-- `ewc_earned_points` keeps counting gross winnings. It is a statistic on the
-- profile, not a balance anybody spends.

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
    -- payout comes back to it — and stops there. Season gold is settled once,
    -- at the end of the event, from what the player actually finished with.
    -- `ewc_earned_points` still tracks gross winnings; it is a statistic, not a
    -- wallet.
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
