-- countme-crm: destructive reset
-- Cleans up any partial state from prior migration attempts.
-- Run this FIRST if 0001 reports "type X already exists" or 0004 reports
-- "messages already member of publication".
--
-- WARNING: drops all CRM tables and types in the public schema. Auth users
-- in auth.users are untouched, but profile rows + all CRM data are deleted.

-- Remove from realtime publication (ignore if not present)
do $$ begin
  alter publication supabase_realtime drop table public.messages;
exception when undefined_object then null; when undefined_table then null;
end $$;

do $$ begin
  alter publication supabase_realtime drop table public.tasks;
exception when undefined_object then null; when undefined_table then null;
end $$;

do $$ begin
  alter publication supabase_realtime drop table public.channel_members;
exception when undefined_object then null; when undefined_table then null;
end $$;

-- Drop trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;

-- Drop CRM tables (reverse dependency order, cascade catches any FK)
drop table if exists public.event_attendees cascade;
drop table if exists public.events cascade;
drop table if exists public.messages cascade;
drop table if exists public.channel_members cascade;
drop table if exists public.channels cascade;
drop table if exists public.gantt_imports cascade;
drop table if exists public.documents cascade;
drop table if exists public.tasks cascade;
drop table if exists public.projects cascade;
drop table if exists public.people cascade;
drop table if exists public.profiles cascade;

-- Drop helper functions
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.is_member_of_channel(uuid) cascade;

-- Drop enums
drop type if exists public.gantt_import_status cascade;
drop type if exists public.event_response cascade;
drop type if exists public.channel_type cascade;
drop type if exists public.task_priority cascade;
drop type if exists public.task_status cascade;
drop type if exists public.person_status cascade;

-- Storage buckets are left in place (0003 succeeded already; re-running 0003 is idempotent)
