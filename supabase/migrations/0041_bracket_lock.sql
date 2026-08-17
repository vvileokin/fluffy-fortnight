-- CS2 UA — close the playoff bracket by hand, and let players edit until then.
-- Run in Supabase → SQL Editor. Requires 0038.
--
-- Two changes, and they belong together.
--
-- 1. A switch an admin can throw. The bracket already shuts itself when the
--    first playoff fixture goes live, which is the right *backstop* but the
--    wrong only-option: the schedule moves, an admin may want picks closed
--    early, and "wait for a match to start" is not something you can undo if it
--    turns out the draw was wrong.
--
-- 2. Entries become editable up to that moment. Insert-only made every bracket
--    final the instant it was submitted, which punished filling it in early —
--    exactly the behaviour the feature wants to encourage. There is no
--    integrity argument for one-shot here: nothing is paid out until the
--    playoff is over, so a change before the deadline costs nobody anything.

alter table public.site_settings
  add column if not exists bracket_closed boolean not null default false;

-- Scoring must never move under a bracket that has already been paid. Editing
-- is a pre-deadline convenience, not a way to rewrite a settled result.
drop policy if exists "bracket update own" on public.bracket_predictions;
create policy "bracket update own"
  on public.bracket_predictions for update
  using (auth.uid() = user_id and scored_at is null)
  with check (auth.uid() = user_id and scored_at is null);
