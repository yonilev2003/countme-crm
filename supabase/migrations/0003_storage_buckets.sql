-- countme-crm: Storage buckets + policies
-- Path convention: {owner_id}/{filename} so RLS can enforce ownership via path prefix.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ============================================================
-- DOCUMENTS bucket (private, owner-only writes)
-- ============================================================

create policy "documents read authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents');

create policy "documents upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- AVATARS bucket (public read, owner-only writes)
-- ============================================================

create policy "avatars read public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars upload own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
