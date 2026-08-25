-- CS2 UA — an event balance that belongs to the event.
-- Run in Supabase → SQL Editor.
--
-- `ewc_points` was the Esports World Cup's currency and is now what is left of
-- it: 218 755 points across 166 accounts, still spendable on giveaway tickets
-- and nothing else. It is not Porto's balance, and showing it in the top bar
-- under Porto's gem would tell a player they arrive at a new event holding
-- 2 872 points they earned at the last one.
--
-- `event_points` is the balance of whatever event is currently running. It
-- starts at zero, it is reset when an event ends, and because everyone starts
-- level the number is a stake rather than a scoreboard — which is the whole
-- reason the chip is worth carrying in the chrome at all.

alter table public.profiles
  add column if not exists event_points integer not null default 0;

comment on column public.profiles.event_points is
  'Balance for the event currently running. Reset between events; never merged
   into points — season standing is earned against the book, not carried over.';
