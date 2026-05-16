-- countme-crm: initial schema
-- Internal team CRM with chat, people tracking, Gantt, documents, calendar.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/fsbgxtmxvhxmmtcflmug/sql/new

set search_path = public;

-- ============================================================
-- ENUMS
-- ============================================================

create type person_status as enum ('lead', 'active', 'inactive', 'partner');
create type task_status as enum ('todo', 'doing', 'done');
create type task_priority as enum ('low', 'med', 'high');
create type channel_type as enum ('channel', 'dm', 'person_thread');
create type event_response as enum ('pending', 'accepted', 'declined');
create type gantt_import_status as enum ('parsing', 'done', 'error');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

create table profiles (
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

-- Auto-create profile row on auth.users insert (Google OAuth first sign-in)
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

create table people (
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

create index idx_people_owner on people(owner_id);
create index idx_people_status on people(status);
create index idx_people_tags on people using gin(tags);

-- ============================================================
-- PROJECTS (Gantt parents)
-- ============================================================

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date date,
  end_date date,
  owner_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_owner on projects(owner_id);

-- ============================================================
-- TASKS
-- ============================================================

create table tasks (
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

create index idx_tasks_assignee on tasks(assignee_id);
create index idx_tasks_person on tasks(person_id);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_status on tasks(status);

-- ============================================================
-- DOCUMENTS
-- ============================================================

create table documents (
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

create index idx_documents_owner on documents(owner_id);
create index idx_documents_person on documents(person_id);
create index idx_documents_project on documents(project_id);

-- ============================================================
-- CHAT: channels / channel_members / messages
-- ============================================================

create table channels (
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

create unique index idx_channels_person_thread
  on channels(person_id) where type = 'person_thread';

create table channel_members (
  channel_id uuid not null references channels(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (channel_id, profile_id)
);

create index idx_channel_members_profile on channel_members(profile_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete restrict,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_messages_channel_created on messages(channel_id, created_at desc);
create index idx_messages_sender on messages(sender_id);

-- ============================================================
-- EVENTS (Calendar)
-- ============================================================

create table events (
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

create index idx_events_owner on events(owner_id);
create index idx_events_start on events(start_at);
create unique index idx_events_google_id on events(google_event_id)
  where google_event_id is not null;

create table event_attendees (
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  response event_response not null default 'pending',
  primary key (event_id, profile_id)
);

-- ============================================================
-- GANTT IMPORTS
-- ============================================================

create table gantt_imports (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  raw_json jsonb,
  status gantt_import_status not null default 'parsing',
  project_id uuid references projects(id) on delete set null,
  owner_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index idx_gantt_imports_owner on gantt_imports(owner_id);

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

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger people_set_updated_at
  before update on people
  for each row execute function set_updated_at();

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

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
