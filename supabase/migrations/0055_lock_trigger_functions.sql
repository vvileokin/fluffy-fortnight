-- CS2 UA — take EXECUTE off the trigger functions.
-- Run in Supabase → SQL Editor. Changes no behaviour.
--
-- Supabase's linter flags every SECURITY DEFINER function that `public` or
-- `authenticated` may execute. Most of the list is trigger functions, which is
-- noise: Postgres checks EXECUTE on a trigger function when the trigger is
-- *created*, never when it fires, and calling one directly fails with "trigger
-- functions can only be called as triggers" before a line of the body runs.
--
-- They are still worth revoking. A privilege nobody needs is a privilege that
-- only matters the day one of these stops being a trigger function, and the
-- quiet linter is worth having so a real finding is visible when it appears.
--
-- What is deliberately left alone:
--
--   question_odds      readable by anyone on purpose. It returns how many
--                      people picked each option — the number printed on the
--                      button — and no identities. It is SECURITY DEFINER
--                      precisely because RLS hides other players' rows, so
--                      counting them is the one thing it must bypass.
--   place_bet          }  all three take a user id and all three refuse when
--   cancel_bet         }  `auth.uid()` is set and is not that user, so a
--   convert_points     }  signed-in caller cannot act as anyone else.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.trim_notifications() from public, anon, authenticated;
revoke execute on function public.freeze_profile_admin_flag() from public, anon, authenticated;
revoke execute on function public.sync_giveaway_entrants() from public, anon, authenticated;
revoke execute on function public.guard_prediction_window() from public, anon, authenticated;
revoke execute on function public.guard_bounty_window() from public, anon, authenticated;
-- prediction_odds() was dropped again in 0057. Guarded so this file still runs
-- top to bottom on a database that never had it.
do $$
begin
  execute 'revoke execute on function public.prediction_odds() from public, anon, authenticated';
exception when undefined_function then
  null;
end
$$;
