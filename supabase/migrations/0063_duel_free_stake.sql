-- CS2 UA — any amount on a duel, not just the four.
-- Run in Supabase → SQL Editor. Requires 0062.
--
-- The open board was restricted to 50/100/250/500 on the theory that a
-- challenge has to *find* a pair and 137 never meets 140. That theory was
-- wrong about this board: nothing here matches anybody automatically. A
-- challenge is a row somebody reads and presses, and a row saying 137 is
-- exactly as pressable as one saying 100.
--
-- What actually guards the number is unchanged and sits below: it must be at
-- least 1, and the balance must cover it. Both are checked under the same row
-- lock that escrows the stake.

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
  v_status  text;
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

  select m.tournament_slug, m.status into v_slug, v_status
    from public.matches m where m.id = p_match;
  if v_slug is distinct from 'blast-porto-2026' then
    return jsonb_build_object('ok', false, 'error', 'not_porto');
  end if;
  if v_status is distinct from 'upcoming' then
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
