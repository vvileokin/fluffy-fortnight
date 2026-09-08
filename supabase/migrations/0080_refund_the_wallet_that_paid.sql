-- ---------------------------------------------------------------------------
-- A refund goes back where the stake came from
-- ---------------------------------------------------------------------------
-- 0079 gave a bet a `wallet` and taught `place_bet` and `settle_bets` to use
-- it: an ordinary match is staked and paid in season points, an event match in
-- the event's own. It did not teach the two functions that hand a stake back.
--
-- `cancel_bet` and `refund_bets` both still credit `event_points`
-- unconditionally, which was correct while that was the only wallet a stake
-- could leave. Since 0079 it is not. Cancelling a bet on an ordinary match
-- therefore took the stake out of `points` and put it back into
-- `event_points` — the player is down the season gold they staked, up the same
-- number of event points they never earned, and the balance they were looking
-- at simply never came back.
--
-- The bet knows which wallet paid for it. Both functions read it now.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_bet(p_user uuid, p_question text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_stake  integer;
  v_wallet text;
  v_status text;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select m.status into v_status
    from public.questions q join public.matches m on m.id = q.match_id
   where q.id = p_question;
  if v_status is distinct from 'upcoming' then
    return jsonb_build_object('ok', false, 'error', 'started');
  end if;

  delete from public.bets
   where user_id = p_user and question_id = p_question and settled_at is null
  returning stake, wallet into v_stake, v_wallet;
  if v_stake is null then
    return jsonb_build_object('ok', false, 'error', 'no_bet');
  end if;

  -- Straight back to the column `place_bet` took it from. A bet written before
  -- 0079 has the default 'event', which is what those were charged.
  update public.profiles
     set event_points = event_points + case when v_wallet = 'event' then v_stake else 0 end,
         points       = points       + case when v_wallet = 'event' then 0 else v_stake end
   where id = p_user;

  return jsonb_build_object('ok', true, 'refunded', v_stake, 'wallet', v_wallet);
end;
$$;

revoke execute on function public.cancel_bet(uuid, text) from public, anon;
grant execute on function public.cancel_bet(uuid, text) to authenticated, service_role;

-- Same fault, same fix: a question pulled after bets were taken hands every
-- stake back, and each one has to find its own wallet.
create or replace function public.refund_bets(p_question text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;
  with back as (
    delete from public.bets b
     where b.question_id = p_question and b.settled_at is null
    returning b.user_id, b.stake, b.wallet
  ), credited as (
    update public.profiles p
       set event_points = p.event_points
             + case when back.wallet = 'event' then back.stake else 0 end,
           points = p.points
             + case when back.wallet = 'event' then 0 else back.stake end
      from back where p.id = back.user_id
    returning 1
  )
  select count(*) into touched from back;
  return touched;
end;
$$;

revoke execute on function public.refund_bets(text) from public, anon, authenticated;
grant execute on function public.refund_bets(text) to service_role;
