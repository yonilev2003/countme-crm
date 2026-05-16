-- countme-crm: Google Drive sync (idempotent)
-- Adds:
--   1. Drive metadata columns to `documents` (drive_file_id, modified_time,
--      web view link, mime type) plus an index on drive_file_id.
--   2. Drive credentials + designated folder columns on `team_config`.
--      The shared Google Drive (countme5555@gmail.com) owns the folder; the
--      auto-folder approach lets us use the non-sensitive drive.file scope.

set search_path = public;

-- ============================================================
-- DOCUMENTS: Drive metadata
-- ============================================================

alter table documents add column if not exists drive_file_id text;
alter table documents add column if not exists drive_modified_time timestamptz;
alter table documents add column if not exists drive_web_view_link text;
alter table documents add column if not exists drive_mime_type text;

create index if not exists idx_documents_drive_file_id on documents(drive_file_id);

-- ============================================================
-- TEAM_CONFIG: Drive credentials + folder
-- ============================================================

alter table team_config add column if not exists shared_drive_refresh_token text;
alter table team_config add column if not exists shared_drive_access_token text;
alter table team_config add column if not exists shared_drive_token_expires_at timestamptz;
alter table team_config add column if not exists shared_drive_folder_id text;
alter table team_config add column if not exists shared_drive_folder_name text default 'הנהלת CountMe — מסמכים';
alter table team_config add column if not exists shared_drive_last_sync timestamptz;
