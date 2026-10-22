-- Remove unused discovery state; affinity weights continue to control level sampling.
begin;

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

alter table public.learner_profiles drop column level_bias;

commit;
