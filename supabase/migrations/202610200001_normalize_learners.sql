-- All data is copied and checked before the legacy document table is removed.
-- Deploy the matching garden function immediately after this migration.
begin;
lock table public.learner_state in access exclusive mode;

create table public.learner_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  version bigint not null default 0,
  name text not null, level text,
  swipe_count integer not null default 0, drop_streak integer not null default 0,
  cards_in_bucket integer not null default 0, current_topic text,
  affinity_below numeric not null default 1,
  affinity_above numeric not null default 1, level_bias numeric not null default 0,
  updated_at timestamptz not null default now()
);
create table public.learner_decisions (
  user_id uuid not null references public.learner_profiles on delete cascade,
  position integer not null, id bigint,
  word_id text not null, activity_id text, sentence_id bigint,
  action text not null check (action in ('keep','drop')), drop_reason text,
  swiped_at timestamptz not null, planted_at timestamptz,
  primary key (user_id, position)
);
create index on public.learner_decisions(user_id, word_id);
create table public.learner_word_marks (
  user_id uuid not null references public.learner_profiles on delete cascade,
  kind text not null check (kind in ('known','learned')), position integer not null,
  word_id text not null, primary key (user_id, kind, position)
);
create table public.learner_srs (
  user_id uuid not null references public.learner_profiles on delete cascade,
  word_id text not null, ease numeric not null, interval_days numeric not null,
  reps integer not null, lapses integer not null, state text not null,
  due_at timestamptz, last_grade integer, last_review_at timestamptz,
  primary key (user_id, word_id)
);
create index on public.learner_srs(user_id, due_at);
create table public.learner_topic_weights (
  user_id uuid not null references public.learner_profiles on delete cascade,
  activity_id text not null, weight numeric not null,
  primary key (user_id, activity_id)
);
create table public.learner_reviews (
  user_id uuid not null references public.learner_profiles on delete cascade,
  position bigint not null, id bigint, word_id text not null,
  grade integer not null check (grade between 1 and 4), reviewed_at timestamptz not null,
  primary key (user_id, position)
);
create index on public.learner_reviews(user_id, word_id);
create table public.learner_sessions (
  user_id uuid not null references public.learner_profiles on delete cascade,
  position bigint not null, id bigint, started_at timestamptz not null,
  last_beat_at timestamptz not null, seconds integer not null check (seconds >= 0),
  primary key (user_id, position)
);
-- Vocabulary IDs intentionally have no foreign keys: historical progress must
-- survive vocabulary edits and imports, as it did in the original document.
alter table public.learner_profiles enable row level security;
create policy own_progress on public.learner_profiles for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learner_profiles from anon, authenticated;
grant select on public.learner_profiles to authenticated;
grant all on public.learner_profiles to service_role;
alter table public.learner_decisions enable row level security;
create policy own_progress on public.learner_decisions for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learner_decisions from anon, authenticated;
grant select on public.learner_decisions to authenticated;
grant all on public.learner_decisions to service_role;
alter table public.learner_word_marks enable row level security;
create policy own_progress on public.learner_word_marks for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learner_word_marks from anon, authenticated;
grant select on public.learner_word_marks to authenticated;
grant all on public.learner_word_marks to service_role;
alter table public.learner_srs enable row level security;
create policy own_progress on public.learner_srs for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learner_srs from anon, authenticated;
grant select on public.learner_srs to authenticated;
grant all on public.learner_srs to service_role;
alter table public.learner_topic_weights enable row level security;
create policy own_progress on public.learner_topic_weights for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learner_topic_weights from anon, authenticated;
grant select on public.learner_topic_weights to authenticated;
grant all on public.learner_topic_weights to service_role;
alter table public.learner_reviews enable row level security;
create policy own_progress on public.learner_reviews for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learner_reviews from anon, authenticated;
grant select on public.learner_reviews to authenticated;
grant all on public.learner_reviews to service_role;
alter table public.learner_sessions enable row level security;
create policy own_progress on public.learner_sessions for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.learner_sessions from anon, authenticated;
grant select on public.learner_sessions to authenticated;
grant all on public.learner_sessions to service_role;

-- JSON is only an RPC transport format; every persisted value is a typed column.
-- Caller holds the profile lock, so append positions and bag changes are atomic.
create function public.apply_learner_changes(p_user_id uuid, p_changes jsonb)
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
      r.due_at, r.last_grade, r.last_review_at
    from jsonb_each(coalesce(p_changes->'srs','{}')) e,
      lateral jsonb_populate_record(null::public.learner_srs, e.value) r
    on conflict (user_id,word_id) do update set ease=excluded.ease,
      interval_days=excluded.interval_days, reps=excluded.reps, lapses=excluded.lapses,
      state=excluded.state, due_at=excluded.due_at, last_grade=excluded.last_grade,
      last_review_at=excluded.last_review_at;
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
      r.id, r.word_id, r.grade, r.reviewed_at
    from jsonb_array_elements(coalesce(p_changes->'reviews','[]')) with ordinality e(value,ordinality),
      lateral jsonb_populate_record(null::public.learner_reviews,e.value) r;
end;
$$;

create function public.save_learner_progress(p_user_id uuid, p_version bigint, p_changes jsonb)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.learner_profiles set version=version+1, updated_at=now()
    where user_id=p_user_id and version=p_version;
  if not found then return false; end if;
  perform public.apply_learner_changes(p_user_id,p_changes);
  return true;
end;
$$;

create function public.learner_time(p_user_id uuid, p_now timestamptz default now())
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'today_seconds', coalesce(sum(seconds) filter (where
      (started_at at time zone 'UTC')::date=(p_now at time zone 'UTC')::date or
      (last_beat_at at time zone 'UTC')::date=(p_now at time zone 'UTC')::date),0),
    'total_seconds', coalesce(sum(seconds),0),
    'current_session_seconds', coalesce((select seconds from public.learner_sessions
      where user_id=p_user_id order by position desc limit 1),0), 'timer_seconds',300)
  from public.learner_sessions where user_id=p_user_id;
$$;

create function public.heartbeat_learner(p_user_id uuid, p_name text, p_now timestamptz default now())
returns jsonb language plpgsql set search_path = '' as $$
declare last_session public.learner_sessions; gap integer;
begin
  insert into public.learner_profiles(user_id,name) values (p_user_id,p_name) on conflict do nothing;
  -- The same lock serializes heartbeats, but timer writes do not invalidate a
  -- review's progress version: they touch independent rows.
  perform 1 from public.learner_profiles where user_id=p_user_id for update;
  select * into last_session from public.learner_sessions where user_id=p_user_id order by position desc limit 1;
  gap := floor(extract(epoch from p_now-last_session.last_beat_at));
  if last_session.user_id is not null and gap <= 90 then
    update public.learner_sessions set seconds=seconds+greatest(0,gap),last_beat_at=p_now
      where user_id=p_user_id and position=last_session.position;
  else
    insert into public.learner_sessions(user_id,position,started_at,last_beat_at,seconds)
      values(p_user_id,coalesce(last_session.position+1,0),p_now,p_now,0);
  end if;
  return public.learner_time(p_user_id,p_now);
end;
$$;

create function public.load_learner_progress(p_user_id uuid, p_name text)
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
    'reviews','[]'::jsonb,'sessions','[]'::jsonb,'time_summary',public.learner_time(p_user_id)))
    into result from public.learner_profiles p where user_id=p_user_id;
  return result;
end;
$$;

create function public.import_learner_progress(p_user_id uuid, p_data jsonb, p_skip_existing boolean default false)
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
        when 'reviews' then array['id','word_id','grade','reviewed_at']
        else array['id','started_at','last_beat_at','seconds'] end) <> '{}'::jsonb then
        raise exception 'Unrecognized history fields; import refused';
      end if;
    end loop;
  end loop;
  for item in select value from jsonb_each(p_data->'srs') loop
    if item - array['ease','interval_days','reps','lapses','state','due_at','last_grade','last_review_at'] <> '{}'::jsonb then
      raise exception 'Unrecognized spaced repetition fields; import refused';
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
revoke all on function public.apply_learner_changes(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.apply_learner_changes(uuid,jsonb) to service_role;
revoke all on function public.save_learner_progress(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.save_learner_progress(uuid,bigint,jsonb) to service_role;
revoke all on function public.learner_time(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.learner_time(uuid,timestamptz) to service_role;
revoke all on function public.heartbeat_learner(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.heartbeat_learner(uuid,text,timestamptz) to service_role;
revoke all on function public.load_learner_progress(uuid,text) from public, anon, authenticated;
grant execute on function public.load_learner_progress(uuid,text) to service_role;
revoke all on function public.import_learner_progress(uuid,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.import_learner_progress(uuid,jsonb,boolean) to service_role;

-- Copy under the exclusive lock so the old function cannot write mid-migration.
do $$
declare old record; copied jsonb; expected jsonb;
begin
  for old in select * from public.learner_state loop
    perform public.import_learner_progress(old.user_id,old.data);
    update public.learner_profiles set version=old.version,updated_at=old.updated_at where user_id=old.user_id;
    copied := public.load_learner_progress(old.user_id,'Learner')->'data';
    if copied->'user' is distinct from old.data->'user'
      or copied->'known' is distinct from old.data->'known'
      or copied->'learned' is distinct from old.data->'learned'
      or copied->'weights' is distinct from old.data->'weights' then
      raise exception 'Learner migration validation failed';
    end if;
    -- Compare full typed rows (including order and optional legacy IDs), not
    -- only counts. Timestamp casts account for equivalent ISO representations.
    select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('user_id',old.user_id,'position',e.ordinality-1) order by e.ordinality),'[]')
      into expected from jsonb_array_elements(old.data->'swipes') with ordinality e(value,ordinality),
      lateral jsonb_populate_record(null::public.learner_decisions,e.value) r;
    if expected is distinct from (select coalesce(jsonb_agg(to_jsonb(d) order by position),'[]') from public.learner_decisions d where user_id=old.user_id) then
      raise exception 'Decision migration validation failed';
    end if;
    select coalesce(jsonb_object_agg(e.key,to_jsonb(r) || jsonb_build_object('user_id',old.user_id,'word_id',e.key)),'{}') into expected
      from jsonb_each(old.data->'srs') e, lateral jsonb_populate_record(null::public.learner_srs,e.value) r;
    if expected is distinct from (select coalesce(jsonb_object_agg(word_id,to_jsonb(s)),'{}') from public.learner_srs s where user_id=old.user_id) then
      raise exception 'Spaced repetition migration validation failed';
    end if;
    select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('user_id',old.user_id,'position',e.ordinality-1) order by e.ordinality),'[]')
      into expected from jsonb_array_elements(old.data->'reviews') with ordinality e(value,ordinality),
      lateral jsonb_populate_record(null::public.learner_reviews,e.value) r;
    if expected is distinct from (select coalesce(jsonb_agg(to_jsonb(r) order by position),'[]') from public.learner_reviews r where user_id=old.user_id) then
      raise exception 'Review migration validation failed';
    end if;
    select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('user_id',old.user_id,'position',e.ordinality-1) order by e.ordinality),'[]')
      into expected from jsonb_array_elements(old.data->'sessions') with ordinality e(value,ordinality),
      lateral jsonb_populate_record(null::public.learner_sessions,e.value) r;
    if expected is distinct from (select coalesce(jsonb_agg(to_jsonb(s) order by position),'[]') from public.learner_sessions s where user_id=old.user_id) then
      raise exception 'Study session migration validation failed';
    end if;
  end loop;
  if (select count(*) from public.learner_profiles) <> (select count(*) from public.learner_state) then
    raise exception 'Learner count validation failed';
  end if;
end;
$$;
drop function public.save_learner_state(uuid,bigint,jsonb);
drop table public.learner_state;
commit;
