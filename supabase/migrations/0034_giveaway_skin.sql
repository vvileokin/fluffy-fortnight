-- CS2 UA — let a giveaway wear an event's skin.
-- A giveaway run for the Esports World Cup was rendering in the season's
-- yellow, so it read as unrelated to the event it belongs to. Rather than
-- hardcoding "if slug looks like EWC", the style becomes a field the admin
-- picks — the same `skin` vocabulary tournaments already use, so adding a
-- future event means adding one option, not another branch.
-- Null (the default) keeps the standard card. Run in Supabase → SQL Editor.

alter table public.giveaways
  add column if not exists skin text;

alter table public.giveaways
  drop constraint if exists giveaways_skin_check;

alter table public.giveaways
  add constraint giveaways_skin_check
  check (skin is null or skin in ('blast', 'ewc'));
