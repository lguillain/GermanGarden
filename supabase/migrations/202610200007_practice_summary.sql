-- Menu/reading/conversation need counts, not vocabulary or scheduling history.
create function public.load_practice_summary(p_user_id uuid, p_topic text default '')
returns jsonb language sql stable set search_path = '' as $$
  with kept as materialized (
    select distinct on (d.word_id) d.word_id, d.planted_at
    from public.learner_decisions d join public.words w on w.id=d.word_id
    where d.user_id=p_user_id and d.action='keep'
    order by d.word_id, d.position
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
