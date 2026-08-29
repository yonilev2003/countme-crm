-- countme-crm: everyone is admin (idempotent)
-- Internal team product: every current user becomes admin, and every new
-- user is admin from their first login. The CTO email stays force-admin on
-- email updates. Manual demotion via /admin/users still sticks, because the
-- trigger only fires on INSERT or on UPDATE OF email.

set search_path = public;

-- New users default to admin.
alter table profiles alter column is_admin set default true;

create or replace function public.set_admin_for_cto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.is_admin := true;
  elsif new.email = 'yonilev2003@gmail.com' then
    new.is_admin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_admin on profiles;
create trigger profiles_set_admin
  before insert or update of email on profiles
  for each row execute function set_admin_for_cto();

-- Backfill: every existing user becomes admin.
update profiles set is_admin = true where is_admin is distinct from true;
