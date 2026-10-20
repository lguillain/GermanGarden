-- Review reads return one card and counts from a single database snapshot.
-- Only the backend may supply the authenticated learner ID.
create function public.load_review_selection(
  p_user_id uuid, p_scope text default 'all', p_topic text default '',
  p_now timestamptz default now()
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
    where (s.word_id is null or s.due_at <= p_now)
      and not exists (select 1 from public.learner_word_marks m
        where m.user_id=p_user_id and m.word_id=w.id)
  ), scoped as (
    select * from eligible where case p_scope
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
revoke all on function public.load_review_selection(uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.load_review_selection(uuid,text,text,timestamptz) to service_role;
