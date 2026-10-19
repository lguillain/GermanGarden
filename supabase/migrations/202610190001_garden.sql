-- Shared, read-only vocabulary; private progress is written only by the API.
create table public.words (
  id text primary key, lemma text not null, article text, plural text,
  pos text not null, english text not null, level text not null check (level in ('A1','A2','B1'))
);
create table public.activities (id text primary key, name text not null, description text);
create table public.word_activities (
  word_id text references public.words on delete cascade,
  activity_id text references public.activities on delete cascade,
  relevance integer not null check (relevance between 1 and 3),
  primary key (word_id, activity_id)
);
create table public.sentences (
  id bigint primary key, word_id text not null references public.words on delete cascade,
  activity_id text references public.activities on delete set null,
  text text not null, english text not null, source text not null, tatoeba_id bigint
);
create index on public.sentences(word_id, activity_id);
create index on public.word_activities(activity_id);
-- One document per authenticated learner keeps the original per-profile model.
-- Versioned, atomic writes prevent lost updates from concurrent tabs/devices.
create table public.learner_state (
  user_id uuid primary key references auth.users on delete cascade,
  version bigint not null default 0,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.words enable row level security;
alter table public.activities enable row level security;
alter table public.word_activities enable row level security;
alter table public.sentences enable row level security;
alter table public.learner_state enable row level security;
create policy vocabulary_read on public.words for select to authenticated using (true);
create policy activities_read on public.activities for select to authenticated using (true);
create policy links_read on public.word_activities for select to authenticated using (true);
create policy sentences_read on public.sentences for select to authenticated using (true);
create policy own_progress on public.learner_state for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.words, public.activities, public.word_activities, public.sentences, public.learner_state from anon, authenticated;
grant select on public.words, public.activities, public.word_activities, public.sentences, public.learner_state to authenticated;
grant all on public.words, public.activities, public.word_activities, public.sentences, public.learner_state to service_role;
create function public.save_learner_state(p_user_id uuid, p_version bigint, p_data jsonb)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.learner_state set data = p_data, version = version + 1, updated_at = now()
    where user_id = p_user_id and version = p_version;
  return found;
end;
$$;
revoke all on function public.save_learner_state(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_learner_state(uuid, bigint, jsonb) to service_role;
