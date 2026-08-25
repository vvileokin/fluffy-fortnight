-- CS2 UA — take floating odds back out.
-- Run in Supabase → SQL Editor. Requires 0054 to have been applied.
--
-- Reverted before it priced anything: no prediction ever carried a multiplier,
-- so dropping the column loses nothing. Rewards go back to the flat figure the
-- question names for each option, which is what every question in the database
-- was already written against.
--
-- Safe in either order with the deploy. The resolve route stops reading `odds`
-- in the same change; if this runs first it simply pays the flat reward, and if
-- the deploy lands first the column is still there and still NULL, which the
-- route already treated as one.

drop trigger if exists predictions_odds on public.predictions;
drop function if exists public.prediction_odds();
drop function if exists public.question_odds(text);

alter table public.predictions drop column if exists odds;
