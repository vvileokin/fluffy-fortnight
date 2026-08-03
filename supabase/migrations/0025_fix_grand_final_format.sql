-- CS2 UA — data fix: the BLAST Bounty S2 grand final was a BO5, stored as BO3.
--
-- The series score is derived from the map scores, and playedMaps() stops
-- counting once someone reaches the maps needed to win. With format BO3 that's
-- 2, so MOUZ taking Dust2 and Mirage "clinched" the series and the two maps
-- that followed (Ancient, Nuke) were marked skipped and dropped. The match
-- therefore read MOUZ 2–0 instead of the real MOUZ 3–1.
--
-- Only the format is wrong; score_a/score_b in the row are ignored whenever any
-- map is finished, so setting BO5 makes it read 3–1 with all four maps on its own.
-- Run in Supabase → SQL Editor.

update public.matches
set format = 'BO5', updated_at = now()
where id = 'mouz-vs-spirit' and format <> 'BO5';

-- Check:
--   select id, stage, format, jsonb_array_length(maps) as maps
--   from public.matches where id = 'mouz-vs-spirit';
