-- countme-crm: hard allowlist for internal team authentication
-- Defense in depth: even if the Google OAuth consent screen is later
-- published, only these approved accounts may receive a CountMe profile.
-- handle_new_user runs in the auth.users insert transaction; raising here
-- aborts an unauthorized signup before an application profile is created.

set search_path = public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) not in (
    'yonilev2003@gmail.com',
    'roykurtzman@gmail.com',
    'tomlevs15@gmail.com'
  ) then
    raise exception 'This account is not authorized for CountMe';
  end if;

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
