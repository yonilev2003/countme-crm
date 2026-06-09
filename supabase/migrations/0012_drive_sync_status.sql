-- countme-crm: Drive sync status tracking (idempotent)
-- Adds per-document sync state so the UI can show whether a file actually
-- reached the team Google Drive, and so a background "repair" pass can find
-- and re-push files whose create-time mirror failed or was dropped (e.g. a
-- serverless instance frozen before the fire-and-forget upload finished).
--
-- States:
--   pending — needs to be mirrored to Drive (default for new CRM uploads)
--   synced  — confirmed present in Drive (drive_file_id is set)
--   failed  — a mirror attempt failed; the repair sweep will retry it

set search_path = public;

alter table documents add column if not exists drive_sync_status text not null default 'pending';
alter table documents add column if not exists drive_sync_error text;
alter table documents add column if not exists drive_synced_at timestamptz;

-- Constrain to the known states (guarded so re-runs don't error).
do $$
begin
  alter table documents
    add constraint documents_drive_sync_status_chk
    check (drive_sync_status in ('pending', 'synced', 'failed'));
exception
  when duplicate_object then null;
end $$;

-- Backfill existing rows:
--   - anything already in Drive (has a drive_file_id) is 'synced'
--   - Drive-originated rows (storage_path 'drive:...') are by definition in Drive
update documents
  set drive_sync_status = 'synced',
      drive_synced_at = coalesce(drive_modified_time, uploaded_at)
  where drive_sync_status <> 'synced'
    and (drive_file_id is not null or storage_path like 'drive:%');

-- Partial index keeps the repair sweep cheap — it only ever scans the small
-- set of rows still waiting to reach Drive.
create index if not exists idx_documents_drive_sync_pending
  on documents (drive_sync_status)
  where drive_sync_status in ('pending', 'failed');
