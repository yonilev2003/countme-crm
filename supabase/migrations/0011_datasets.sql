-- countme-crm: Datasets MVP (idempotent)
-- Adds:
--   1. `datasets` — metadata + detected column schema for uploaded XLSX/CSV
--      tables. Owner is the user who uploaded.
--   2. `dataset_rows` — one row per spreadsheet row, payload kept in JSONB so
--      we can support arbitrary columns without per-dataset DDL.
--   3. RLS: any authenticated user can read; only the owner can write/delete.
--   4. updated_at trigger reusing the shared `public.set_updated_at()`.

set search_path = public;

-- ============================================================
-- DATASETS
-- ============================================================

create table if not exists datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  source_filename text,
  columns_schema jsonb not null default '[]'::jsonb,
  row_count int not null default 0,
  owner_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_datasets_owner on datasets(owner_id);

create table if not exists dataset_rows (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references datasets(id) on delete cascade,
  row_index int not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_dataset_rows_dataset on dataset_rows(dataset_id, row_index);
create index if not exists idx_dataset_rows_data_gin on dataset_rows using gin (data);

-- ============================================================
-- RLS
-- ============================================================

alter table datasets enable row level security;
alter table dataset_rows enable row level security;

drop policy if exists datasets_read_auth on datasets;
create policy datasets_read_auth on datasets for select to authenticated using (true);
drop policy if exists datasets_insert_owner on datasets;
create policy datasets_insert_owner on datasets for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists datasets_update_owner on datasets;
create policy datasets_update_owner on datasets for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists datasets_delete_owner on datasets;
create policy datasets_delete_owner on datasets for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists dataset_rows_read_auth on dataset_rows;
create policy dataset_rows_read_auth on dataset_rows for select to authenticated using (true);
drop policy if exists dataset_rows_insert_owner on dataset_rows;
create policy dataset_rows_insert_owner on dataset_rows for insert to authenticated
  with check (exists (select 1 from datasets d where d.id = dataset_id and d.owner_id = auth.uid()));
drop policy if exists dataset_rows_delete_owner on dataset_rows;
create policy dataset_rows_delete_owner on dataset_rows for delete to authenticated
  using (exists (select 1 from datasets d where d.id = dataset_id and d.owner_id = auth.uid()));

-- ============================================================
-- TRIGGERS
-- ============================================================

drop trigger if exists datasets_set_updated_at on datasets;
create trigger datasets_set_updated_at before update on datasets
  for each row execute function set_updated_at();
