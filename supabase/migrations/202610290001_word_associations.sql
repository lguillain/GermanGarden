-- Shared, read-only word associations chosen offline from the vocabulary.
create table public.word_associations (
  word_id text references public.words on delete cascade,
  related_id text references public.words on delete cascade,
  rank integer not null check (rank between 1 and 6),
  primary key (word_id, related_id),
  check (word_id <> related_id)
);
alter table public.word_associations enable row level security;
create policy associations_read on public.word_associations for select to authenticated using (true);
revoke all on public.word_associations from anon, authenticated;
grant select on public.word_associations to authenticated;
grant all on public.word_associations to service_role;
