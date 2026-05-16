-- countme-crm: Row Level Security policies (idempotent)
-- Team CRM: authenticated users read everything; writes restricted to owner.
-- Safe to re-run: drops policies first via "drop policy if exists" before recreate.

alter table profiles enable row level security;
alter table people enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table documents enable row level security;
alter table channels enable row level security;
alter table channel_members enable row level security;
alter table messages enable row level security;
alter table events enable row level security;
alter table event_attendees enable row level security;
alter table gantt_imports enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================

drop policy if exists profiles_read_auth on profiles;
create policy profiles_read_auth
  on profiles for select to authenticated using (true);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own
  on profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT handled by handle_new_user() trigger (security definer)
-- DELETE handled by cascade from auth.users

-- ============================================================
-- PEOPLE
-- ============================================================

drop policy if exists people_read_auth on people;
create policy people_read_auth
  on people for select to authenticated using (true);

drop policy if exists people_insert_owner on people;
create policy people_insert_owner
  on people for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists people_update_owner on people;
create policy people_update_owner
  on people for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists people_delete_owner on people;
create policy people_delete_owner
  on people for delete to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- PROJECTS
-- ============================================================

drop policy if exists projects_read_auth on projects;
create policy projects_read_auth
  on projects for select to authenticated using (true);

drop policy if exists projects_insert_owner on projects;
create policy projects_insert_owner
  on projects for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists projects_update_owner on projects;
create policy projects_update_owner
  on projects for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists projects_delete_owner on projects;
create policy projects_delete_owner
  on projects for delete to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- TASKS (owner or assignee can update)
-- ============================================================

drop policy if exists tasks_read_auth on tasks;
create policy tasks_read_auth
  on tasks for select to authenticated using (true);

drop policy if exists tasks_insert_owner on tasks;
create policy tasks_insert_owner
  on tasks for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists tasks_update_owner_or_assignee on tasks;
create policy tasks_update_owner_or_assignee
  on tasks for update to authenticated
  using (owner_id = auth.uid() or assignee_id = auth.uid())
  with check (owner_id = auth.uid() or assignee_id = auth.uid());

drop policy if exists tasks_delete_owner on tasks;
create policy tasks_delete_owner
  on tasks for delete to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- DOCUMENTS
-- ============================================================

drop policy if exists documents_read_auth on documents;
create policy documents_read_auth
  on documents for select to authenticated using (true);

drop policy if exists documents_insert_owner on documents;
create policy documents_insert_owner
  on documents for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists documents_delete_owner on documents;
create policy documents_delete_owner
  on documents for delete to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- CHANNELS
-- ============================================================

drop policy if exists channels_read_member_or_public on channels;
create policy channels_read_member_or_public
  on channels for select to authenticated using (
    not is_private
    or public.is_member_of_channel(id)
  );

drop policy if exists channels_insert_creator on channels;
create policy channels_insert_creator
  on channels for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists channels_update_creator on channels;
create policy channels_update_creator
  on channels for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists channels_delete_creator on channels;
create policy channels_delete_creator
  on channels for delete to authenticated
  using (created_by = auth.uid());

-- ============================================================
-- CHANNEL_MEMBERS (uses security-definer helper to avoid RLS recursion)
-- ============================================================

drop policy if exists channel_members_read on channel_members;
create policy channel_members_read
  on channel_members for select to authenticated using (
    profile_id = auth.uid()
    or public.is_member_of_channel(channel_id)
  );

drop policy if exists channel_members_insert_self on channel_members;
create policy channel_members_insert_self
  on channel_members for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists channel_members_update_self on channel_members;
create policy channel_members_update_self
  on channel_members for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists channel_members_delete_self on channel_members;
create policy channel_members_delete_self
  on channel_members for delete to authenticated
  using (profile_id = auth.uid());

-- ============================================================
-- MESSAGES
-- ============================================================

drop policy if exists messages_read_member_or_public on messages;
create policy messages_read_member_or_public
  on messages for select to authenticated using (
    public.is_member_of_channel(channel_id)
    or exists (
      select 1 from channels c
      where c.id = messages.channel_id and c.is_private = false
    )
  );

drop policy if exists messages_insert_sender_member on messages;
create policy messages_insert_sender_member
  on messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_member_of_channel(channel_id)
      or exists (
        select 1 from channels c
        where c.id = messages.channel_id and c.is_private = false
      )
    )
  );

drop policy if exists messages_delete_sender on messages;
create policy messages_delete_sender
  on messages for delete to authenticated
  using (sender_id = auth.uid());

-- ============================================================
-- EVENTS
-- ============================================================

drop policy if exists events_read_auth on events;
create policy events_read_auth
  on events for select to authenticated using (true);

drop policy if exists events_insert_owner on events;
create policy events_insert_owner
  on events for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists events_update_owner on events;
create policy events_update_owner
  on events for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists events_delete_owner on events;
create policy events_delete_owner
  on events for delete to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- EVENT_ATTENDEES
-- ============================================================

drop policy if exists event_attendees_read_auth on event_attendees;
create policy event_attendees_read_auth
  on event_attendees for select to authenticated using (true);

drop policy if exists event_attendees_insert_owner_or_self on event_attendees;
create policy event_attendees_insert_owner_or_self
  on event_attendees for insert to authenticated
  with check (
    profile_id = auth.uid()
    or exists (
      select 1 from events e
      where e.id = event_attendees.event_id and e.owner_id = auth.uid()
    )
  );

drop policy if exists event_attendees_update_self on event_attendees;
create policy event_attendees_update_self
  on event_attendees for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists event_attendees_delete_owner_or_self on event_attendees;
create policy event_attendees_delete_owner_or_self
  on event_attendees for delete to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from events e
      where e.id = event_attendees.event_id and e.owner_id = auth.uid()
    )
  );

-- ============================================================
-- GANTT_IMPORTS
-- ============================================================

drop policy if exists gantt_imports_read_auth on gantt_imports;
create policy gantt_imports_read_auth
  on gantt_imports for select to authenticated using (true);

drop policy if exists gantt_imports_insert_owner on gantt_imports;
create policy gantt_imports_insert_owner
  on gantt_imports for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists gantt_imports_update_owner on gantt_imports;
create policy gantt_imports_update_owner
  on gantt_imports for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists gantt_imports_delete_owner on gantt_imports;
create policy gantt_imports_delete_owner
  on gantt_imports for delete to authenticated
  using (owner_id = auth.uid());
