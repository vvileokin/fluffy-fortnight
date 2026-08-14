-- CS2 UA — paid giveaway tickets + Telegram account linking.
-- Run in Supabase → SQL Editor.
--
-- Two things arrive together because the first needs the second.
--
-- A giveaway can now cost points to enter, several tickets per player. Until
-- now entering was free and a single row per person, written straight from the
-- browser through an RLS policy. Charging for it that way is impossible: the
-- balance columns are revoked from `authenticated` (0021, 0033), and even if
-- they weren't, two clicks landing together would both pass a read-then-write
-- balance check and buy two tickets for the price of one. So a paid entry now
-- goes through one atomic function that only the service role may call.
--
-- And a giveaway can require a linked Telegram account, which needs somewhere
-- to record that link. `profiles.telegram_id` is that record — a player who
-- signed up by email can now prove which Telegram is theirs, and signing in
-- with Telegram lands in the account they already have rather than a second one.

-- ---------------------------------------------------------------------------
-- 1. Telegram identity on the profile
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists telegram_id text;

-- Partial unique: one Telegram account backs exactly one profile, but the
-- column stays null for everyone who signed up with email or Google.
create unique index if not exists profiles_telegram_id_key
  on public.profiles (telegram_id)
  where telegram_id is not null;

-- Backfill the accounts the Telegram login route already created — it has
-- always stashed the id in user metadata. `distinct on` keeps the oldest
-- account per Telegram id so a legacy duplicate can't fail the unique index
-- and take the whole migration down with it.
with claim as (
  select distinct on (u.raw_user_meta_data ->> 'telegram_id')
         u.id                                    as user_id,
         u.raw_user_meta_data ->> 'telegram_id'  as tg
    from auth.users u
   where u.raw_user_meta_data ->> 'telegram_id' is not null
   order by u.raw_user_meta_data ->> 'telegram_id', u.created_at
)
update public.profiles p
   set telegram_id = c.tg
  from claim c
 where c.user_id = p.id
   and p.telegram_id is null;

-- ---------------------------------------------------------------------------
-- 2. Freeze the columns a player must never write
-- ---------------------------------------------------------------------------
-- 0021 froze the scoring columns but predates `ewc_points` (0033) and
-- `telegram_id` (here). The Telegram one is the sharp edge: it is the proof
-- that a Telegram account belongs to this player, so leaving it self-writable
-- would let anyone claim someone else's Telegram and enter a gated giveaway
-- as them. `points` is frozen for the same reason it always was — note this
-- means a paid entry cannot deduct from a user-authenticated session, which
-- is exactly why `buy_giveaway_ticket` below refuses to run in one.

create or replace function public.freeze_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nobody flips the legacy admin flag; admin_users is the source of truth.
  new.is_admin := old.is_admin;

  -- auth.uid() is null when the service role writes (resolve routes, the
  -- giveaway purchase), and set when a signed-in user edits their own row.
  -- Users may change their handle and avatar; everything else is ours.
  if auth.uid() is not null then
    new.points        := old.points;
    new.bounty_points := old.bounty_points;
    new.correct       := old.correct;
    new.streak        := old.streak;
    new.ewc_points    := old.ewc_points;
    new.ewc_correct   := old.ewc_correct;
    new.telegram_id   := old.telegram_id;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_freeze_admin on public.profiles;
create trigger profiles_freeze_admin
  before update on public.profiles
  for each row execute function public.freeze_profile_admin_flag();

-- ---------------------------------------------------------------------------
-- 3. Giveaways gain a price, a ticket cap, and a Telegram gate
-- ---------------------------------------------------------------------------
-- `min_points` stays what it always was — a threshold you must reach. These
-- are different: `entry_cost` is money that leaves your balance.

-- `skin` belongs to migration 0034, repeated here because the seed at the
-- bottom writes it and this file has to run on a database where 0034 never
-- did. Both statements are idempotent, so running 0034 before or after this
-- changes nothing.
alter table public.giveaways
  add column if not exists skin text;

alter table public.giveaways
  drop constraint if exists giveaways_skin_check;
alter table public.giveaways
  add constraint giveaways_skin_check
  check (skin is null or skin in ('blast', 'ewc'));

alter table public.giveaways
  add column if not exists entry_cost       integer not null default 0,
  add column if not exists entry_currency   text    not null default 'points',
  add column if not exists max_tickets      integer not null default 1,
  add column if not exists require_telegram boolean not null default false;

alter table public.giveaways
  drop constraint if exists giveaways_entry_currency_check;
alter table public.giveaways
  add constraint giveaways_entry_currency_check
  check (entry_currency in ('points', 'ewc'));

-- One row per player still, with the ticket count on it. Keeping the unique
-- constraint means the entrants trigger from 0032 keeps counting *people*,
-- which is the number the card should show — not tickets sold.
alter table public.giveaway_entries
  add column if not exists tickets integer not null default 1,
  add column if not exists spent   integer not null default 0;

-- ---------------------------------------------------------------------------
-- 4. Direct client writes are for free giveaways only
-- ---------------------------------------------------------------------------

drop policy if exists "users insert own entries" on public.giveaway_entries;
create policy "users insert own entries"
  on public.giveaway_entries for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
        from public.giveaways g
        join public.profiles p on p.id = auth.uid()
       where g.slug = giveaway_slug
         and g.status <> 'finished'
         and g.drawn_at is null
         and p.points >= g.min_points
         -- A paid or Telegram-gated giveaway is entered through
         -- /api/giveaways/enter, which charges the balance and checks the
         -- channel subscription. Allowing the insert here would be a free
         -- ticket that skips both.
         and g.entry_cost = 0
         and g.require_telegram = false
    )
  );

-- Withdrawing a free entry is fine. Withdrawing a paid one would need a
-- refund path, and the points are deliberately spent, so it isn't offered.
drop policy if exists "users delete own entries" on public.giveaway_entries;
create policy "users delete own entries"
  on public.giveaway_entries for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.giveaways g
       where g.slug = giveaway_slug
         and g.drawn_at is null
         and g.entry_cost = 0
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Buying a ticket, atomically
-- ---------------------------------------------------------------------------

create or replace function public.buy_giveaway_ticket(
  p_user uuid,
  p_slug text,
  p_qty  integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g         public.giveaways%rowtype;
  balance   integer;
  have      integer;
  cost      integer;
begin
  -- This must only ever run on the service role, from the enter route. Called
  -- inside a user session the freeze trigger above would silently revert the
  -- deduction while the insert below still succeeded — a free ticket. Execute
  -- is revoked from `authenticated` too; this is the second lock on that door.
  if auth.uid() is not null then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_qty is null or p_qty < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into g from public.giveaways where slug = p_slug;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if g.drawn_at is not null or g.status = 'finished' then
    return jsonb_build_object('ok', false, 'error', 'drawn');
  end if;
  if g.end_iso is not null and g.end_iso <= now() then
    return jsonb_build_object('ok', false, 'error', 'ended');
  end if;

  -- The lock, and the whole reason this is one function rather than a few
  -- statements in the route: everything below reads a balance and then writes
  -- it, so two requests arriving together must be serialised here or they both
  -- pass the check and both deduct.
  select case when g.entry_currency = 'ewc' then ewc_points else points end
    into balance
    from public.profiles
   where id = p_user
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_profile');
  end if;

  select tickets into have
    from public.giveaway_entries
   where giveaway_slug = p_slug and user_id = p_user;
  have := coalesce(have, 0);

  if have + p_qty > greatest(g.max_tickets, 1) then
    return jsonb_build_object(
      'ok',         false,
      'error',      'max_tickets',
      'tickets',    have,
      'maxTickets', greatest(g.max_tickets, 1)
    );
  end if;

  cost := g.entry_cost * p_qty;
  if balance < cost then
    return jsonb_build_object(
      'ok',      false,
      'error',   'insufficient',
      'balance', balance,
      'needed',  cost
    );
  end if;

  if cost > 0 then
    if g.entry_currency = 'ewc' then
      update public.profiles set ewc_points = ewc_points - cost where id = p_user;
    else
      update public.profiles set points = points - cost where id = p_user;
    end if;
  end if;

  insert into public.giveaway_entries (giveaway_slug, user_id, tickets, spent, confirmed)
  values (p_slug, p_user, p_qty, cost, true)
  on conflict (giveaway_slug, user_id) do update
     set tickets = public.giveaway_entries.tickets + excluded.tickets,
         spent   = public.giveaway_entries.spent   + excluded.spent;

  return jsonb_build_object(
    'ok',      true,
    'tickets', have + p_qty,
    'spent',   cost,
    'balance', balance - cost
  );
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, so the revoke is
-- what actually closes the door — without it a player could call this straight
-- from the browser and skip the subscription check the route does. The grant
-- back to `service_role` is not optional: revoking PUBLIC takes the permission
-- away from service_role too, and the enter route would get "permission denied
-- for function" on its first call.
revoke execute on function public.buy_giveaway_ticket(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.buy_giveaway_ticket(uuid, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. The EWC giveaway
-- ---------------------------------------------------------------------------

insert into public.giveaways (
  slug, prize, sponsor, value_usd, end_label, end_iso, min_points, status,
  cover, skin, description, conditions,
  winners_count, entry_cost, entry_currency, max_tickets, require_telegram
)
values (
  'ewc-ak-ice-coal',
  '7х AK | Крижане вугілля',
  'CS2UA',
  0,
  'до 24 серпня',
  '2026-08-24T21:00:00Z',
  0,
  'open',
  'oklch(0.68 0.19 45)',
  'ewc',
  -- Deliberately one sentence: the price, the ticket cap and the one-skin rule
  -- are all in `conditions` directly below it, so spelling them out here was a
  -- paragraph of duplication that ate a phone screen.
  'Сім AK-47 | Крижане вугілля розігруємо серед тих, хто грає прогнози на Esports World Cup 2026. Умови — нижче.',
  '["Підписка на Telegram-канал CS2UA","100 EWC поінтів за квиток","До 5 квитків на людину","Один переможець — один скін"]'::jsonb,
  7,
  100,
  'ewc',
  5,
  true
)
on conflict (slug) do update
   set prize            = excluded.prize,
       sponsor          = excluded.sponsor,
       end_label        = excluded.end_label,
       end_iso          = excluded.end_iso,
       skin             = excluded.skin,
       description      = excluded.description,
       conditions       = excluded.conditions,
       winners_count    = excluded.winners_count,
       entry_cost       = excluded.entry_cost,
       entry_currency   = excluded.entry_currency,
       max_tickets      = excluded.max_tickets,
       require_telegram = excluded.require_telegram,
       updated_at       = now();
