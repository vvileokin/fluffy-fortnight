-- CS2 UA — сезонні дзеркалять гаманець Porto, поки турнір іде.
-- Run in Supabase → SQL Editor. Requires 0060, 0070, 0071, 0073.
--
-- The rule, finally settled:
--
--   * touch the starting 500 and everything you make at Porto shows up in both
--     places at once — the red wallet and the yellow season total;
--   * lose it and it comes off both, the same amount, at the same moment;
--   * never touch it and neither number moves, and the stake expires when the
--     tournament does.
--
-- So the season column carries a live copy of the wallet rather than a promise
-- to pay later. A player betting 300 watches both numbers fall by 300 and both
-- rise together when the slip lands. Nothing is banked that a later loss cannot
-- take back, and nothing waits until December to appear.
--
-- Kept as an invariant rather than a set of edits:
--
--     points = (everything earned outside the event) + event_points
--
-- One BEFORE trigger holds it. It is named to sort *after*
-- `profiles_freeze_admin`, which restores `points` from the old row whenever a
-- signed-in user updates their own profile — and `place_bet` runs as the
-- player, so a mirror that fired first would be wiped out by the freeze every
-- single time.
--
-- Closing the event needs no conversion any more: the money is already in the
-- season column. `settle_event_to_season` just clears the wallet, and because
-- it clears `event_joined_at` in the same statement the mirror sees a row that
-- is no longer in the event and leaves the season total alone.
--
-- One thing to watch before the next giveaway opens. Season gold is now partly
-- a live reflection of money still at risk, so anything that *spends* it can be
-- paid for with points a later loss will take away — buy tickets on Monday,
-- lose the wallet on Tuesday, and the deduction hits a total the tickets have
-- already left. The clamp below keeps the column off zero but does not undo the
-- purchase. It costs nothing today: the only giveaway on record is finished and
-- charged `ewc_points`, not the season column. A giveaway priced in season gold
-- while an event is running should charge `points - event_points` instead.

-- ---------------------------------------------------------------------------
-- The mirror
-- ---------------------------------------------------------------------------

create or replace function public.mirror_event_into_season()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare delta integer := 0;
begin
  -- A row on its way out of the event — the close zeroes the wallet and the
  -- stamp together — keeps whatever the season column already holds.
  if new.event_joined_at is null then
    return new;
  end if;

  if old.event_joined_at is null then
    -- First real action. The whole wallet as it stands becomes visible in the
    -- season total; `place_bet` stamps and debits in one statement, so this is
    -- already net of the stake that just went out.
    delta := coalesce(new.event_points, 0);
  else
    delta := coalesce(new.event_points, 0) - coalesce(old.event_points, 0);
  end if;

  if delta <> 0 then
    new.points := greatest(coalesce(new.points, 0) + delta, 0);
  end if;
  return new;
end;
$$;

revoke execute on function public.mirror_event_into_season() from public, anon, authenticated;

drop trigger if exists profiles_mirror_event on public.profiles;
create trigger profiles_mirror_event
  before update of event_points, event_joined_at on public.profiles
  for each row execute function public.mirror_event_into_season();

-- ---------------------------------------------------------------------------
-- Bring the season column up to date, once
-- ---------------------------------------------------------------------------
-- Every player who has already turned up gets their current wallet added. This
-- updates `points` alone, so the trigger — which fires only when
-- `event_points` or `event_joined_at` are in the SET list — does not double it.
--
-- 208 accounts, 194 689 points. The 400 who never touched the stake get
-- nothing, which is the same answer they had before.

update public.profiles p
   set points = coalesce(p.points, 0) + greatest(coalesce(p.event_points, 0), 0)
 where p.event_joined_at is not null;

-- ---------------------------------------------------------------------------
-- Closing the event
-- ---------------------------------------------------------------------------

create or replace function public.settle_event_to_season(p_grant integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare touched integer;
begin
  if auth.uid() is not null then return 0; end if;

  -- Nothing to convert: the season column has mirrored the wallet all along.
  -- Clearing the stamp in the same statement is what tells the mirror to leave
  -- the season total where it is instead of subtracting the wallet away again.
  with closed as (
    update public.profiles p
       set event_points = 0,
           event_joined_at = null
     where p.event_joined_at is not null
    returning 1
  )
  select count(*) into touched from closed;

  -- Never played: the stake expires, and it was never mirrored anywhere.
  update public.profiles set event_points = 0
   where event_joined_at is null and event_points <> 0;

  return touched;
end;
$$;

revoke execute on function public.settle_event_to_season(integer)
  from public, anon, authenticated;
grant execute on function public.settle_event_to_season(integer) to service_role;
