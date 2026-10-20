-- The practice menu needs only kept words and their topic memberships.
-- IDs come from the authenticated learner snapshot in the backend; the
-- catalogue itself contains only shared vocabulary, never learner progress.
create function public.load_practice_catalog(p_word_ids text[])
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'activities', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.activities a),'[]'),
    'words', coalesce((select jsonb_agg(to_jsonb(w) order by w.id) from public.words w where w.id=any(p_word_ids)),'[]'),
    'word_activities', coalesce((select jsonb_agg(to_jsonb(wa) order by wa.word_id,wa.activity_id)
      from public.word_activities wa where wa.word_id=any(p_word_ids)),'[]'),
    'sentences', '[]'::jsonb
  );
$$;
revoke all on function public.load_practice_catalog(text[]) from public, anon, authenticated;
grant execute on function public.load_practice_catalog(text[]) to service_role;
