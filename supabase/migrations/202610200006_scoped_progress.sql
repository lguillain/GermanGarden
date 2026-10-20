-- Frequent matcher checks should not scan a learner's entire decision history.
create index learner_decisions_seed_bag_idx
  on public.learner_decisions(user_id, position)
  where action='keep' and planted_at is null;
create index learner_word_marks_word_idx
  on public.learner_word_marks(user_id, word_id);

-- Read-only snapshots: topic pages need only that topic's words; the practice
-- menu needs kept words (including all seeds for its cross-scope counts).
-- Array positions are not persistence positions. Never use these for writes.
create function public.load_scoped_progress(
  p_user_id uuid, p_name text, p_topic text default null,
  p_kept_only boolean default false
) returns jsonb language plpgsql set search_path = '' as $$
declare result jsonb;
begin
  insert into public.learner_profiles(user_id,name) values (p_user_id,p_name) on conflict do nothing;
  with relevant_words as materialized (
    select w.id from public.words w
    where (p_topic is null or exists (
      select 1 from public.word_activities wa where wa.word_id=w.id and wa.activity_id=p_topic))
    and (not p_kept_only or exists (
      select 1 from public.learner_decisions d
      where d.user_id=p_user_id and d.word_id=w.id and d.action='keep'))
  )
  select jsonb_build_object('version',p.version,'data',jsonb_build_object(
    'user',to_jsonb(p)-'user_id'-'version'-'updated_at',
    'swipes',coalesce((select jsonb_agg(to_jsonb(d)-'user_id'-'position' order by position)
      from public.learner_decisions d join relevant_words w on w.id=d.word_id
      where d.user_id=p_user_id and (not p_kept_only or d.action='keep')),'[]'),
    'known',coalesce((select jsonb_agg(m.word_id order by position)
      from public.learner_word_marks m join relevant_words w on w.id=m.word_id
      where m.user_id=p_user_id and kind='known'),'[]'),
    'learned',coalesce((select jsonb_agg(m.word_id order by position)
      from public.learner_word_marks m join relevant_words w on w.id=m.word_id
      where m.user_id=p_user_id and kind='learned'),'[]'),
    'srs',coalesce((select jsonb_object_agg(s.word_id,to_jsonb(s)-'user_id'-'word_id')
      from public.learner_srs s join relevant_words w on w.id=s.word_id
      where s.user_id=p_user_id),'{}'),
    'weights','{}'::jsonb,'reviews','[]'::jsonb,'sessions','[]'::jsonb))
    into result from public.learner_profiles p where p.user_id=p_user_id;
  return result;
end;
$$;
revoke all on function public.load_scoped_progress(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.load_scoped_progress(uuid,text,text,boolean) to service_role;
