-- CS2 UA — drop the stake floor to a single point.
-- Run in Supabase → SQL Editor. Replaces the `place_bet` from 0040.
--
-- 0040 shipped with a minimum of 50. The UI and the API route were later
-- changed to allow any positive amount, and 0040 was edited in place to match —
-- which did nothing at all for a database that had already run it. The function
-- kept refusing anything under 50 while the interface offered it, so a stake of
-- 10 came back as "Вкажи суму" with nothing on screen to explain why.
--
-- A minimum only ever bites the players holding the least, which is precisely
-- who a small stake matters most to.
--
-- Everything else here is 0040's function verbatim; only the floor moves.

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

  -- Any positive whole number of points. Mirrored in the route and the slip.
  if p_stake is null or p_stake < 1 then
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
