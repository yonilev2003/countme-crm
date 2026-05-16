-- countme-crm: initial schema (idempotent)
-- Internal team CRM with chat, people tracking, Gantt, documents, calendar.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/fsbgxtmxvhxmmtcflmug/sql/new
-- If a prior partial run left objects behind, run 0000_reset.sql first.

set search_path = public;

-- ============================================================
-- ENUMS (idempotent via duplicate_object exception)
-- ============================================================

do $$ begin
  create type person_status as enum ('lead', 'active', 'inactive', 'partner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'doing', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'med', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type channel_type as enum ('channel', 'dm', 'person_thread');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_response as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gantt_import_status as enum ('parsing', 'done', 'error');
exception when duplicate_object then null; end $$;

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  google_refresh_token text,
  google_access_token text,
  google_token_expires_at timestamptz,
  google_calendar_sync_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PEOPLE (CRM contacts)
-- ============================================================

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  role text,
  status person_status not null default 'lead',
  tags text[] not null default '{}',
  notes text,
  owner_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_people_owner on people(owner_id);
create index if not exists idx_people_status on people(status);
create index if not exists idx_people_tags on people using gin(tags);

-- ============================================================
-- PROJECTS (Gantt parents)
-- ============================================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date,
  end_date date,
  owner_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_owner on projects(owner_id);

-- ============================================================
-- TASKS
-- ============================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date,
  due_date_uncertain boolean not null default false,
  status task_status not null default 'todo',
  priority task_priority not null default 'med',
  assignee_id uuid references profiles(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  owner_id uuid not null references profiles(id) on delete restrict,
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_assignee on tasks(assignee_id);
create index if not exists idx_tasks_person on tasks(person_id);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_status on tasks(status);

-- ============================================================
-- DOCUMENTS
-- ============================================================

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  mime_type text,
  size bigint,
  person_id uuid references people(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  owner_id uuid not null references profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_documents_owner on documents(owner_id);
create index if not exists idx_documents_person on documents(person_id);
create index if not exists idx_documents_project on documents(project_id);

-- ============================================================
-- CHAT: channels / channel_members / messages
-- ============================================================

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  type channel_type not null,
  person_id uuid references people(id) on delete cascade,
  is_private boolean not null default false,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint channels_person_thread_requires_person
    check (type <> 'person_thread' or person_id is not null),
  constraint channels_channel_requires_name
    check (type <> 'channel' or name is not null)
);

create unique index if not exists idx_channels_person_thread
  on channels(person_id) where type = 'person_thread';

create table if not exists channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (channel_id, profile_id)
);

create index if not exists idx_channel_members_profile on channel_members(profile_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete restrict,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_channel_created on messages(channel_id, created_at desc);
create index if not exists idx_messages_sender on messages(sender_id);

-- ============================================================
-- EVENTS (Calendar)
-- ============================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  person_id uuid references people(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  owner_id uuid not null references profiles(id) on delete restrict,
  google_event_id text,
  google_etag text,
  local_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_events_owner on events(owner_id);
create index if not exists idx_events_start on events(start_at);
create unique index if not exists idx_events_google_id on events(google_event_id)
  where google_event_id is not null;

create table if not exists event_attendees (
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  response event_response not null default 'pending',
  primary key (event_id, profile_id)
);

-- ============================================================
-- GANTT IMPORTS
-- ============================================================

create table if not exists gantt_imports (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  raw_json jsonb,
  status gantt_import_status not null default 'parsing',
  project_id uuid references projects(id) on delete set null,
  owner_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_gantt_imports_owner on gantt_imports(owner_id);

-- ============================================================
-- updated_at TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists people_set_updated_at on people;
create trigger people_set_updated_at
  before update on people
  for each row execute function set_updated_at();

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ============================================================
-- Helper: is_member_of_channel (security-definer, bypasses RLS recursion)
-- ============================================================

create or replace function public.is_member_of_channel(p_channel_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.channel_members
    where channel_id = p_channel_id
      and profile_id = auth.uid()
  );
$$;

revoke all on function public.is_member_of_channel(uuid) from public;
grant execute on function public.is_member_of_channel(uuid) to authenticated;
