-- Remove activity time accounting and its stored history.
begin;

create or replace function public.load_learner_progress(p_user_id uuid, p_name text)
returns jsonb language plpgsql set search_path = '' as $$
declare result jsonb;
begin
  insert into public.learner_profiles(user_id,name) values (p_user_id,p_name) on conflict do nothing;
  -- One statement gives every component the same MVCC snapshot.
  select jsonb_build_object('version',p.version,'data',jsonb_build_object(
    'user',to_jsonb(p)-'user_id'-'version'-'updated_at',
    'swipes',coalesce((select jsonb_agg(to_jsonb(d)-'user_id'-'position' order by position)
      from public.learner_decisions d where user_id=p_user_id),'[]'),
    'known',coalesce((select jsonb_agg(word_id order by position) from public.learner_word_marks
      where user_id=p_user_id and kind='known'),'[]'),
    'learned',coalesce((select jsonb_agg(word_id order by position) from public.learner_word_marks
      where user_id=p_user_id and kind='learned'),'[]'),
    'srs',coalesce((select jsonb_object_agg(word_id,to_jsonb(s)-'user_id'-'word_id')
      from public.learner_srs s where user_id=p_user_id),'{}'),
    'weights',coalesce((select jsonb_object_agg(activity_id,weight) from public.learner_topic_weights where user_id=p_user_id),'{}'),
    'reviews','[]'::jsonb))
    into result from public.learner_profiles p where user_id=p_user_id;
  return result;
end;
$$;

create or replace function public.import_learner_progress(p_user_id uuid, p_data jsonb, p_skip_existing boolean default false)
returns boolean language plpgsql set search_path = '' as $$
declare changes jsonb; item jsonb; component text;
begin
  -- Refuse unfamiliar fields instead of silently losing data during a migration
  -- or import from a different application version.
  if p_data - array['user','swipes','known','learned','srs','weights','reviews'] <> '{}'::jsonb
    or (p_data->'user') - array['name','level','swipe_count','drop_streak','cards_in_bucket',
      'current_topic','affinity_below','affinity_above','level_bias'] <> '{}'::jsonb then
    raise exception 'Unrecognized learner fields; import refused';
  end if;
  foreach component in array array['swipes','reviews'] loop
    for item in select value from jsonb_array_elements(p_data->component) loop
      if item - (case component
        when 'swipes' then array['id','word_id','activity_id','sentence_id','action','drop_reason','swiped_at','planted_at']
        when 'reviews' then array['id','word_id','grade','reviewed_at','track'] end) <> '{}'::jsonb then
        raise exception 'Unrecognized history fields; import refused';
      end if;
    end loop;
  end loop;
  for item in select value from jsonb_each(p_data->'srs') loop
    if item - array['ease','interval_days','reps','lapses','state','due_at','last_grade','last_review_at','production'] <> '{}'::jsonb then
      raise exception 'Unrecognized spaced repetition fields; import refused';
    end if;
    if item->'production' is not null and item->'production' <> 'null'::jsonb and
      (jsonb_typeof(item->'production') <> 'object' or
       (item->'production') - array['ease','interval_days','reps','lapses','state','due_at','last_grade','last_review_at'] <> '{}'::jsonb) then
      raise exception 'Unrecognized production schedule fields; import refused';
    end if;
  end loop;
  insert into public.learner_profiles(user_id,name) values (p_user_id,p_data->'user'->>'name') on conflict do nothing;
  if not found then
    if p_skip_existing then return false; end if;
    raise exception 'Learner progress already exists; import refused';
  end if;
  changes := p_data || jsonb_build_object(
    'swipes',coalesce((select jsonb_agg(value || jsonb_build_object('position',ordinality-1))
      from jsonb_array_elements(p_data->'swipes') with ordinality),'[]'),
    'marks',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'position',ordinality-1,'word_id',value))
      from (values ('known'),('learned')) kinds(kind),
      lateral jsonb_array_elements_text(p_data->kind) with ordinality),'[]'));
  perform public.apply_learner_changes(p_user_id,changes);
  return true;
end;
$$;

create or replace function public.load_scoped_progress(
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
    and (not p_kept_only or exists (select 1 from public.learner_word_marks m where m.user_id=p_user_id and m.word_id=w.id) or exists (
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
    'weights','{}'::jsonb,'reviews','[]'::jsonb))
    into result from public.learner_profiles p where p.user_id=p_user_id;
  return result;
end;
$$;

create or replace function public.load_matcher_progress(p_user_id uuid, p_name text)
returns jsonb language plpgsql set search_path = '' as $$
declare result jsonb;
begin
  insert into public.learner_profiles(user_id,name) values (p_user_id,p_name) on conflict do nothing;
  select jsonb_build_object('version',p.version,'data',jsonb_build_object(
    'user',to_jsonb(p)-'user_id'-'version'-'updated_at',
    'seen_ids',coalesce((select jsonb_agg(distinct word_id) from public.learner_decisions where user_id=p_user_id),'[]'),
    'swipes',coalesce((select jsonb_agg(to_jsonb(d)-'user_id'-'position' order by position)
      from public.learner_decisions d where user_id=p_user_id and action='keep' and planted_at is null),'[]'),
    'known',coalesce((select jsonb_agg(word_id order by position) from public.learner_word_marks where user_id=p_user_id and kind='known'),'[]'),
    'learned',coalesce((select jsonb_agg(word_id order by position) from public.learner_word_marks where user_id=p_user_id and kind='learned'),'[]'),
    'srs',coalesce((select jsonb_object_agg(s.word_id,to_jsonb(s)-'user_id'-'word_id') from public.learner_srs s
      where s.user_id=p_user_id and exists (select 1 from public.learner_decisions d
        where d.user_id=p_user_id and d.word_id=s.word_id and d.action='keep' and d.planted_at is null)),'{}'),
    'weights','{}'::jsonb,'reviews','[]'::jsonb))
    into result from public.learner_profiles p where p.user_id=p_user_id;
  return result;
end;
$$;

drop function public.heartbeat_learner(uuid,text,timestamptz);
drop function public.learner_time(uuid,timestamptz);
drop table public.learner_sessions;

commit;
