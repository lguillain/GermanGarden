-- Discovery needs seen IDs and the seed bag, not planted-word details or time.
create function public.load_matcher_progress(p_user_id uuid, p_name text)
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
    'weights','{}'::jsonb,'reviews','[]'::jsonb,'sessions','[]'::jsonb))
    into result from public.learner_profiles p where p.user_id=p_user_id;
  return result;
end;
$$;

-- Reuse the profile version/lock used by reviews and imports. Only append the
-- current decision and new known marks; never diff a partial snapshot as full data.
create function public.save_matcher_progress(p_user_id uuid, p_version bigint, p_user jsonb, p_swipes jsonb, p_known jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare changes jsonb;
begin
  update public.learner_profiles set version=version+1, updated_at=now() where user_id=p_user_id and version=p_version;
  if not found then return false; end if;
  if (select count(*) from public.learner_decisions where user_id=p_user_id and action='keep' and planted_at is null)
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
revoke all on function public.load_matcher_progress(uuid,text) from public, anon, authenticated;
revoke all on function public.save_matcher_progress(uuid,bigint,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.load_matcher_progress(uuid,text) to service_role;
grant execute on function public.save_matcher_progress(uuid,bigint,jsonb,jsonb,jsonb) to service_role;
