-- countme-crm: enable Realtime for live updates
-- Without this, Supabase Realtime silently drops change events from these tables.

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table channel_members;

-- replica identity full on tasks so UPDATE/DELETE events carry the prior row state
-- (lets the client know which assignee/status changed). Default 'd' (PK only) is
-- enough for messages (INSERT-heavy).
alter table tasks replica identity full;
