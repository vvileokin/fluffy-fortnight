-- Hero artwork for the home page.
--
-- The hero was a fixed lit slab in code; editors need to be able to dress it
-- for whatever event is running without a deploy. Nullable on purpose: with no
-- image set the Hero falls back to its built-in treatment, so an empty column
-- is a valid, good-looking state rather than a broken one.
alter table public.site_settings
  add column if not exists hero_image text;
