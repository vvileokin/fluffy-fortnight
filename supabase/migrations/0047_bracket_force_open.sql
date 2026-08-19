-- CS2 UA — let an admin re-open the bracket after a playoff match has started.
-- Run in Supabase → SQL Editor. Requires 0041.
--
-- `started` — any playoff fixture no longer "upcoming" — was an unconditional
-- close that nothing could override. As a default that is right: nobody should
-- be filling in a bracket once a result is on the board. As the *only* rule it
-- is wrong, because it makes an ordinary mistake unrecoverable. A match set
-- live by accident, or set live early while the draw was still being checked,
-- shuts the bracket for the rest of the event and the admin panel's own
-- "Відкрити прогнози" button silently does nothing.
--
-- So the switch gets a third position. `bracket_closed` still shuts it; this
-- says "I know the playoff has begun, open it anyway", which is a decision an
-- admin is allowed to make and be accountable for.

alter table public.site_settings
  add column if not exists bracket_force_open boolean not null default false;
