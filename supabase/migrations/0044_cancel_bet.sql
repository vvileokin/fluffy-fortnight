-- CS2 UA — let a player take their own bet back before the match starts.
-- Run in Supabase → SQL Editor. Requires 0040 (bets).
--
-- Placing a bet was one-way: a mis-tap on the wrong option, or on a stake with
-- an extra zero, was permanent. Nothing is at stake for the house in letting it
-- go — the question hasn't been resolved, so no odds have been proven right or
-- wrong yet, and the points return to exactly where they came from.
--
-- The window closes when the question does. After that the slip is live and a
-- cancel would be a free look at a result.

create or replace function public.cancel_bet(
  p_user     uuid,
  p_question text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stake  integer;
  v_status text;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select status into v_status from public.questions where id = p_question;
  if v_status is distinct from 'open' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  -- Delete and read the stake in one statement, so two taps on the button
  -- cannot both find a row and both refund it.
  delete from public.bets
   where user_id = p_user
     and question_id = p_question
     and settled_at is null
  returning stake into v_stake;

  if v_stake is null then
    return jsonb_build_object('ok', false, 'error', 'no_bet');
  end if;

  update public.profiles
     set ewc_points = ewc_points + v_stake
   where id = p_user;

  return jsonb_build_object('ok', true, 'refunded', v_stake);
end;
$$;

revoke execute on function public.cancel_bet(uuid, text) from public, anon;
grant execute on function public.cancel_bet(uuid, text) to authenticated, service_role;
