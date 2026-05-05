-- Public thumbnails for News Studio workspace drafts (first-slide raster).
-- URLs are unguessable (user UUID + draft UUID); images are not secret content.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'draft-previews',
  'draft-previews',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Authenticated users may only write under `{auth.uid()}/...`
create policy "draft_previews_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'draft-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "draft_previews_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'draft-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'draft-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "draft_previews_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'draft-previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
