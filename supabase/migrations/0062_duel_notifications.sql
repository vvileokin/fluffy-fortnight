-- CS2 UA — a duel that reaches you on the site, not only in the bot.
-- Run in Supabase → SQL Editor. Requires 0058 (duels), 0061 (cancel/decline).
--
-- A direct challenge is the one thing on this site that is *waiting on you*:
-- somebody has committed points and cannot get them back until you answer.
-- Until now the only place that said so was the match page, which you had to
-- already be on. The bell is where the site keeps everything else it owes you,
-- so it is where this belongs — and because the answer is two words, it is
-- answerable from inside the bell rather than only linkable from it.
--
-- `data` carries the duel id so the panel can offer that answer. Everything
-- else the panel needs it can read from the duel itself, which is the only
-- copy that can go stale.

alter table public.notifications add column if not exists data jsonb;

comment on column public.notifications.data is
  'Free-form payload for notifications that can be acted on. For duels:
   {"duel": uuid, "match": text}.';

-- ---------------------------------------------------------------------------
-- One place that writes both channels
-- ---------------------------------------------------------------------------
-- The bell and the bot say the same thing about the same event, so a caller
-- that had to remember both would eventually remember one. `p_kind` is the
-- bot's template name; the bell's own kind is passed separately because it
-- picks the icon and there are only four of those.

create or replace function public.duel_notify(
  p_user    uuid,
  p_kind    text,
  p_title   text,
  p_payload jsonb,
  p_data    jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, data)
  values (p_user, 'duel', p_title, p_data);

  -- Best effort. A queue that is not there yet, or a player who never started
  -- the bot, must not roll back the duel that triggered this.
  begin
    perform public.tg_enqueue(p_user, p_kind, p_payload, p_kind || ':' || coalesce(p_data ->> 'duel', p_user::text));
  exception when others then
    null;
  end;
end;
$$;

revoke execute on function public.duel_notify(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.duel_notify(uuid, text, text, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- The three moments worth telling somebody about
-- ---------------------------------------------------------------------------
-- Named challenge → the person named. Accepted or refused → the challenger.
-- An *open* challenge being taken is also worth saying, because the challenger
-- posted it and walked away. Cancelling your own is not: you just did it.

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

  if p_opponent is null and p_stake not in (50, 100, 250, 500) then
    return jsonb_build_object('ok', false, 'error', 'bad_tier');
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
    select coalesce(m.team_a_name, m.team_a) || ' — ' || coalesce(m.team_b_name, m.team_b),
           coalesce(m.time_label, ''),
           case when p_side = 'a' then coalesce(m.team_a_name, m.team_a)
                else coalesce(m.team_b_name, m.team_b) end
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

-- ---------------------------------------------------------------------------
-- Accepted
-- ---------------------------------------------------------------------------

create or replace function public.duel_accept(p_user uuid, p_duel uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d         record;
  v_status  text;
  v_balance integer;
  v_from    text;
  v_match   text;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into d from public.duels where id = p_duel for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if d.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;
  if d.challenger = p_user then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;
  if d.opponent is not null and d.opponent <> p_user then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;

  select m.status into v_status from public.matches m where m.id = d.match_id;
  if v_status is distinct from 'upcoming' then
    return jsonb_build_object('ok', false, 'error', 'started');
  end if;

  if exists (
    select 1 from public.duels x
     where x.match_id = d.match_id
       and x.id <> d.id
       and x.status in ('open', 'matched')
       and (x.challenger = p_user or x.opponent = p_user)
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_in');
  end if;

  select event_points into v_balance
    from public.profiles where id = p_user for update;
  if v_balance is null or v_balance < d.stake then
    return jsonb_build_object('ok', false, 'error', 'insufficient');
  end if;

  update public.duels
     set opponent = p_user, status = 'matched', matched_at = now()
   where id = p_duel;

  update public.profiles
     set event_points = event_points - d.stake
   where id = p_user;

  -- The challenger posted this and left. They should not have to come back and
  -- check whether anybody bit.
  select handle into v_from from public.profiles where id = p_user;
  select coalesce(m.team_a_name, m.team_a) || ' — ' || coalesce(m.team_b_name, m.team_b)
    into v_match
    from public.matches m where m.id = d.match_id;

  perform public.duel_notify(
    d.challenger,
    'duel_accepted',
    coalesce(v_from, 'Суперник') || ' прийняв твій виклик · ' || d.stake,
    jsonb_build_object('from', coalesce(v_from, 'Суперник'), 'match', v_match,
                       'stake', d.stake),
    jsonb_build_object('duel', p_duel, 'match', d.match_id)
  );

  return jsonb_build_object('ok', true, 'balance', v_balance - d.stake);
end;
$$;

revoke execute on function public.duel_accept(uuid, uuid) from public, anon;
grant execute on function public.duel_accept(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Refused
-- ---------------------------------------------------------------------------
-- Same body as 0061, with the bell added alongside the bot. Cancelling your own
-- still says nothing: you are the one who pressed it.

create or replace function public.duel_withdraw(p_user uuid, p_duel uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d       record;
  v_by    text;
  v_from  text;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into d from public.duels where id = p_duel for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if d.status = 'matched' then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;
  if d.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;
  if d.challenger <> p_user and d.opponent is distinct from p_user then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;

  v_by := case when d.challenger = p_user then 'cancelled' else 'declined' end;

  update public.duels set status = v_by, settled_at = now() where id = p_duel;

  update public.profiles
     set event_points = event_points + d.stake
   where id = d.challenger;

  if v_by = 'declined' then
    select handle into v_from from public.profiles where id = p_user;
    perform public.duel_notify(
      d.challenger,
      'duel_declined',
      coalesce(v_from, 'Суперник') || ' відхилив твій виклик · ' || d.stake || ' повернуто',
      jsonb_build_object('from', coalesce(v_from, 'Суперник'), 'stake', d.stake),
      jsonb_build_object('duel', p_duel, 'match', d.match_id)
    );
  end if;

  return jsonb_build_object('ok', true, 'refunded', d.stake, 'outcome', v_by);
end;
$$;

revoke execute on function public.duel_withdraw(uuid, uuid) from public, anon;
grant execute on function public.duel_withdraw(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reading them
-- ---------------------------------------------------------------------------
-- The existing select policy already limits a player to their own rows, so the
-- new column needs no policy of its own. Nothing writes notifications from the
-- client and nothing here changes that.
