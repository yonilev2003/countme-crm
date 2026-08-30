-- countme-crm: tighten exposed function privileges and pin search paths.
-- Safe with existing RLS: authenticated access remains on membership helpers
-- because policies call them; anon access is removed. The event-trigger helper
-- is not a client RPC surface.

revoke all on function public.is_member_of_channel(uuid) from public, anon;
grant execute on function public.is_member_of_channel(uuid) to authenticated, service_role;

revoke all on function public.is_workspace_admin(uuid) from public, anon;
grant execute on function public.is_workspace_admin(uuid) to authenticated, service_role;

revoke all on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

alter function public.touch_updated_at() set search_path = pg_catalog, public;
alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function public.storage_workspace_id(text) set search_path = pg_catalog, public, storage;
