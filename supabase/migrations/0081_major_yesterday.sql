-- ---------------------------------------------------------------------------
-- Yesterday's projection, so the table can say what moved
-- ---------------------------------------------------------------------------
-- A percentage on its own says where a team stands; it cannot say whether that
-- is good news. B8 at 71% reads the same whether they climbed nine points
-- overnight or slid four, and those are opposite stories about the same number.
--
-- The comparison is kept beside the projection rather than in a history table
-- because only one comparison is ever drawn — the day before — and a whole
-- table of snapshots to answer one question is a table nobody would prune.
-- `prev` is the full previous set as pushed; `prev_at` is when it was taken.
--
-- The roll is deliberate: the publisher only moves `prev` forward when what is
-- stored there is already a day old. Pushing three times in an evening must not
-- collapse the window to the last twenty minutes and make every team look
-- static.
-- ---------------------------------------------------------------------------

alter table public.major_meta
  add column if not exists prev jsonb,
  add column if not exists prev_at timestamptz;

comment on column public.major_meta.prev is
  'Попередній опублікований зріз: [{region, team, p_qual}]. Проти нього рахується денний рух у таблиці.';
comment on column public.major_meta.prev_at is
  'Коли знято prev. Публікатор оновлює prev лише якщо цей момент старший за добу.';
