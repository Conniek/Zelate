-- DEV-1 steps 9-10/11: Storage buckets and policies (§8.3), Realtime
-- Authorization on private Broadcast channels (§9).

-- Storage -----------------------------------------------------------------
-- Public buckets serve objects by URL without a policy; policies below cover
-- the API (upload, replace, delete, list). Folder = salon_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('salon-photos', 'salon-photos', true, 307200, array['image/webp']),
  ('member-photos', 'member-photos', true, 153600, array['image/webp']),
  ('qr-posters', 'qr-posters', false, 2097152, array['application/pdf']);

-- The first path segment must be a uuid equal to the manager's salon.
create function private.storage_salon_folder(p_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke execute on function private.storage_salon_folder(text) from public;
grant execute on function private.storage_salon_folder(text) to authenticated;

create policy storage_manager_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('salon-photos', 'member-photos', 'qr-posters')
    and private.storage_salon_folder(name) = (select private.managed_salon_id()));
create policy storage_manager_select on storage.objects for select to authenticated
  using (bucket_id in ('salon-photos', 'member-photos', 'qr-posters')
    and private.storage_salon_folder(name) = (select private.managed_salon_id()));
create policy storage_manager_update on storage.objects for update to authenticated
  using (bucket_id in ('salon-photos', 'member-photos', 'qr-posters')
    and private.storage_salon_folder(name) = (select private.managed_salon_id()))
  with check (bucket_id in ('salon-photos', 'member-photos', 'qr-posters')
    and private.storage_salon_folder(name) = (select private.managed_salon_id()));
create policy storage_manager_delete on storage.objects for delete to authenticated
  using (bucket_id in ('salon-photos', 'member-photos', 'qr-posters')
    and private.storage_salon_folder(name) = (select private.managed_salon_id()));

-- Realtime ----------------------------------------------------------------
-- Edge Functions publish with the service role (bypasses RLS). Clients only
-- receive: there is no insert policy, so nobody can publish from a browser.
create function private.topic_uuid(p_topic text, p_prefix text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  if p_topic like p_prefix || ':%' then
    return substr(p_topic, char_length(p_prefix) + 2)::uuid;
  end if;
  return null;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke execute on function private.topic_uuid(text, text) from public;
grant execute on function private.topic_uuid(text, text) to anon, authenticated;

create policy realtime_public_receive on realtime.messages for select to anon, authenticated
  using (extension = 'broadcast'
    and ((select realtime.topic()) like 'salon-public:%'
         or (select realtime.topic()) like 'ticket-token:%'));

create policy realtime_staff_receive on realtime.messages for select to authenticated
  using (extension = 'broadcast'
    and private.topic_uuid((select realtime.topic()), 'salon') = (select private.staff_salon_id()));

create policy realtime_client_receive on realtime.messages for select to authenticated
  using (extension = 'broadcast'
    and private.owns_ticket(private.topic_uuid((select realtime.topic()), 'ticket')));
