-- CS2 UA — матч закінчився тоді, коли зіграно достатньо карт.
-- Run in Supabase → SQL Editor. Requires 0065.
--
-- 0065 taught the settlement to trust the score instead of a status column
-- nobody had flipped. That fixed twelve duels handed back on decided matches
-- and immediately broke the other end: `duel_close_match` runs on every save of
-- a match that is not upcoming, FURIA — paiN was saved at 1:0 while live, and
-- an unequal score was read as a result. Eight duels paid out at half time.
--
-- A leader is not a winner. The format says how many maps it takes — three for
-- a BO5, two for a BO3, one for a BO1 — and until somebody has them the
-- function does nothing, which is the same abstention 0065 already made safe.
--
-- The eight were reversed by hand before this ran: the pot taken back out of
-- each winner's balance, the rows returned to `matched`, and the sixteen
-- notifications they had already written deleted.

create or replace function public.duel_close_match(p_match text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  d          record;
  v_sa       integer;
  v_sb       integer;
  v_status   text;
  v_format   text;
  v_need     integer;
  v_label    text;
  v_win      text;
  v_decided  boolean;
  v_off      boolean;
  v_winner   uuid;
  v_loser    uuid;
  v_wname    text;
  v_lname    text;
  v_rec      record;
  v_settled  integer := 0;
  v_refund   integer := 0;
begin
  if auth.uid() is not null then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select m.score_a, m.score_b, m.status, m.format,
         coalesce(m.team_a_name, initcap(m.team_a)) || ' — ' ||
         coalesce(m.team_b_name, initcap(m.team_b))
    into v_sa, v_sb, v_status, v_format, v_label
    from public.matches m where m.id = p_match;
  if v_label is null then
    return jsonb_build_object('ok', false, 'error', 'no_match');
  end if;

  -- A result is a score that has stopped moving, which is not the same as a
  -- score with a leader. 1:0 in a BO3 is halfway through, and reading it as a
  -- win paid out eight duels on a match still being played. So the format says
  -- how many maps it takes, and nothing settles until somebody has them.
  v_need := case
              when v_format ilike '%5%' then 3
              when v_format ilike '%1%' and v_format not ilike '%3%' then 1
              else 2                                  -- BO3, and the safe default
            end;
  v_decided := v_sa is not null and v_sb is not null
               and v_sa <> v_sb
               and greatest(v_sa, v_sb) >= v_need;
  v_off     := v_status in ('cancelled', 'canceled', 'void');

  if not v_decided and not v_off then
    return jsonb_build_object('ok', true, 'settled', 0, 'refunded', 0,
                              'note', 'no result yet');
  end if;

  -- Never taken. Refunded once the fixture is closed out either way.
  for d in
    select * from public.duels
     where match_id = p_match and status = 'open' for update
  loop
    update public.duels set status = 'expired', settled_at = now() where id = d.id;
    update public.profiles
       set event_points = event_points + d.stake
     where id = d.challenger;
    perform public.duel_notify(
      d.challenger, 'duel_expired',
      'Твій виклик на ' || v_label || ' ніхто не взяв · ' || d.stake || ' повернуто',
      jsonb_build_object('match', v_label, 'stake', d.stake),
      jsonb_build_object('duel', d.id, 'match', p_match)
    );
    v_refund := v_refund + 1;
  end loop;

  -- Called off. Both stakes go home and nobody won anything.
  if v_off then
    for d in
      select * from public.duels
       where match_id = p_match and status = 'matched' for update
    loop
      update public.duels set status = 'void', settled_at = now() where id = d.id;
      update public.profiles set event_points = event_points + d.stake
       where id in (d.challenger, d.opponent);
      perform public.duel_notify(
        d.challenger, 'duel_void',
        v_label || ' не відбувся — дуель скасовано, ' || d.stake || ' повернуто',
        jsonb_build_object('match', v_label, 'stake', d.stake),
        jsonb_build_object('duel', d.id, 'match', p_match));
      perform public.duel_notify(
        d.opponent, 'duel_void',
        v_label || ' не відбувся — дуель скасовано, ' || d.stake || ' повернуто',
        jsonb_build_object('match', v_label, 'stake', d.stake),
        jsonb_build_object('duel', d.id, 'match', p_match));
      v_refund := v_refund + 1;
    end loop;
    return jsonb_build_object('ok', true, 'settled', 0, 'refunded', v_refund);
  end if;

  v_win := case when v_sa > v_sb then 'a' else 'b' end;

  for d in
    select * from public.duels
     where match_id = p_match and status = 'matched' for update
  loop
    v_winner := case when d.side = v_win then d.challenger else d.opponent end;
    v_loser  := case when d.side = v_win then d.opponent  else d.challenger end;

    update public.duels
       set status = 'settled', settled_at = now(), winner = v_winner
     where id = d.id;

    -- The whole pot, which is exactly the two stakes that left when the duel
    -- was made. Nothing is created here and nothing touches season gold: a
    -- transfer between two players is not a measure of reading the game.
    update public.profiles
       set event_points = event_points + (d.stake * 2)
     where id = v_winner;

    select handle into v_wname from public.profiles where id = v_winner;
    select handle into v_lname from public.profiles where id = v_loser;

    -- Read after the update, so the tally already counts this duel.
    select * into v_rec from public.duel_record(v_winner);
    perform public.duel_notify(
      v_winner, 'duel_won',
      'Ти виграв дуель проти ' || coalesce(v_lname, 'суперника') ||
        ' · +' || (d.stake * 2) || ' поінтів',
      jsonb_build_object('from', coalesce(v_lname, 'Суперник'), 'match', v_label,
                         'payout', d.stake * 2, 'profit', d.stake,
                         'record', v_rec.won || '–' || v_rec.lost),
      jsonb_build_object('duel', d.id, 'match', p_match));

    select * into v_rec from public.duel_record(v_loser);
    perform public.duel_notify(
      v_loser, 'duel_lost',
      'Дуель проти ' || coalesce(v_wname, 'суперника') ||
        ' програна · −' || d.stake,
      jsonb_build_object('from', coalesce(v_wname, 'Суперник'), 'match', v_label,
                         'stake', d.stake,
                         'record', v_rec.won || '–' || v_rec.lost),
      jsonb_build_object('duel', d.id, 'match', p_match));

    v_settled := v_settled + 1;
  end loop;

  return jsonb_build_object('ok', true, 'settled', v_settled, 'refunded', v_refund);
end;
$$;

revoke execute on function public.duel_close_match(text) from public, anon, authenticated;
grant execute on function public.duel_close_match(text) to service_role;
