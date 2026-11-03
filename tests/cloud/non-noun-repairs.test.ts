import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('non-noun repairs split meanings without copying progress and merge existing verbs', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    for (const file of readdirSync('supabase/migrations').sort()) {
      if (file >= '202611030001' || file.includes('_data.')) continue;
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    await db.exec(`insert into auth.users values ('00000000-0000-4000-8000-000000000001');
      insert into learner_profiles(user_id,name) select id,'Test' from auth.users;
      insert into words(id,lemma,pos,english,level) values
      ('other_verbieten_verboten_sein','verbieten /verboten sein','other','to forbid / be forbidden','A2'),
      ('verb_verbieten','verbieten','verb','to forbid','A2'),
      ('verb_dafur_dagegen_sein','dafür/dagegen sein','verb','to be for / against','A2'),
      ('verb_an_aus_ziehen','(an-)/(aus)ziehen','verb','put on / take off','A2'),
      ('verb_anziehen','(sich) anziehen','verb','put on','A2'),
      ('verb_ausziehen','(sich) ausziehen','verb','take off','A2'),
      ('verb_draussen','draußen','verb','outside','A2');
      insert into activities values ('test','Test',null);
      insert into word_activities values ('verb_dafur_dagegen_sein','test',3);
      insert into learner_word_marks select id,'learned',0,'verb_dafur_dagegen_sein' from auth.users;
      insert into learner_reviews(user_id,position,word_id,grade,reviewed_at)
      select id,0,'verb_an_aus_ziehen',3,'2026-01-03' from auth.users;
      insert into sentences(id,word_id,text,english,source) values
      (2270,'verb_an_aus_ziehen','Die Nachbarn sind ausgezogen.','They moved out.','test'),
      (6938,'verb_dafur_dagegen_sein','Ich bin dagegen.','I am against it.','test');`);
    const sql = readFileSync('supabase/migrations/202611030003_non_noun_repairs.sql', 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    assert.deepEqual((await db.query("select lemma,pos,english from words where id='other_verbieten_verboten_sein'")).rows,
      [{ lemma: 'verboten sein', pos: 'verb', english: 'to be forbidden' }]);
    assert.deepEqual((await db.query("select pos from words where id='verb_draussen'")).rows, [{ pos: 'adv' }]);
    assert.equal((await db.query("select * from words where id='verb_an_aus_ziehen'")).rows.length, 0);
    assert.deepEqual((await db.query('select word_id from learner_reviews')).rows, [{ word_id: 'verb_anziehen' }]);
    assert.deepEqual((await db.query('select word_id from learner_word_marks')).rows, [{ word_id: 'verb_dafur_dagegen_sein' }]);
    assert.deepEqual((await db.query('select word_id from sentences order by id')).rows,
      [{ word_id: 'verb_ausziehen' }, { word_id: 'verb_dagegen_sein' }]);
    assert.equal((await db.query("select * from word_activities where word_id='verb_dagegen_sein'")).rows.length, 1);
  } finally { await db.close(); }
});
