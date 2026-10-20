-- Add one topic word without transferring the catalogue or learner snapshot.
-- All progress writers share the profile lock and version counter.
create function public.keep_topic_word(p_user_id uuid, p_name text, p_word_id text, p_topic text)
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
  select * into kept from public.learner_decisions
    where user_id=p_user_id and word_id=p_word_id and action='keep' order by position limit 1;
  if not found then
    -- Use the seed-bag index. Honour the first keep for imported duplicates,
    -- ignore removed vocabulary, and stop as soon as the bag is full.
    if (select count(*) from (
      select d.word_id from public.learner_decisions d
      join public.words w on w.id=d.word_id
      where d.user_id=p_user_id and d.action='keep' and d.planted_at is null
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
