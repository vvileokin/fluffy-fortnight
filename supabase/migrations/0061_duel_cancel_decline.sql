-- CS2 UA — taking a challenge back, and turning one down.
-- Run in Supabase → SQL Editor. Requires 0058 (duels) and 0059 (tg_outbox).
--
-- Both already refunded correctly; what they did not do is say which of the
-- three ways a challenge can end without being played actually happened:
--
--   cancelled  the challenger pulled it back    — nobody had taken it
--   declined   the named opponent said no       — the challenger gets told
--   expired    the match started and nobody came
--
-- All three were written as `expired`, so the bot could only ever send "ніхто
-- не взяв", which is a lie when a specific person read it and refused. The
-- refund is identical in every case — the challenger's stake goes back and no
-- other balance is touched, because on an untaken challenge no other balance
-- was ever touched.
--
-- The guarantee this preserves: a duel leaves 'open' by exactly one of accept,
-- cancel, decline, or expiry, and every route except accept refunds in the
-- same statement that changes the status, under the same row lock.

-- Dropped by what it *is* rather than by what it is probably called. The
-- original was written inline, so its name came from Postgres and guessing it
-- wrong would leave the old constraint in place — where the first cancel would
-- hit it and fail, long after this migration reported success.
do $$
declare c text;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'duels'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%matched%'
  loop
    execute format('alter table public.duels drop constraint %I', c);
  end loop;
end $$;

alter table public.duels
  add constraint duels_status_check
  check (status in ('open', 'matched', 'settled', 'expired', 'void', 'cancelled', 'declined'));

-- ---------------------------------------------------------------------------
-- Withdraw / decline
-- ---------------------------------------------------------------------------
-- One function for both because they are one transaction: the row is open, the
-- caller is one of the two people it concerns, the stake goes home. Who called
-- it decides only the name the row is left under and whether anybody is told.

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

  -- Locked before anything is read off it. Without this an accept landing in
  -- the same instant could match the duel *after* the status was checked and
  -- before the refund was written, paying the stake out twice.
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

  -- The challenger is the only person who staked anything on an open duel, so
  -- they are the only person there is to pay back.
  update public.profiles
     set event_points = event_points + d.stake
   where id = d.challenger;

  -- Only a refusal is worth a message. A challenger who pressed cancel already
  -- knows, and telling them would be the "you received 0" mistake again.
  if v_by = 'declined' then
    select handle into v_from from public.profiles where id = p_user;
    perform public.tg_enqueue(
      d.challenger,
      'duel_declined',
      jsonb_build_object('from', coalesce(v_from, 'Суперник'), 'stake', d.stake),
      'duel_declined:' || p_duel::text
    );
  end if;

  return jsonb_build_object('ok', true, 'refunded', d.stake, 'outcome', v_by);
end;
$$;

revoke execute on function public.duel_withdraw(uuid, uuid) from public, anon;
grant execute on function public.duel_withdraw(uuid, uuid) to authenticated, service_role;
