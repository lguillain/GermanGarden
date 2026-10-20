-- Return one aggregate object so a cold function needs one request, regardless
-- of PostgREST's row limit. List screens never fetch example sentences.
create function public.load_garden_catalog(
  p_topic text default null,
  p_include_sentences boolean default true,
  p_activities_only boolean default false
) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'activities', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.activities a),'[]'),
    'words', case when p_activities_only then '[]'::jsonb else
      coalesce((select jsonb_agg(to_jsonb(w) order by w.id) from public.words w
        where p_topic is null or exists (select 1 from public.word_activities wa
          where wa.word_id=w.id and wa.activity_id=p_topic)),'[]') end,
    'word_activities', case when p_activities_only then '[]'::jsonb else
      coalesce((select jsonb_agg(to_jsonb(wa) order by wa.word_id,wa.activity_id)
        from public.word_activities wa where p_topic is null or wa.activity_id=p_topic),'[]') end,
    'sentences', case when not p_include_sentences or p_activities_only then '[]'::jsonb else
      coalesce((select jsonb_agg(to_jsonb(s)-'source'-'tatoeba_id' order by s.id) from public.sentences s
        where p_topic is null or exists (select 1 from public.word_activities wa
          where wa.word_id=s.word_id and wa.activity_id=p_topic)),'[]') end
  );
$$;
revoke all on function public.load_garden_catalog(text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.load_garden_catalog(text,boolean,boolean) to service_role;
