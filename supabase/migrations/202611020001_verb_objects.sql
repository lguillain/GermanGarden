-- Typical direct-object phrases are explicit vocabulary data, not POS heuristics.
create table public.verb_objects (
  verb_id text references public.words on delete cascade,
  noun_id text references public.words on delete cascade,
  phrase text not null check (length(trim(phrase)) > 0),
  primary key (verb_id, noun_id)
);
create index verb_objects_noun on public.verb_objects(noun_id);
alter table public.verb_objects enable row level security;
create policy verb_objects_read on public.verb_objects for select to authenticated using (true);
revoke all on public.verb_objects from anon, authenticated;
grant select on public.verb_objects to authenticated;
grant all on public.verb_objects to service_role;
