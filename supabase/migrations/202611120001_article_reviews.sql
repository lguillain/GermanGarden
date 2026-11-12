-- Independent article learning; existing vocabulary progress is preserved.
begin;
alter table public.learner_srs add column article public.review_schedule;
alter table public.learner_reviews drop constraint learner_reviews_track_check;
alter table public.learner_reviews add constraint learner_reviews_track_check check (track in ('recognition','production','article'));
update public.learner_srs s set article=row(2.5,0,0,0,'learning',now(),null,null)::public.review_schedule
from public.words w where w.id=s.word_id and w.pos='noun' and w.article in ('der','die','das')
and not exists(select 1 from public.learner_word_marks m where m.user_id=s.user_id and m.word_id=s.word_id);
drop function public.load_review_selection(uuid,text,text,timestamptz,text[]);
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
      affinity_above = (p_changes->'user'->>'affinity_above')::numeric
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
        then row(2.5,0,0,0,'learning',now(),null,null)::public.review_schedule end), r.article
    from jsonb_each(coalesce(p_changes->'srs','{}')) e,
      lateral jsonb_populate_record(null::public.learner_srs, e.value) r
    on conflict (user_id,word_id) do update set ease=excluded.ease,
      interval_days=excluded.interval_days, reps=excluded.reps, lapses=excluded.lapses,
      state=excluded.state, due_at=excluded.due_at, last_grade=excluded.last_grade,
      last_review_at=excluded.last_review_at, production=excluded.production, article=excluded.article;
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

create or replace function public.import_learner_progress(p_user_id uuid, p_data jsonb, p_skip_existing boolean default false)
returns boolean language plpgsql set search_path = '' as $$
declare changes jsonb; item jsonb; component text;
begin
  -- Refuse unfamiliar fields instead of silently losing data during a migration
  -- or import from a different application version.
  if p_data - array['user','swipes','known','learned','srs','weights','reviews'] <> '{}'::jsonb
    or (p_data->'user') - array['name','level','swipe_count','drop_streak','cards_in_bucket',
      'current_topic','affinity_below','affinity_above'] <> '{}'::jsonb then
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
    if item - array['ease','interval_days','reps','lapses','state','due_at','last_grade','last_review_at','production','article'] <> '{}'::jsonb then
      raise exception 'Unrecognized spaced repetition fields; import refused';
    end if;
    if item->'production' is not null and item->'production' <> 'null'::jsonb and
      (jsonb_typeof(item->'production') <> 'object' or
       (item->'production') - array['ease','interval_days','reps','lapses','state','due_at','last_grade','last_review_at'] <> '{}'::jsonb) then
      raise exception 'Unrecognized production schedule fields; import refused';
    end if;
    if item->'article' is not null and item->'article' <> 'null'::jsonb and
      (jsonb_typeof(item->'article') <> 'object' or
       (item->'article') - array['ease','interval_days','reps','lapses','state','due_at','last_grade','last_review_at'] <> '{}'::jsonb) then
      raise exception 'Unrecognized article schedule fields; import refused';
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

create function public.load_review_selection(
  p_user_id uuid, p_scope text default 'all', p_topic text default '',
  p_now timestamptz default now(), p_excluded text[] default '{}', p_mode text default 'mixed'
) returns jsonb language sql stable set search_path = '' as $$
  with kept as materialized (
    -- Match the domain's first keep, including imported duplicate decisions.
    select distinct on (d.word_id) d.* from public.learner_decisions d
    where d.user_id=p_user_id and d.action='keep'
    order by d.word_id, d.position
  ), candidates as materialized (
    select w.id, to_jsonb(w) as word,
      (s.word_id is null or s.due_at <= p_now) as recognition_due,
      ((s.production).due_at <= p_now) as production_due,
      (w.pos='noun' and w.article in ('der','die','das') and (s.article is null or (s.article).due_at <= p_now)) as article_due,
      to_jsonb(d)-'user_id'-'position' as swipe,
      case when s.word_id is not null then to_jsonb(s)-'user_id'-'word_id' end as srs,
      d.planted_at is null as seed, s.word_id is not null as scheduled, s.due_at,
      exists (select 1 from public.word_activities wa
        where wa.word_id=w.id and wa.activity_id=p_topic) as in_topic
    from kept d join public.words w on w.id=d.word_id
    left join public.learner_srs s on s.user_id=p_user_id and s.word_id=w.id
    where not exists (select 1 from public.learner_word_marks m
        where m.user_id=p_user_id and m.word_id=w.id)
  ), eligible as materialized (
    select * from candidates where case p_mode
      when 'recognition' then recognition_due when 'production' then production_due
      when 'article' then article_due when 'mixed' then recognition_due or production_due or article_due
      else false end
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
    'mode_counts', (select jsonb_build_object('recognition',count(*) filter(where recognition_due),
      'production',count(*) filter(where production_due),'article',count(*) filter(where article_due))
      from candidates where case p_scope when 'bag' then seed when 'all' then not seed
        when 'topic' then not seed and in_topic else false end),
    'counts', jsonb_build_object(
      'plants', (select count(*) from candidates where (recognition_due or production_due or article_due) and not seed and (p_topic='' or in_topic)),
      'seeds', (select count(*) from candidates where (recognition_due or production_due or article_due) and seed))
  );
$$;
revoke all on function public.load_review_selection(uuid,text,text,timestamptz,text[],text) from public, anon, authenticated;
grant execute on function public.load_review_selection(uuid,text,text,timestamptz,text[],text) to service_role;


commit;
