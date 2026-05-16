-- countme-crm: enable Realtime for live updates (idempotent)
-- Without this, Supabase Realtime silently drops change events from these tables.

do $$ begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table tasks;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table channel_members;
exception when duplicate_object then null; end $$;

-- replica identity full on tasks so UPDATE/DELETE events carry the prior row state
-- (lets the client know which assignee/status changed). Default (PK only) is
-- enough for messages (INSERT-heavy). Setting twice is a no-op.
alter table tasks replica identity full;
