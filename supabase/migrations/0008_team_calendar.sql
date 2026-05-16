-- countme-crm: team calendar + event kind (idempotent)
-- Adds:
--   1. `team_config` singleton row holding the shared (countme5555@gmail.com) Google
--      Calendar refresh token. Only admin can update.
--   2. `events.kind` ('personal' | 'team') and `events.local_etag` for sync conflict
--      detection (last-write-wins via If-Match / 412).

set search_path = public;

-- ============================================================
-- TEAM_CONFIG (singleton)
-- ============================================================

create table if not exists team_config (
  id int primary key default 1,
  shared_calendar_email text,
  shared_calendar_refresh_token text,
  shared_calendar_access_token text,
  shared_calendar_token_expires_at timestamptz,
  shared_calendar_sync_token text,
  updated_at timestamptz not null default now(),
  constraint team_config_singleton check (id = 1)
);

insert into team_config (id) values (1) on conflict (id) do nothing;

alter table team_config enable row level security;

drop policy if exists team_config_read_auth on team_config;
create policy team_config_read_auth on team_config
  for select to authenticated using (true);

drop policy if exists team_config_update_admin on team_config;
create policy team_config_update_admin on team_config
  for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- updated_at trigger
drop trigger if exists team_config_set_updated_at on team_config;
create trigger team_config_set_updated_at
  before update on team_config
  for each row execute function public.set_updated_at();

-- ============================================================
-- EVENTS: add kind + local_etag
-- ============================================================

alter table events add column if not exists kind text not null default 'personal';
alter table events add column if not exists local_etag text;

do $$ begin
  alter table events add constraint events_kind_check check (kind in ('personal','team'));
exception when duplicate_object then null; end $$;

create index if not exists idx_events_kind on events(kind);
