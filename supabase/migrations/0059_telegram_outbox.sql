-- CS2 UA — an outbox for Telegram, and the switches that govern it.
-- Run in Supabase → SQL Editor.
--
-- Sending is queued rather than done inline. Resolving one popular question
-- touches a couple of hundred players, and Telegram is one HTTP call each — a
-- route that sends them itself holds the admin's request open for minutes and
-- fails the whole settlement if the API hiccups halfway. The settlement writes
-- rows; a drain sends them.
--
-- `dedupe_key` is what makes a re-run safe. Re-saving a finished match or
-- re-resolving a question is normal and expected here; sending the same person
-- the same sentence twice is not.

alter table public.profiles
  -- Three switches rather than a preference per message type. Nobody reads a
  -- settings page with twenty rows, and the categories people actually feel
  -- differently about are: somebody addressed me, my own money moved, and the
  -- daily wrap.
  add column if not exists tg_personal boolean not null default true,
  add column if not exists tg_activity boolean not null default true,
  add column if not exists tg_digest   boolean not null default true;

create table if not exists public.tg_outbox (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  -- One fact, one message. Two rows with the same key are the same event
  -- arriving twice.
  dedupe_key  text not null unique,
  -- Held back until this moment: quiet hours, and digests that wait for the
  -- day to finish.
  send_after  timestamptz not null default now(),
  attempts    integer not null default 0,
  sent_at     timestamptz,
  failed_at   timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists tg_outbox_pending_idx
  on public.tg_outbox (send_after)
  where sent_at is null and failed_at is null;

alter table public.tg_outbox enable row level security;
-- Nobody reads or writes this from a browser. It is filled by functions and
-- drained by the service role.

-- ---------------------------------------------------------------------------
-- Enqueue
-- ---------------------------------------------------------------------------
-- Silently skips anyone who has that category switched off, has no Telegram
-- linked, or has already been sent this exact fact. The caller does not have to
-- know any of that — it just says what happened.

create or replace function public.tg_enqueue(
  p_user       uuid,
  p_kind       text,
  p_payload    jsonb,
  p_dedupe     text,
  p_send_after timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tg      text;
  v_allowed boolean;
begin
  if auth.uid() is not null then
    return false;
  end if;

  select telegram_id,
         case
           when p_kind like 'duel_%' or p_kind like 'relay_%'
             or p_kind in ('giveaway_won', 'bet_refund') then tg_personal
           when p_kind in ('daily_digest') then tg_digest
           else tg_activity
         end
    into v_tg, v_allowed
    from public.profiles where id = p_user;

  if v_tg is null or v_allowed is not true then
    return false;
  end if;

  insert into public.tg_outbox (user_id, kind, payload, dedupe_key, send_after)
  values (p_user, p_kind, coalesce(p_payload, '{}'::jsonb), p_dedupe, p_send_after)
  on conflict (dedupe_key) do nothing;

  return found;
end;
$$;

revoke execute on function public.tg_enqueue(uuid, text, jsonb, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.tg_enqueue(uuid, text, jsonb, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Claim a batch
-- ---------------------------------------------------------------------------
-- `for update skip locked` is what lets the drain run twice at once without
-- two workers picking up the same row — which on a notification queue means
-- the same person hearing the same thing twice.

create or replace function public.tg_claim(p_limit integer default 25)
returns setof public.tg_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    return;
  end if;

  return query
  with picked as (
    select id from public.tg_outbox
     where sent_at is null
       and failed_at is null
       and send_after <= now()
       and attempts < 3
     order by send_after
     limit p_limit
     for update skip locked
  )
  update public.tg_outbox o
     set attempts = o.attempts + 1
    from picked p
   where o.id = p.id
  returning o.*;
end;
$$;

revoke execute on function public.tg_claim(integer) from public, anon, authenticated;
grant execute on function public.tg_claim(integer) to service_role;
