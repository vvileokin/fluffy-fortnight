-- CS2 UA — виграна дуель нараховує в сезонні, як і виграна ставка.
-- Run in Supabase → SQL Editor. Requires 0065, 0066, 0075.
--
-- 0075 put Porto on the World Cup rule — a win adds to the season column, a
-- loss never takes from it — and applied it to slips and to group calls. Duels
-- were left out, so winning one still moved nothing but the event wallet.
--
-- That was a deliberate line at the time, and 0065 wrote the reason down:
--
--     a transfer between two players is not a measure of reading the game.
--
-- It is a fair point and it is not the rule any more. Beating somebody
-- head-to-head on a match you both had to call is reading the game, and a
-- player who wins ten duels and never touches a slip has done something the
-- season board ought to know about. So the profit — one stake, not the whole
-- pot — reaches `points` the way a winning slip's does.
--
-- ---------------------------------------------------------------------------
-- Done with a trigger, on purpose
-- ---------------------------------------------------------------------------
-- The obvious way to write this is to redefine `duel_close_match` with one
-- extra column in one update. The obvious way is wrong: that function is a
-- hundred and fifty lines, it has been amended twice — 0065 for reading the
-- score instead of the status label, 0066 for counting maps by format after
-- eight duels paid out at half time — and reproducing it here to change a
-- single statement is how a settled rule gets quietly rewritten by a typo.
--
-- A duel becoming `settled` is the fact worth reacting to, and the row already
-- records it. So the credit hangs off the row, the settlement function is left
-- exactly as it is, and every future path that settles a duel gets the same
-- behaviour for free.
--
-- ---------------------------------------------------------------------------
-- The thing to keep an eye on
-- ---------------------------------------------------------------------------
-- A duel is zero-sum between two people. Under a ratchet the winner gains and
-- the loser is not charged, so two players trading duels back and forth both
-- come out ahead: the season column pays out gold that nobody lost. A slip
-- cannot do this — the odds are the house — but a duel can.
--
-- Nobody is doing it. Of fifty settled duels no pair has met more than twice,
-- so there is nothing to unwind, and 4 760 is the whole of what this rule has
-- ever been worth. It is written down because the mechanism is unbounded even
-- though the amount is not: if a pair starts trading, the guard to add is a cap
-- on how often the same two accounts can pay each other's season total — not a
-- change to the rule everyone has just been told.

create or replace function public.duel_season_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only the transition into `settled`, and only once: a row that is already
  -- settled and gets touched again pays nothing more.
  if new.status = 'settled'
     and coalesce(old.status, '') is distinct from 'settled'
     and new.winner is not null
     and coalesce(new.stake, 0) > 0
  then
    update public.profiles
       set points            = points + new.stake,
           ewc_earned_points = ewc_earned_points + new.stake
     where id = new.winner;
  end if;
  return null;
end;
$$;

revoke execute on function public.duel_season_credit() from public, anon, authenticated;

drop trigger if exists duels_season_credit on public.duels;
create trigger duels_season_credit
  after update of status on public.duels
  for each row execute function public.duel_season_credit();

-- ---------------------------------------------------------------------------
-- What the duels already played are worth
-- ---------------------------------------------------------------------------
-- 4 760 to 33 players, one stake for each duel they won. Guarded by the same
-- mark table 0075 uses, so a second run pays nothing.

do $$
begin
  if exists (select 1 from public.migration_marks where id = '0076_duel_season') then
    raise notice '0076 вже застосовано — пропускаю нарахування';
    return;
  end if;

  with won as (
    select d.winner as user_id, sum(d.stake)::integer as gain
      from public.duels d
     where d.status = 'settled' and d.winner is not null and coalesce(d.stake, 0) > 0
     group by d.winner
  )
  update public.profiles p
     set points            = coalesce(p.points, 0) + won.gain,
         ewc_earned_points = coalesce(p.ewc_earned_points, 0) + won.gain
    from won
   where p.id = won.user_id;

  insert into public.migration_marks (id) values ('0076_duel_season');
end $$;
