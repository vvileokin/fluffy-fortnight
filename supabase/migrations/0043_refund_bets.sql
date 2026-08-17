-- CS2 UA — give the stake back when a question goes away.
-- Run in Supabase → SQL Editor. Requires 0040 (bets).
--
-- `bets.question_id` cascades on delete, so removing a question destroyed every
-- slip placed on it. The stake had already left the player's balance at
-- placement and there was nothing left to pay it back from — the points simply
-- stopped existing, silently, with no row to show they ever had.
--
-- That is exactly what happened while the betting questions were being tested:
-- five questions created and deleted in one afternoon, and everyone who had
-- staked on them was quietly poorer.
--
-- The cascade itself is right — an orphaned slip pointing at a question nobody
-- can read is worse than none. What was missing is the refund that has to
-- happen first. This function is called before the delete, and is safe to call
-- on a question with no bets, or twice.

create or replace function public.refund_bets(p_question text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  refunded integer;
begin
  if auth.uid() is not null then
    return 0;
  end if;

  -- Only unsettled slips. A settled bet has already been paid out or lost on
  -- its merits; handing the stake back on top of that would be inventing money.
  with taken as (
    delete from public.bets b
     where b.question_id = p_question
       and b.settled_at is null
    returning b.user_id, b.stake
  ), given as (
    update public.profiles p
       set ewc_points = p.ewc_points + taken.stake
      from taken
     where p.id = taken.user_id
    returning 1
  )
  select count(*) into refunded from given;

  return refunded;
end;
$$;

revoke execute on function public.refund_bets(text) from public, anon, authenticated;
grant execute on function public.refund_bets(text) to service_role;
