-- Reviewed non-noun corrections; new split senses start unseen.
begin;
UPDATE public.words SET lemma='verboten sein',pos='verb',english='to be forbidden' WHERE id='other_verbieten_verboten_sein';
UPDATE public.words SET lemma='in Rente gehen',pos='verb',english='to retire' WHERE id='other_in_rente_gehen_sein';
UPDATE public.words SET lemma='in Pension gehen',pos='verb',english='to retire' WHERE id='other_in_pension_gehen_sein_d';
UPDATE public.words SET lemma='pensioniert werden',pos='verb',english='to retire' WHERE id='other_pensioniert_werden_sein_d';
UPDATE public.words SET lemma='dafür sein',pos='verb',english='to be in favor' WHERE id='verb_dafur_dagegen_sein';
UPDATE public.words SET lemma='zurückfahren',pos='verb',english='to drive back' WHERE id='verb_zuruck_fahren';
UPDATE public.words SET lemma='außen',pos='adv',english='outside' WHERE id='verb_aussen';
UPDATE public.words SET lemma='dagegen',pos='adv',english='against it' WHERE id='verb_dagegen';
UPDATE public.words SET lemma='daneben',pos='adv',english='beside / next to' WHERE id='verb_daneben';
UPDATE public.words SET lemma='deswegen',pos='adv',english='therefore' WHERE id='verb_deswegen';
UPDATE public.words SET lemma='draußen',pos='adv',english='outside' WHERE id='verb_draussen';
UPDATE public.words SET lemma='drinnen',pos='adv',english='inside' WHERE id='verb_drinnen';
UPDATE public.words SET lemma='drüben',pos='adv',english='over there' WHERE id='verb_druben';
UPDATE public.words SET lemma='eben',pos='adv',english='just / even' WHERE id='verb_eben';
UPDATE public.words SET lemma='gern',pos='adv',english='gladly / willingly' WHERE id='verb_gern';
UPDATE public.words SET lemma='gestern',pos='adv',english='yesterday' WHERE id='verb_gestern';
UPDATE public.words SET lemma='hinten',pos='adv',english='at the back / behind' WHERE id='verb_hinten';
UPDATE public.words SET lemma='innen',pos='adv',english='inside' WHERE id='verb_innen';
UPDATE public.words SET lemma='inzwischen',pos='adv',english='meanwhile' WHERE id='verb_inzwischen';
UPDATE public.words SET lemma='meinetwegen',pos='adv',english='for my sake' WHERE id='verb_meinetwegen';
UPDATE public.words SET lemma='mitten',pos='adv',english='in the middle' WHERE id='verb_mitten';
UPDATE public.words SET lemma='morgen',pos='adv',english='tomorrow' WHERE id='verb_morgen';
UPDATE public.words SET lemma='oben',pos='adv',english='above / upstairs' WHERE id='verb_oben';
UPDATE public.words SET lemma='unten',pos='adv',english='below / downstairs' WHERE id='verb_unten';
UPDATE public.words SET lemma='vorgestern',pos='adv',english='day before yesterday' WHERE id='verb_vorgestern';
UPDATE public.words SET lemma='zusammen',pos='adv',english='together' WHERE id='verb_zusammen';
UPDATE public.words SET lemma='übermorgen',pos='adv',english='day after tomorrow' WHERE id='verb_ubermorgen';
UPDATE public.words SET lemma='gegen',pos='prep',english='against / toward' WHERE id='verb_gegen';
UPDATE public.words SET lemma='wegen',pos='prep',english='because of' WHERE id='verb_wegen';
UPDATE public.words SET lemma='zwischen',pos='prep',english='between' WHERE id='verb_zwischen';
UPDATE public.words SET lemma='sondern',pos='conj',english='but / but rather' WHERE id='verb_sondern';
UPDATE public.words SET lemma='betrunken',pos='adj',english='drunk' WHERE id='verb_betrunken';
UPDATE public.words SET lemma='einzeln',pos='adj',english='individual / separately' WHERE id='verb_einzeln';
UPDATE public.words SET lemma='entschlossen',pos='adj',english='determined / resolved' WHERE id='verb_entschlossen';
UPDATE public.words SET lemma='geboren',pos='adj',english='born' WHERE id='verb_geboren';
UPDATE public.words SET lemma='geschieden',pos='adj',english='divorced' WHERE id='verb_geschieden';
UPDATE public.words SET lemma='geschlossen',pos='adj',english='closed' WHERE id='verb_geschlossen';
UPDATE public.words SET lemma='unentschieden',pos='adj',english='undecided' WHERE id='verb_unentschieden';
UPDATE public.words SET lemma='verboten',pos='adj',english='forbidden / prohibited' WHERE id='verb_verboten';
UPDATE public.words SET lemma='verschieden',pos='adj',english='different' WHERE id='verb_verschieden';
UPDATE public.words SET lemma='willkommen',pos='adj',english='welcome' WHERE id='verb_willkommen';
UPDATE public.words SET lemma='zufrieden',pos='adj',english='satisfied' WHERE id='verb_zufrieden';
UPDATE public.words SET lemma='bisschen',pos='other',english='a little bit' WHERE id='verb_bisschen';
UPDATE public.words SET lemma='ein bisschen',pos='other',english='a little' WHERE id='verb_ein_bisschen';
UPDATE public.words SET lemma='im Freien',pos='other',english='outdoors' WHERE id='verb_im_freien';
UPDATE public.words SET lemma='gestorben',pos='other',english='died' WHERE id='verb_gestorben';
UPDATE public.words SET lemma='an sein',pos='verb',english='to be on' WHERE id='other_an_sein';
UPDATE public.words SET lemma='auf sein',pos='verb',english='to be up / open' WHERE id='other_auf_sein';
UPDATE public.words SET lemma='aus sein',pos='verb',english='to be off / out' WHERE id='other_aus_sein';
UPDATE public.words SET lemma='weg sein',pos='verb',english='to be away' WHERE id='other_weg_sein';
UPDATE public.words SET lemma='weh tun',pos='verb',english='to hurt' WHERE id='other_weh_tun';
INSERT INTO public.words(id,lemma,pos,english,level) SELECT 'verb_in_rente_sein','in Rente sein','verb','to be retired','B1' WHERE EXISTS (SELECT 1 FROM public.words WHERE id='other_in_rente_gehen_sein') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.word_activities SELECT 'verb_in_rente_sein',activity_id,relevance FROM public.word_activities WHERE word_id='other_in_rente_gehen_sein' ON CONFLICT DO NOTHING;
INSERT INTO public.words(id,lemma,pos,english,level) SELECT 'verb_in_pension_sein','in Pension sein','verb','to be retired','B1' WHERE EXISTS (SELECT 1 FROM public.words WHERE id='other_in_pension_gehen_sein_d') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.word_activities SELECT 'verb_in_pension_sein',activity_id,relevance FROM public.word_activities WHERE word_id='other_in_pension_gehen_sein_d' ON CONFLICT DO NOTHING;
INSERT INTO public.words(id,lemma,pos,english,level) SELECT 'verb_pensioniert_sein','pensioniert sein','verb','to be retired','B1' WHERE EXISTS (SELECT 1 FROM public.words WHERE id='other_pensioniert_werden_sein_d') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.word_activities SELECT 'verb_pensioniert_sein',activity_id,relevance FROM public.word_activities WHERE word_id='other_pensioniert_werden_sein_d' ON CONFLICT DO NOTHING;
INSERT INTO public.words(id,lemma,pos,english,level) SELECT 'verb_dagegen_sein','dagegen sein','verb','to be against','A2' WHERE EXISTS (SELECT 1 FROM public.words WHERE id='verb_dafur_dagegen_sein') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.word_activities SELECT 'verb_dagegen_sein',activity_id,relevance FROM public.word_activities WHERE word_id='verb_dafur_dagegen_sein' ON CONFLICT DO NOTHING;
INSERT INTO public.words(id,lemma,pos,english,level) SELECT 'verb_verbieten','verbieten','verb','to forbid','A2' WHERE EXISTS (SELECT 1 FROM public.words WHERE id='other_verbieten_verboten_sein') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.word_activities SELECT 'verb_verbieten',activity_id,relevance FROM public.word_activities WHERE word_id='other_verbieten_verboten_sein' ON CONFLICT DO NOTHING;
UPDATE public.sentences SET word_id='verb_in_rente_sein' WHERE id=5084;
UPDATE public.sentences SET word_id='verb_in_pension_sein' WHERE id=4887;
UPDATE public.sentences SET word_id='verb_pensioniert_sein' WHERE id=4889;
UPDATE public.sentences SET word_id='verb_dagegen_sein' WHERE id=6938;
UPDATE public.sentences SET word_id='verb_ausziehen' WHERE id=2270;
-- Merge the malformed import into its canonical noun, including private progress.
lock table public.learner_profiles in share row exclusive mode;
lock table public.learner_decisions, public.learner_word_marks, public.learner_srs,
  public.learner_reviews in share row exclusive mode;

-- Abort instead of deleting references if the canonical vocabulary is absent.
do $$ begin
  if exists(select 1 from public.words where id='verb_an_aus_ziehen')
    and not exists(select 1 from public.words where id='verb_anziehen') then
    raise exception 'Missing canonical verb_anziehen';
  end if;
end $$;

create temporary table merged_users_0 on commit drop as
select user_id from public.learner_decisions where word_id='verb_an_aus_ziehen'
union select user_id from public.learner_word_marks where word_id='verb_an_aus_ziehen'
union select user_id from public.learner_srs where word_id='verb_an_aus_ziehen'
union select user_id from public.learner_reviews where word_id='verb_an_aus_ziehen';

-- Recognition and production each retain their most recently reviewed schedule.
-- Canonical wins ties. Keep every review event in the audit history.
create temporary table merged_srs_0 on commit drop as
select distinct on (s.user_id) s.* from public.learner_srs s
where s.word_id in ('verb_an_aus_ziehen','verb_anziehen')
  and s.user_id in (select user_id from merged_users_0)
order by s.user_id, s.last_review_at desc nulls last, s.word_id;
update merged_srs_0 m set production=(
  select s.production from public.learner_srs s where s.user_id=m.user_id
    and s.word_id in ('verb_an_aus_ziehen','verb_anziehen') and s.production is distinct from null
  order by (s.production).last_review_at desc nulls last, s.word_id limit 1
), word_id='verb_anziehen';
delete from public.learner_srs where word_id in ('verb_an_aus_ziehen','verb_anziehen')
  and user_id in (select user_id from merged_users_0);
insert into public.learner_srs select * from merged_srs_0;

update public.learner_decisions set word_id='verb_anziehen' where word_id='verb_an_aus_ziehen';
-- Any planted copy means the merged word is planted, including for first-keep readers.
update public.learner_decisions d set planted_at=p.planted_at from (
  select user_id,min(planted_at) planted_at from public.learner_decisions
  where word_id='verb_anziehen' and action='keep' group by user_id
) p where d.user_id=p.user_id and d.user_id in (select user_id from merged_users_0)
  and d.word_id='verb_anziehen' and d.action='keep' and d.planted_at is null;
update public.learner_reviews set word_id='verb_anziehen' where word_id='verb_an_aus_ziehen';
update public.learner_word_marks set word_id='verb_anziehen' where word_id='verb_an_aus_ziehen';
delete from public.learner_word_marks a using public.learner_word_marks b
where a.user_id=b.user_id and a.kind=b.kind and a.word_id=b.word_id
  and a.word_id='verb_anziehen' and a.position>b.position
  and a.user_id in (select user_id from merged_users_0);
update public.learner_profiles set version=version+1,updated_at=now()
where user_id in (select user_id from merged_users_0);

insert into public.word_activities
select 'verb_anziehen',activity_id,relevance from public.word_activities where word_id='verb_an_aus_ziehen'
on conflict(word_id,activity_id) do update set relevance=greatest(word_activities.relevance,excluded.relevance);
update public.sentences set word_id='verb_anziehen' where word_id='verb_an_aus_ziehen';
insert into public.word_associations
select case when word_id='verb_an_aus_ziehen' then 'verb_anziehen' else word_id end,
       case when related_id='verb_an_aus_ziehen' then 'verb_anziehen' else related_id end,rank
from public.word_associations
where (word_id='verb_an_aus_ziehen' or related_id='verb_an_aus_ziehen')
  and word_id not in ('verb_an_aus_ziehen','verb_anziehen')
  or (word_id='verb_an_aus_ziehen' and related_id not in ('verb_an_aus_ziehen','verb_anziehen'))
on conflict(word_id,related_id) do update set rank=least(word_associations.rank,excluded.rank);
insert into public.verb_objects
select verb_id,'verb_anziehen',phrase from public.verb_objects where noun_id='verb_an_aus_ziehen'
on conflict(verb_id,noun_id) do nothing;
insert into public.verb_objects select 'verb_anziehen',noun_id,phrase from public.verb_objects where verb_id='verb_an_aus_ziehen' on conflict do nothing;
delete from public.words where id='verb_an_aus_ziehen';

-- Merge the malformed import into its canonical noun, including private progress.
lock table public.learner_profiles in share row exclusive mode;
lock table public.learner_decisions, public.learner_word_marks, public.learner_srs,
  public.learner_reviews in share row exclusive mode;

-- Abort instead of deleting references if the canonical vocabulary is absent.
do $$ begin
  if exists(select 1 from public.words where id='verb_ab_fahren')
    and not exists(select 1 from public.words where id='verb_abfahren') then
    raise exception 'Missing canonical verb_abfahren';
  end if;
end $$;

create temporary table merged_users_1 on commit drop as
select user_id from public.learner_decisions where word_id='verb_ab_fahren'
union select user_id from public.learner_word_marks where word_id='verb_ab_fahren'
union select user_id from public.learner_srs where word_id='verb_ab_fahren'
union select user_id from public.learner_reviews where word_id='verb_ab_fahren';

-- Recognition and production each retain their most recently reviewed schedule.
-- Canonical wins ties. Keep every review event in the audit history.
create temporary table merged_srs_1 on commit drop as
select distinct on (s.user_id) s.* from public.learner_srs s
where s.word_id in ('verb_ab_fahren','verb_abfahren')
  and s.user_id in (select user_id from merged_users_1)
order by s.user_id, s.last_review_at desc nulls last, s.word_id;
update merged_srs_1 m set production=(
  select s.production from public.learner_srs s where s.user_id=m.user_id
    and s.word_id in ('verb_ab_fahren','verb_abfahren') and s.production is distinct from null
  order by (s.production).last_review_at desc nulls last, s.word_id limit 1
), word_id='verb_abfahren';
delete from public.learner_srs where word_id in ('verb_ab_fahren','verb_abfahren')
  and user_id in (select user_id from merged_users_1);
insert into public.learner_srs select * from merged_srs_1;

update public.learner_decisions set word_id='verb_abfahren' where word_id='verb_ab_fahren';
-- Any planted copy means the merged word is planted, including for first-keep readers.
update public.learner_decisions d set planted_at=p.planted_at from (
  select user_id,min(planted_at) planted_at from public.learner_decisions
  where word_id='verb_abfahren' and action='keep' group by user_id
) p where d.user_id=p.user_id and d.user_id in (select user_id from merged_users_1)
  and d.word_id='verb_abfahren' and d.action='keep' and d.planted_at is null;
update public.learner_reviews set word_id='verb_abfahren' where word_id='verb_ab_fahren';
update public.learner_word_marks set word_id='verb_abfahren' where word_id='verb_ab_fahren';
delete from public.learner_word_marks a using public.learner_word_marks b
where a.user_id=b.user_id and a.kind=b.kind and a.word_id=b.word_id
  and a.word_id='verb_abfahren' and a.position>b.position
  and a.user_id in (select user_id from merged_users_1);
update public.learner_profiles set version=version+1,updated_at=now()
where user_id in (select user_id from merged_users_1);

insert into public.word_activities
select 'verb_abfahren',activity_id,relevance from public.word_activities where word_id='verb_ab_fahren'
on conflict(word_id,activity_id) do update set relevance=greatest(word_activities.relevance,excluded.relevance);
update public.sentences set word_id='verb_abfahren' where word_id='verb_ab_fahren';
insert into public.word_associations
select case when word_id='verb_ab_fahren' then 'verb_abfahren' else word_id end,
       case when related_id='verb_ab_fahren' then 'verb_abfahren' else related_id end,rank
from public.word_associations
where (word_id='verb_ab_fahren' or related_id='verb_ab_fahren')
  and word_id not in ('verb_ab_fahren','verb_abfahren')
  or (word_id='verb_ab_fahren' and related_id not in ('verb_ab_fahren','verb_abfahren'))
on conflict(word_id,related_id) do update set rank=least(word_associations.rank,excluded.rank);
insert into public.verb_objects
select verb_id,'verb_abfahren',phrase from public.verb_objects where noun_id='verb_ab_fahren'
on conflict(verb_id,noun_id) do nothing;
insert into public.verb_objects select 'verb_abfahren',noun_id,phrase from public.verb_objects where verb_id='verb_ab_fahren' on conflict do nothing;
delete from public.words where id='verb_ab_fahren';

-- Merge the malformed import into its canonical noun, including private progress.
lock table public.learner_profiles in share row exclusive mode;
lock table public.learner_decisions, public.learner_word_marks, public.learner_srs,
  public.learner_reviews in share row exclusive mode;

-- Abort instead of deleting references if the canonical vocabulary is absent.
do $$ begin
  if exists(select 1 from public.words where id='verb_ab_fliegen')
    and not exists(select 1 from public.words where id='verb_abfliegen') then
    raise exception 'Missing canonical verb_abfliegen';
  end if;
end $$;

create temporary table merged_users_2 on commit drop as
select user_id from public.learner_decisions where word_id='verb_ab_fliegen'
union select user_id from public.learner_word_marks where word_id='verb_ab_fliegen'
union select user_id from public.learner_srs where word_id='verb_ab_fliegen'
union select user_id from public.learner_reviews where word_id='verb_ab_fliegen';

-- Recognition and production each retain their most recently reviewed schedule.
-- Canonical wins ties. Keep every review event in the audit history.
create temporary table merged_srs_2 on commit drop as
select distinct on (s.user_id) s.* from public.learner_srs s
where s.word_id in ('verb_ab_fliegen','verb_abfliegen')
  and s.user_id in (select user_id from merged_users_2)
order by s.user_id, s.last_review_at desc nulls last, s.word_id;
update merged_srs_2 m set production=(
  select s.production from public.learner_srs s where s.user_id=m.user_id
    and s.word_id in ('verb_ab_fliegen','verb_abfliegen') and s.production is distinct from null
  order by (s.production).last_review_at desc nulls last, s.word_id limit 1
), word_id='verb_abfliegen';
delete from public.learner_srs where word_id in ('verb_ab_fliegen','verb_abfliegen')
  and user_id in (select user_id from merged_users_2);
insert into public.learner_srs select * from merged_srs_2;

update public.learner_decisions set word_id='verb_abfliegen' where word_id='verb_ab_fliegen';
-- Any planted copy means the merged word is planted, including for first-keep readers.
update public.learner_decisions d set planted_at=p.planted_at from (
  select user_id,min(planted_at) planted_at from public.learner_decisions
  where word_id='verb_abfliegen' and action='keep' group by user_id
) p where d.user_id=p.user_id and d.user_id in (select user_id from merged_users_2)
  and d.word_id='verb_abfliegen' and d.action='keep' and d.planted_at is null;
update public.learner_reviews set word_id='verb_abfliegen' where word_id='verb_ab_fliegen';
update public.learner_word_marks set word_id='verb_abfliegen' where word_id='verb_ab_fliegen';
delete from public.learner_word_marks a using public.learner_word_marks b
where a.user_id=b.user_id and a.kind=b.kind and a.word_id=b.word_id
  and a.word_id='verb_abfliegen' and a.position>b.position
  and a.user_id in (select user_id from merged_users_2);
update public.learner_profiles set version=version+1,updated_at=now()
where user_id in (select user_id from merged_users_2);

insert into public.word_activities
select 'verb_abfliegen',activity_id,relevance from public.word_activities where word_id='verb_ab_fliegen'
on conflict(word_id,activity_id) do update set relevance=greatest(word_activities.relevance,excluded.relevance);
update public.sentences set word_id='verb_abfliegen' where word_id='verb_ab_fliegen';
insert into public.word_associations
select case when word_id='verb_ab_fliegen' then 'verb_abfliegen' else word_id end,
       case when related_id='verb_ab_fliegen' then 'verb_abfliegen' else related_id end,rank
from public.word_associations
where (word_id='verb_ab_fliegen' or related_id='verb_ab_fliegen')
  and word_id not in ('verb_ab_fliegen','verb_abfliegen')
  or (word_id='verb_ab_fliegen' and related_id not in ('verb_ab_fliegen','verb_abfliegen'))
on conflict(word_id,related_id) do update set rank=least(word_associations.rank,excluded.rank);
insert into public.verb_objects
select verb_id,'verb_abfliegen',phrase from public.verb_objects where noun_id='verb_ab_fliegen'
on conflict(verb_id,noun_id) do nothing;
insert into public.verb_objects select 'verb_abfliegen',noun_id,phrase from public.verb_objects where verb_id='verb_ab_fliegen' on conflict do nothing;
delete from public.words where id='verb_ab_fliegen';

-- Merge the malformed import into its canonical noun, including private progress.
lock table public.learner_profiles in share row exclusive mode;
lock table public.learner_decisions, public.learner_word_marks, public.learner_srs,
  public.learner_reviews in share row exclusive mode;

-- Abort instead of deleting references if the canonical vocabulary is absent.
do $$ begin
  if exists(select 1 from public.words where id='verb_wer_wen')
    and not exists(select 1 from public.words where id='other_wer') then
    raise exception 'Missing canonical other_wer';
  end if;
end $$;

create temporary table merged_users_3 on commit drop as
select user_id from public.learner_decisions where word_id='verb_wer_wen'
union select user_id from public.learner_word_marks where word_id='verb_wer_wen'
union select user_id from public.learner_srs where word_id='verb_wer_wen'
union select user_id from public.learner_reviews where word_id='verb_wer_wen';

-- Recognition and production each retain their most recently reviewed schedule.
-- Canonical wins ties. Keep every review event in the audit history.
create temporary table merged_srs_3 on commit drop as
select distinct on (s.user_id) s.* from public.learner_srs s
where s.word_id in ('verb_wer_wen','other_wer')
  and s.user_id in (select user_id from merged_users_3)
order by s.user_id, s.last_review_at desc nulls last, s.word_id;
update merged_srs_3 m set production=(
  select s.production from public.learner_srs s where s.user_id=m.user_id
    and s.word_id in ('verb_wer_wen','other_wer') and s.production is distinct from null
  order by (s.production).last_review_at desc nulls last, s.word_id limit 1
), word_id='other_wer';
delete from public.learner_srs where word_id in ('verb_wer_wen','other_wer')
  and user_id in (select user_id from merged_users_3);
insert into public.learner_srs select * from merged_srs_3;

update public.learner_decisions set word_id='other_wer' where word_id='verb_wer_wen';
-- Any planted copy means the merged word is planted, including for first-keep readers.
update public.learner_decisions d set planted_at=p.planted_at from (
  select user_id,min(planted_at) planted_at from public.learner_decisions
  where word_id='other_wer' and action='keep' group by user_id
) p where d.user_id=p.user_id and d.user_id in (select user_id from merged_users_3)
  and d.word_id='other_wer' and d.action='keep' and d.planted_at is null;
update public.learner_reviews set word_id='other_wer' where word_id='verb_wer_wen';
update public.learner_word_marks set word_id='other_wer' where word_id='verb_wer_wen';
delete from public.learner_word_marks a using public.learner_word_marks b
where a.user_id=b.user_id and a.kind=b.kind and a.word_id=b.word_id
  and a.word_id='other_wer' and a.position>b.position
  and a.user_id in (select user_id from merged_users_3);
update public.learner_profiles set version=version+1,updated_at=now()
where user_id in (select user_id from merged_users_3);

insert into public.word_activities
select 'other_wer',activity_id,relevance from public.word_activities where word_id='verb_wer_wen'
on conflict(word_id,activity_id) do update set relevance=greatest(word_activities.relevance,excluded.relevance);
update public.sentences set word_id='other_wer' where word_id='verb_wer_wen';
insert into public.word_associations
select case when word_id='verb_wer_wen' then 'other_wer' else word_id end,
       case when related_id='verb_wer_wen' then 'other_wer' else related_id end,rank
from public.word_associations
where (word_id='verb_wer_wen' or related_id='verb_wer_wen')
  and word_id not in ('verb_wer_wen','other_wer')
  or (word_id='verb_wer_wen' and related_id not in ('verb_wer_wen','other_wer'))
on conflict(word_id,related_id) do update set rank=least(word_associations.rank,excluded.rank);
insert into public.verb_objects
select verb_id,'other_wer',phrase from public.verb_objects where noun_id='verb_wer_wen'
on conflict(verb_id,noun_id) do nothing;
insert into public.verb_objects select 'other_wer',noun_id,phrase from public.verb_objects where verb_id='verb_wer_wen' on conflict do nothing;
delete from public.words where id='verb_wer_wen';

-- Merge the malformed import into its canonical noun, including private progress.
lock table public.learner_profiles in share row exclusive mode;
lock table public.learner_decisions, public.learner_word_marks, public.learner_srs,
  public.learner_reviews in share row exclusive mode;

-- Abort instead of deleting references if the canonical vocabulary is absent.
do $$ begin
  if exists(select 1 from public.words where id='other_sein')
    and not exists(select 1 from public.words where id='verb_sein') then
    raise exception 'Missing canonical verb_sein';
  end if;
end $$;

create temporary table merged_users_4 on commit drop as
select user_id from public.learner_decisions where word_id='other_sein'
union select user_id from public.learner_word_marks where word_id='other_sein'
union select user_id from public.learner_srs where word_id='other_sein'
union select user_id from public.learner_reviews where word_id='other_sein';

-- Recognition and production each retain their most recently reviewed schedule.
-- Canonical wins ties. Keep every review event in the audit history.
create temporary table merged_srs_4 on commit drop as
select distinct on (s.user_id) s.* from public.learner_srs s
where s.word_id in ('other_sein','verb_sein')
  and s.user_id in (select user_id from merged_users_4)
order by s.user_id, s.last_review_at desc nulls last, s.word_id;
update merged_srs_4 m set production=(
  select s.production from public.learner_srs s where s.user_id=m.user_id
    and s.word_id in ('other_sein','verb_sein') and s.production is distinct from null
  order by (s.production).last_review_at desc nulls last, s.word_id limit 1
), word_id='verb_sein';
delete from public.learner_srs where word_id in ('other_sein','verb_sein')
  and user_id in (select user_id from merged_users_4);
insert into public.learner_srs select * from merged_srs_4;

update public.learner_decisions set word_id='verb_sein' where word_id='other_sein';
-- Any planted copy means the merged word is planted, including for first-keep readers.
update public.learner_decisions d set planted_at=p.planted_at from (
  select user_id,min(planted_at) planted_at from public.learner_decisions
  where word_id='verb_sein' and action='keep' group by user_id
) p where d.user_id=p.user_id and d.user_id in (select user_id from merged_users_4)
  and d.word_id='verb_sein' and d.action='keep' and d.planted_at is null;
update public.learner_reviews set word_id='verb_sein' where word_id='other_sein';
update public.learner_word_marks set word_id='verb_sein' where word_id='other_sein';
delete from public.learner_word_marks a using public.learner_word_marks b
where a.user_id=b.user_id and a.kind=b.kind and a.word_id=b.word_id
  and a.word_id='verb_sein' and a.position>b.position
  and a.user_id in (select user_id from merged_users_4);
update public.learner_profiles set version=version+1,updated_at=now()
where user_id in (select user_id from merged_users_4);

insert into public.word_activities
select 'verb_sein',activity_id,relevance from public.word_activities where word_id='other_sein'
on conflict(word_id,activity_id) do update set relevance=greatest(word_activities.relevance,excluded.relevance);
update public.sentences set word_id='verb_sein' where word_id='other_sein';
insert into public.word_associations
select case when word_id='other_sein' then 'verb_sein' else word_id end,
       case when related_id='other_sein' then 'verb_sein' else related_id end,rank
from public.word_associations
where (word_id='other_sein' or related_id='other_sein')
  and word_id not in ('other_sein','verb_sein')
  or (word_id='other_sein' and related_id not in ('other_sein','verb_sein'))
on conflict(word_id,related_id) do update set rank=least(word_associations.rank,excluded.rank);
insert into public.verb_objects
select verb_id,'verb_sein',phrase from public.verb_objects where noun_id='other_sein'
on conflict(verb_id,noun_id) do nothing;
insert into public.verb_objects select 'verb_sein',noun_id,phrase from public.verb_objects where verb_id='other_sein' on conflict do nothing;
delete from public.words where id='other_sein';

-- Merge the malformed import into its canonical noun, including private progress.
lock table public.learner_profiles in share row exclusive mode;
lock table public.learner_decisions, public.learner_word_marks, public.learner_srs,
  public.learner_reviews in share row exclusive mode;

-- Abort instead of deleting references if the canonical vocabulary is absent.
do $$ begin
  if exists(select 1 from public.words where id='other_tun')
    and not exists(select 1 from public.words where id='verb_tun') then
    raise exception 'Missing canonical verb_tun';
  end if;
end $$;

create temporary table merged_users_5 on commit drop as
select user_id from public.learner_decisions where word_id='other_tun'
union select user_id from public.learner_word_marks where word_id='other_tun'
union select user_id from public.learner_srs where word_id='other_tun'
union select user_id from public.learner_reviews where word_id='other_tun';

-- Recognition and production each retain their most recently reviewed schedule.
-- Canonical wins ties. Keep every review event in the audit history.
create temporary table merged_srs_5 on commit drop as
select distinct on (s.user_id) s.* from public.learner_srs s
where s.word_id in ('other_tun','verb_tun')
  and s.user_id in (select user_id from merged_users_5)
order by s.user_id, s.last_review_at desc nulls last, s.word_id;
update merged_srs_5 m set production=(
  select s.production from public.learner_srs s where s.user_id=m.user_id
    and s.word_id in ('other_tun','verb_tun') and s.production is distinct from null
  order by (s.production).last_review_at desc nulls last, s.word_id limit 1
), word_id='verb_tun';
delete from public.learner_srs where word_id in ('other_tun','verb_tun')
  and user_id in (select user_id from merged_users_5);
insert into public.learner_srs select * from merged_srs_5;

update public.learner_decisions set word_id='verb_tun' where word_id='other_tun';
-- Any planted copy means the merged word is planted, including for first-keep readers.
update public.learner_decisions d set planted_at=p.planted_at from (
  select user_id,min(planted_at) planted_at from public.learner_decisions
  where word_id='verb_tun' and action='keep' group by user_id
) p where d.user_id=p.user_id and d.user_id in (select user_id from merged_users_5)
  and d.word_id='verb_tun' and d.action='keep' and d.planted_at is null;
update public.learner_reviews set word_id='verb_tun' where word_id='other_tun';
update public.learner_word_marks set word_id='verb_tun' where word_id='other_tun';
delete from public.learner_word_marks a using public.learner_word_marks b
where a.user_id=b.user_id and a.kind=b.kind and a.word_id=b.word_id
  and a.word_id='verb_tun' and a.position>b.position
  and a.user_id in (select user_id from merged_users_5);
update public.learner_profiles set version=version+1,updated_at=now()
where user_id in (select user_id from merged_users_5);

insert into public.word_activities
select 'verb_tun',activity_id,relevance from public.word_activities where word_id='other_tun'
on conflict(word_id,activity_id) do update set relevance=greatest(word_activities.relevance,excluded.relevance);
update public.sentences set word_id='verb_tun' where word_id='other_tun';
insert into public.word_associations
select case when word_id='other_tun' then 'verb_tun' else word_id end,
       case when related_id='other_tun' then 'verb_tun' else related_id end,rank
from public.word_associations
where (word_id='other_tun' or related_id='other_tun')
  and word_id not in ('other_tun','verb_tun')
  or (word_id='other_tun' and related_id not in ('other_tun','verb_tun'))
on conflict(word_id,related_id) do update set rank=least(word_associations.rank,excluded.rank);
insert into public.verb_objects
select verb_id,'verb_tun',phrase from public.verb_objects where noun_id='other_tun'
on conflict(verb_id,noun_id) do nothing;
insert into public.verb_objects select 'verb_tun',noun_id,phrase from public.verb_objects where verb_id='other_tun' on conflict do nothing;
delete from public.words where id='other_tun';

-- Merge the malformed import into its canonical noun, including private progress.
lock table public.learner_profiles in share row exclusive mode;
lock table public.learner_decisions, public.learner_word_marks, public.learner_srs,
  public.learner_reviews in share row exclusive mode;

-- Abort instead of deleting references if the canonical vocabulary is absent.
do $$ begin
  if exists(select 1 from public.words where id='other_zu_sein')
    and not exists(select 1 from public.words where id='verb_zu_sein') then
    raise exception 'Missing canonical verb_zu_sein';
  end if;
end $$;

create temporary table merged_users_6 on commit drop as
select user_id from public.learner_decisions where word_id='other_zu_sein'
union select user_id from public.learner_word_marks where word_id='other_zu_sein'
union select user_id from public.learner_srs where word_id='other_zu_sein'
union select user_id from public.learner_reviews where word_id='other_zu_sein';

-- Recognition and production each retain their most recently reviewed schedule.
-- Canonical wins ties. Keep every review event in the audit history.
create temporary table merged_srs_6 on commit drop as
select distinct on (s.user_id) s.* from public.learner_srs s
where s.word_id in ('other_zu_sein','verb_zu_sein')
  and s.user_id in (select user_id from merged_users_6)
order by s.user_id, s.last_review_at desc nulls last, s.word_id;
update merged_srs_6 m set production=(
  select s.production from public.learner_srs s where s.user_id=m.user_id
    and s.word_id in ('other_zu_sein','verb_zu_sein') and s.production is distinct from null
  order by (s.production).last_review_at desc nulls last, s.word_id limit 1
), word_id='verb_zu_sein';
delete from public.learner_srs where word_id in ('other_zu_sein','verb_zu_sein')
  and user_id in (select user_id from merged_users_6);
insert into public.learner_srs select * from merged_srs_6;

update public.learner_decisions set word_id='verb_zu_sein' where word_id='other_zu_sein';
-- Any planted copy means the merged word is planted, including for first-keep readers.
update public.learner_decisions d set planted_at=p.planted_at from (
  select user_id,min(planted_at) planted_at from public.learner_decisions
  where word_id='verb_zu_sein' and action='keep' group by user_id
) p where d.user_id=p.user_id and d.user_id in (select user_id from merged_users_6)
  and d.word_id='verb_zu_sein' and d.action='keep' and d.planted_at is null;
update public.learner_reviews set word_id='verb_zu_sein' where word_id='other_zu_sein';
update public.learner_word_marks set word_id='verb_zu_sein' where word_id='other_zu_sein';
delete from public.learner_word_marks a using public.learner_word_marks b
where a.user_id=b.user_id and a.kind=b.kind and a.word_id=b.word_id
  and a.word_id='verb_zu_sein' and a.position>b.position
  and a.user_id in (select user_id from merged_users_6);
update public.learner_profiles set version=version+1,updated_at=now()
where user_id in (select user_id from merged_users_6);

insert into public.word_activities
select 'verb_zu_sein',activity_id,relevance from public.word_activities where word_id='other_zu_sein'
on conflict(word_id,activity_id) do update set relevance=greatest(word_activities.relevance,excluded.relevance);
update public.sentences set word_id='verb_zu_sein' where word_id='other_zu_sein';
insert into public.word_associations
select case when word_id='other_zu_sein' then 'verb_zu_sein' else word_id end,
       case when related_id='other_zu_sein' then 'verb_zu_sein' else related_id end,rank
from public.word_associations
where (word_id='other_zu_sein' or related_id='other_zu_sein')
  and word_id not in ('other_zu_sein','verb_zu_sein')
  or (word_id='other_zu_sein' and related_id not in ('other_zu_sein','verb_zu_sein'))
on conflict(word_id,related_id) do update set rank=least(word_associations.rank,excluded.rank);
insert into public.verb_objects
select verb_id,'verb_zu_sein',phrase from public.verb_objects where noun_id='other_zu_sein'
on conflict(verb_id,noun_id) do nothing;
insert into public.verb_objects select 'verb_zu_sein',noun_id,phrase from public.verb_objects where verb_id='other_zu_sein' on conflict do nothing;
delete from public.words where id='other_zu_sein';

DELETE FROM public.verb_objects WHERE verb_id IN (SELECT id FROM public.words WHERE pos!='verb');
commit;
