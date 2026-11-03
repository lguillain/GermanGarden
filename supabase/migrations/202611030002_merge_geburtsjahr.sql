-- Merge the malformed import into its canonical noun, including private progress.
begin;
lock table public.learner_profiles in share row exclusive mode;
lock table public.learner_decisions, public.learner_word_marks, public.learner_srs,
  public.learner_reviews in share row exclusive mode;

-- Abort instead of deleting references if the canonical vocabulary is absent.
do $$ begin
  if exists(select 1 from public.words where id='other_geburts_jahr')
    and not exists(select 1 from public.words where id='noun_geburtsjahr') then
    raise exception 'Missing canonical Geburtsjahr';
  end if;
end $$;

create temporary table merged_users on commit drop as
select user_id from public.learner_decisions where word_id='other_geburts_jahr'
union select user_id from public.learner_word_marks where word_id='other_geburts_jahr'
union select user_id from public.learner_srs where word_id='other_geburts_jahr'
union select user_id from public.learner_reviews where word_id='other_geburts_jahr';

-- Recognition and production each retain their most recently reviewed schedule.
-- Canonical wins ties. Keep every review event in the audit history.
create temporary table merged_srs on commit drop as
select distinct on (s.user_id) s.* from public.learner_srs s
where s.word_id in ('other_geburts_jahr','noun_geburtsjahr')
  and s.user_id in (select user_id from merged_users)
order by s.user_id, s.last_review_at desc nulls last, s.word_id;
update merged_srs m set production=(
  select s.production from public.learner_srs s where s.user_id=m.user_id
    and s.word_id in ('other_geburts_jahr','noun_geburtsjahr') and s.production is distinct from null
  order by (s.production).last_review_at desc nulls last, s.word_id limit 1
), word_id='noun_geburtsjahr';
delete from public.learner_srs where word_id in ('other_geburts_jahr','noun_geburtsjahr')
  and user_id in (select user_id from merged_users);
insert into public.learner_srs select * from merged_srs;

update public.learner_decisions set word_id='noun_geburtsjahr' where word_id='other_geburts_jahr';
-- Any planted copy means the merged word is planted, including for first-keep readers.
update public.learner_decisions d set planted_at=p.planted_at from (
  select user_id,min(planted_at) planted_at from public.learner_decisions
  where word_id='noun_geburtsjahr' and action='keep' group by user_id
) p where d.user_id=p.user_id and d.user_id in (select user_id from merged_users)
  and d.word_id='noun_geburtsjahr' and d.action='keep' and d.planted_at is null;
update public.learner_reviews set word_id='noun_geburtsjahr' where word_id='other_geburts_jahr';
update public.learner_word_marks set word_id='noun_geburtsjahr' where word_id='other_geburts_jahr';
delete from public.learner_word_marks a using public.learner_word_marks b
where a.user_id=b.user_id and a.kind=b.kind and a.word_id=b.word_id
  and a.word_id='noun_geburtsjahr' and a.position>b.position
  and a.user_id in (select user_id from merged_users);
update public.learner_profiles set version=version+1,updated_at=now()
where user_id in (select user_id from merged_users);

insert into public.word_activities
select 'noun_geburtsjahr',activity_id,relevance from public.word_activities where word_id='other_geburts_jahr'
on conflict(word_id,activity_id) do update set relevance=greatest(word_activities.relevance,excluded.relevance);
update public.sentences set word_id='noun_geburtsjahr' where word_id='other_geburts_jahr';
insert into public.word_associations
select case when word_id='other_geburts_jahr' then 'noun_geburtsjahr' else word_id end,
       case when related_id='other_geburts_jahr' then 'noun_geburtsjahr' else related_id end,rank
from public.word_associations
where (word_id='other_geburts_jahr' or related_id='other_geburts_jahr')
  and word_id not in ('other_geburts_jahr','noun_geburtsjahr')
  or (word_id='other_geburts_jahr' and related_id not in ('other_geburts_jahr','noun_geburtsjahr'))
on conflict(word_id,related_id) do update set rank=least(word_associations.rank,excluded.rank);
insert into public.verb_objects
select verb_id,'noun_geburtsjahr',phrase from public.verb_objects where noun_id='other_geburts_jahr'
on conflict(verb_id,noun_id) do nothing;
delete from public.words where id='other_geburts_jahr';
commit;
