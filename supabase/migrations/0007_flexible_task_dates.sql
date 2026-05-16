-- countme-crm: flexible task dates (idempotent)
-- Replaces the fixed `due_date` + `due_date_uncertain` columns with a range+label model
-- so Hebrew NL parses (e.g. "מרץ", "Q2 2026", "סוף החודש") map cleanly:
--   - Specific date: due_start = due_end, label = null
--   - Range:          due_start < due_end, label = "Q2 2026"
--   - Whole month:    due_start = first of month, due_end = last of month, label = "מרץ 2026"
--   - Fuzzy point:    due_start = due_end, label = "סוף החודש"
--
-- The migration backfills before dropping legacy columns, so it's safe to re-run.

set search_path = public;

alter table tasks add column if not exists due_start date;
alter table tasks add column if not exists due_end date;
alter table tasks add column if not exists due_label text;

-- Backfill from legacy columns if they still exist
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_date'
  ) then
    update tasks
      set due_start = due_date, due_end = due_date
      where due_start is null and due_date is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_date_uncertain'
  ) then
    update tasks
      set due_label = case when due_date_uncertain then 'משוער' else null end
      where due_label is null;
  end if;
end $$;

alter table tasks drop column if exists due_date;
alter table tasks drop column if exists due_date_uncertain;

create index if not exists idx_tasks_due_start on tasks(due_start);
create index if not exists idx_tasks_due_end on tasks(due_end);
