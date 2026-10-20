-- Preserve existing schedules as recognition. Production is permanently unlocked
-- by the presence of its typed schedule, even if recognition later lapses.
begin;
create type public.review_schedule as (
  ease numeric, interval_days numeric, reps integer, lapses integer, state text,
  due_at timestamptz, last_grade integer, last_review_at timestamptz
);
alter table public.learner_srs add column production public.review_schedule;
alter table public.learner_reviews add column track text not null default 'recognition'
  check (track in ('recognition','production'));
update public.learner_srs s set production=row(2.5,0,0,0,'learning',now(),null,null)::public.review_schedule
where (interval_days >= 7 or state='graduated')
  and not exists(select 1 from public.learner_word_marks m where m.user_id=s.user_id and m.word_id=s.word_id);
create or replace function public.apply_learner_changes(p_user_id uuid, p_changes jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  if p_changes ? 'user' then
    update public.learner_profiles set
      name = p_changes->'user'->>'name', level = p_changes->'user'->>'level',
      swipe_count = (p_changes->'user'->>'swipe_count')::integer,
      drop_streak = (p_changes->'user'->>'drop_streak')::integer,
      cards_in_bucket = (p_changes->'user'->>'cards_in_bucket')::integer,
      current_topic = p_changes->'user'->>'current_topic',
      affinity_below = (p_changes->'user'->>'affinity_below')::numeric,
      affinity_above = (p_changes->'user'->>'affinity_above')::numeric,
      level_bias = (p_changes->'user'->>'level_bias')::numeric
    where user_id = p_user_id;
  end if;
  insert into public.learner_decisions
    select p_user_id, r.position, r.id, r.word_id, r.activity_id, r.sentence_id,
      r.action, r.drop_reason, r.swiped_at, r.planted_at
    from jsonb_populate_recordset(null::public.learner_decisions, coalesce(p_changes->'swipes','[]')) r
    on conflict (user_id,position) do update set action=excluded.action,
      drop_reason=excluded.drop_reason, planted_at=excluded.planted_at;
  insert into public.learner_word_marks
    select p_user_id, r.kind, r.position, r.word_id
    from jsonb_populate_recordset(null::public.learner_word_marks, coalesce(p_changes->'marks','[]')) r
    on conflict (user_id,kind,position) do update set word_id=excluded.word_id;
  insert into public.learner_srs
    select p_user_id, e.key, r.ease, r.interval_days, r.reps, r.lapses, r.state,
      r.due_at, r.last_grade, r.last_review_at,
      coalesce(r.production, case when r.interval_days >= 7 or r.state='graduated'
        then row(2.5,0,0,0,'learning',now(),null,null)::public.review_schedule end)
    from jsonb_each(coalesce(p_changes->'srs','{}')) e,
      lateral jsonb_populate_record(null::public.learner_srs, e.value) r
    on conflict (user_id,word_id) do update set ease=excluded.ease,
      interval_days=excluded.interval_days, reps=excluded.reps, lapses=excluded.lapses,
      state=excluded.state, due_at=excluded.due_at, last_grade=excluded.last_grade,
      last_review_at=excluded.last_review_at, production=excluded.production;
  if p_changes ? 'weights' then
    delete from public.learner_topic_weights where user_id=p_user_id
      and not (p_changes->'weights' ? activity_id);
    insert into public.learner_topic_weights
      select p_user_id, key, value::numeric from jsonb_each_text(p_changes->'weights')
      on conflict (user_id,activity_id) do update set weight=excluded.weight
      where public.learner_topic_weights.weight is distinct from excluded.weight;
  end if;
  insert into public.learner_reviews
    select p_user_id, coalesce((select max(position)+1 from public.learner_reviews where user_id=p_user_id),0) + e.ordinality-1,
      r.id, r.word_id, r.grade, r.reviewed_at, coalesce(r.track,'recognition')
    from jsonb_array_elements(coalesce(p_changes->'reviews','[]')) with ordinality e(value,ordinality),
      lateral jsonb_populate_record(null::public.learner_reviews,e.value) r;
end;
$$;


drop function public.load_review_selection(uuid,text,text,timestamptz);
-- Review reads return one card and counts from a single database snapshot.
-- Only the backend may supply the authenticated learner ID.
create function public.load_review_selection(
  p_user_id uuid, p_scope text default 'all', p_topic text default '',
  p_now timestamptz default now(), p_excluded text[] default '{}'
) returns jsonb language sql stable set search_path = '' as $$
  with kept as materialized (
    -- Match the domain's first keep, including imported duplicate decisions.
    select distinct on (d.word_id) d.* from public.learner_decisions d
    where d.user_id=p_user_id and d.action='keep'
    order by d.word_id, d.position
  ), eligible as materialized (
    select w.id, to_jsonb(w) as word,
      to_jsonb(d)-'user_id'-'position' as swipe,
      case when s.word_id is not null then to_jsonb(s)-'user_id'-'word_id' end as srs,
      d.planted_at is null as seed, s.word_id is not null as scheduled, s.due_at,
      exists (select 1 from public.word_activities wa
        where wa.word_id=w.id and wa.activity_id=p_topic) as in_topic
    from kept d join public.words w on w.id=d.word_id
    left join public.learner_srs s on s.user_id=p_user_id and s.word_id=w.id
    where (s.word_id is null or s.due_at <= p_now or (s.production).due_at <= p_now)
      and not exists (select 1 from public.learner_word_marks m
        where m.user_id=p_user_id and m.word_id=w.id)
  ), scoped as (
    select * from eligible where not (id = any(p_excluded)) and case p_scope
      when 'bag' then seed when 'all' then not seed
      when 'topic' then not seed and in_topic else false end
  ), selected as (
    select * from scoped order by scheduled, due_at, id limit 1
  ), example as (
    select s.* from public.sentences s join selected w on w.id=s.word_id
    -- Prefer the topic's examples, falling back to any example for the word.
    order by (p_scope='topic' and s.activity_id=p_topic) desc nulls last, random()
    limit 1
  )
  select jsonb_build_object(
    'topic_exists', exists(select 1 from public.activities where id=p_topic),
    'vocabulary_available', exists(select 1 from public.words) and exists(select 1 from public.activities),
    'selected', (select jsonb_build_object('word', w.word, 'swipe', w.swipe, 'srs', w.srs,
      'sentence', (select to_jsonb(s)-'source'-'tatoeba_id' from example s),
      'activity', (select to_jsonb(a) from public.activities a where a.id=
        case when p_scope='topic' then p_topic else (select activity_id from example) end)) from selected w),
    'remaining', (select count(*) from scoped),
    'counts', jsonb_build_object(
      'plants', (select count(*) from eligible where not seed and (p_topic='' or in_topic)),
      'seeds', (select count(*) from eligible where seed))
  );
$$;
revoke all on function public.load_review_selection(uuid,text,text,timestamptz,text[]) from public, anon, authenticated;
grant execute on function public.load_review_selection(uuid,text,text,timestamptz,text[]) to service_role;

-- Add one topic word without transferring the catalogue or learner snapshot.
-- All progress writers share the profile lock and version counter.
create or replace function public.keep_topic_word(p_user_id uuid, p_name text, p_word_id text, p_topic text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  selected_word public.words;
  kept public.learner_decisions;
  example_id bigint;
  did_add boolean := false;
begin
  select * into selected_word from public.words where id=p_word_id;
  if not found then return jsonb_build_object('error','unknown_word'); end if;
  if not exists(select 1 from public.activities where id=p_topic) then
    return jsonb_build_object('error','unknown_topic');
  end if;
  if not exists(select 1 from public.word_activities where word_id=p_word_id and activity_id=p_topic) then
    return jsonb_build_object('error','wrong_topic');
  end if;

  insert into public.learner_profiles(user_id,name) values(p_user_id,p_name) on conflict do nothing;
  perform 1 from public.learner_profiles where user_id=p_user_id for update;
  if exists(select 1 from public.learner_word_marks where user_id=p_user_id and word_id=p_word_id) then
    return jsonb_build_object('error','learned');
  end if;
  select * into kept from public.learner_decisions
    where user_id=p_user_id and word_id=p_word_id and action='keep' order by position limit 1;
  if not found then
    -- Use the seed-bag index. Honour the first keep for imported duplicates,
    -- ignore removed vocabulary, and stop as soon as the bag is full.
    if (select count(*) from (
      select d.word_id from public.learner_decisions d
      join public.words w on w.id=d.word_id
      where d.user_id=p_user_id and d.action='keep' and d.planted_at is null
        and not exists(select 1 from public.learner_word_marks m where m.user_id=p_user_id and m.word_id=d.word_id)
        and not exists(select 1 from public.learner_decisions earlier
          where earlier.user_id=p_user_id and earlier.word_id=d.word_id
            and earlier.action='keep' and earlier.position<d.position)
      limit 20
    ) seeds) >= 20 then return jsonb_build_object('error','bag_full'); end if;

    select id into example_id from public.sentences where word_id=p_word_id
      order by (activity_id=p_topic) desc nulls last, random() limit 1;
    insert into public.learner_decisions(user_id,position,word_id,activity_id,sentence_id,action,swiped_at,planted_at)
      values(p_user_id,coalesce((select max(position)+1 from public.learner_decisions where user_id=p_user_id),0),
        p_word_id,p_topic,example_id,'keep',now(),null)
      returning * into kept;
    update public.learner_profiles set version=version+1,updated_at=now() where user_id=p_user_id;
    did_add := true;
  end if;
  return jsonb_build_object('added',did_add,'word',to_jsonb(selected_word),
    'swipe',to_jsonb(kept)-'user_id'-'position',
    'srs',(select to_jsonb(s)-'user_id'-'word_id' from public.learner_srs s where user_id=p_user_id and word_id=p_word_id),
    'learned',exists(select 1 from public.learner_word_marks where user_id=p_user_id and word_id=p_word_id));
end;
$$;
revoke all on function public.keep_topic_word(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.keep_topic_word(uuid,text,text,text) to service_role;

create or replace function public.import_learner_progress(p_user_id uuid, p_data jsonb, p_skip_existing boolean default false)
returns boolean language plpgsql set search_path = '' as $$
declare changes jsonb; item jsonb; component text;
begin
  -- Refuse unfamiliar fields instead of silently losing data during a migration
  -- or import from a different application version.
  if p_data - array['user','swipes','known','learned','srs','weights','reviews','sessions'] <> '{}'::jsonb
    or (p_data->'user') - array['name','level','swipe_count','drop_streak','cards_in_bucket',
      'current_topic','affinity_below','affinity_above','level_bias'] <> '{}'::jsonb then
    raise exception 'Unrecognized learner fields; import refused';
  end if;
  foreach component in array array['swipes','reviews','sessions'] loop
    for item in select value from jsonb_array_elements(p_data->component) loop
      if item - (case component
        when 'swipes' then array['id','word_id','activity_id','sentence_id','action','drop_reason','swiped_at','planted_at']
        when 'reviews' then array['id','word_id','grade','reviewed_at','track']
        else array['id','started_at','last_beat_at','seconds'] end) <> '{}'::jsonb then
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
  insert into public.learner_sessions
    select p_user_id, e.ordinality-1, r.id,r.started_at,r.last_beat_at,r.seconds
    from jsonb_array_elements(p_data->'sessions') with ordinality e(value,ordinality),
      lateral jsonb_populate_record(null::public.learner_sessions,e.value) r;
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
    'weights','{}'::jsonb,'reviews','[]'::jsonb,'sessions','[]'::jsonb))
    into result from public.learner_profiles p where p.user_id=p_user_id;
  return result;
end;
$$;
revoke all on function public.load_scoped_progress(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.load_scoped_progress(uuid,text,text,boolean) to service_role;

-- Menu/reading/conversation need counts, not vocabulary or scheduling history.
create or replace function public.load_practice_summary(p_user_id uuid, p_topic text default '')
returns jsonb language sql stable set search_path = '' as $$
  with decisions as materialized (
    select distinct on (d.word_id) d.word_id, d.planted_at
    from public.learner_decisions d join public.words w on w.id=d.word_id
    where d.user_id=p_user_id and d.action='keep'
    order by d.word_id, d.position
  ), kept as (
    select d.word_id,d.planted_at from decisions d where not exists(select 1 from public.learner_word_marks m where m.user_id=p_user_id and m.word_id=d.word_id)
    union
    select m.word_id, '1970-01-01'::timestamptz from public.learner_word_marks m join public.words w on w.id=m.word_id where m.user_id=p_user_id
  )
  select jsonb_build_object(
    'topic_exists', exists(select 1 from public.activities where id=p_topic),
    'all_plants', count(*) filter (where planted_at is not null),
    'counts', jsonb_build_object(
      'seeds', count(*) filter (where planted_at is null),
      'plants', count(*) filter (where planted_at is not null and (p_topic='' or exists (
        select 1 from public.word_activities wa where wa.word_id=kept.word_id and wa.activity_id=p_topic)))))
  from kept;
$$;
revoke all on function public.load_practice_summary(uuid,text) from public, anon, authenticated;
grant execute on function public.load_practice_summary(uuid,text) to service_role;

create or replace function public.save_matcher_progress(p_user_id uuid, p_version bigint, p_user jsonb, p_swipes jsonb, p_known jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare changes jsonb;
begin
  update public.learner_profiles set version=version+1, updated_at=now() where user_id=p_user_id and version=p_version;
  if not found then return false; end if;
  if (select count(*) from public.learner_decisions d where user_id=p_user_id and action='keep' and planted_at is null
      and not exists(select 1 from public.learner_word_marks m where m.user_id=p_user_id and m.word_id=d.word_id))
      + (select count(*) from jsonb_array_elements(p_swipes) s where s->>'action'='keep') > 20 then
    raise exception 'Seed bag is full';
  end if;
  if exists (select 1 from jsonb_array_elements(p_swipes) s where
    exists (select 1 from public.learner_decisions d where d.user_id=p_user_id and d.word_id=s->>'word_id') or
    exists (select 1 from public.learner_word_marks m where m.user_id=p_user_id and m.word_id=s->>'word_id')) then
    raise exception 'Word already handled';
  end if;
  changes := jsonb_build_object('user',p_user,
    'swipes',coalesce((select jsonb_agg(value || jsonb_build_object('position',
      coalesce((select max(position)+1 from public.learner_decisions where user_id=p_user_id),0)+ordinality-1))
      from jsonb_array_elements(p_swipes) with ordinality),'[]'),
    'marks',coalesce((select jsonb_agg(jsonb_build_object('kind','known','word_id',value,'position',
      coalesce((select max(position)+1 from public.learner_word_marks where user_id=p_user_id and kind='known'),0)+ordinality-1))
      from jsonb_array_elements(p_known) with ordinality),'[]'));
  perform public.apply_learner_changes(p_user_id,changes);
  return true;
end;
$$;

commit;
