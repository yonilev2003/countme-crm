-- countme-crm: roles + onboarding + admin (idempotent)
-- Adds display_name (user-overridable), role (free text), is_admin, onboarded_at to profiles.
-- Auto-marks yonilev2003@gmail.com as admin via trigger; backfills the existing row.
-- Admin RLS override allows admin to update other profiles (for /admin/users panel).

set search_path = public;

-- ============================================================
-- PROFILES: new columns
-- ============================================================

alter table profiles add column if not exists role text;
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists onboarded_at timestamptz;
alter table profiles add column if not exists display_name text;

-- ============================================================
-- AUTO-ADMIN trigger (CTO email is hard-coded for now)
-- ============================================================

create or replace function public.set_admin_for_cto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = 'yonilev2003@gmail.com' then
    new.is_admin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_admin on profiles;
create trigger profiles_set_admin
  before insert or update of email on profiles
  for each row execute function set_admin_for_cto();

-- Backfill: ensure existing CTO row is admin
update profiles set is_admin = true where email = 'yonilev2003@gmail.com';

-- ============================================================
-- RLS: admin can update any profile (role, is_admin, etc.)
-- Existing profiles_update_own remains for non-admin self-updates.
-- ============================================================

drop policy if exists profiles_update_admin on profiles;
create policy profiles_update_admin on profiles
  for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
