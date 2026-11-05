-- Only the authenticated Edge Function accesses these documents. Private keys
-- are built from the verified account ID, never a browser-supplied user ID.
create table public.word_context_documents (
  key text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  lease uuid,
  lease_until timestamptz
);
alter table public.word_context_documents enable row level security;
revoke all on public.word_context_documents from anon, authenticated;
grant all on public.word_context_documents to service_role;

create function public.claim_word_context(p_key text, p_user_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare doc word_context_documents;
begin
  insert into word_context_documents(key, user_id) values(p_key, p_user_id) on conflict do nothing;
  update word_context_documents set lease = p_token, lease_until = now() + interval '3 minutes'
    where key = p_key and user_id is not distinct from p_user_id
      and (lease is null or lease_until < now()) returning * into doc;
  if not found then return null; end if;
  return doc.content;
end $$;
create function public.finish_word_context(p_key text, p_token uuid, p_content jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update word_context_documents set content = coalesce(p_content, content), lease = null, lease_until = null
    where key = p_key and lease = p_token;
  return found;
end $$;
revoke all on function public.claim_word_context(text,uuid,uuid) from public, anon, authenticated;
revoke all on function public.finish_word_context(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.claim_word_context(text,uuid,uuid) to service_role;
grant execute on function public.finish_word_context(text,uuid,jsonb) to service_role;
