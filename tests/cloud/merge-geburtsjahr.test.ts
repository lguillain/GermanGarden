import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('duplicate merge retains both histories and latest schedules, moves references, and is idempotent', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    for (const file of readdirSync('supabase/migrations').sort()) {
      if (file >= '202611030001' || file.includes('_data.')) continue;
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    await db.exec(`insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
      insert into learner_profiles(user_id,name) select id,'Test' from auth.users;
      insert into words values ('noun_geburtsjahr','Geburtsjahr','das','Geburtsjahre','noun','birth year','A2'),
      ('other_geburts_jahr','Geburtsjahr','das','Geburtsjahre','noun','birth year','A2'),
      ('verb_nennen','nennen',null,null,'verb','name','A2');
      insert into activities values ('test','Test',null);
      insert into word_activities values ('other_geburts_jahr','test',3),('noun_geburtsjahr','test',1);
      insert into sentences(id,word_id,text,english,source) values (1,'other_geburts_jahr','Geburtsjahr','birth year','test');
      insert into word_associations values ('other_geburts_jahr','noun_geburtsjahr',1),('verb_nennen','other_geburts_jahr',2);
      insert into verb_objects values ('verb_nennen','other_geburts_jahr','das Geburtsjahr nennen');
      insert into learner_decisions(user_id,position,word_id,action,swiped_at,planted_at)
      select id,0,'noun_geburtsjahr','keep','2026-01-01',null from auth.users;
      insert into learner_decisions(user_id,position,word_id,action,swiped_at,planted_at)
      select id,1,'other_geburts_jahr','keep','2026-01-02','2026-01-03' from auth.users;
      insert into learner_word_marks select id,'learned',0,'other_geburts_jahr' from auth.users;
      insert into learner_word_marks select id,'learned',1,'noun_geburtsjahr' from auth.users;
      insert into learner_reviews(user_id,position,word_id,grade,reviewed_at)
      select id,0,'other_geburts_jahr',3,'2026-01-03' from auth.users;
      insert into learner_srs(user_id,word_id,ease,interval_days,reps,lapses,state,last_review_at,production)
      select id,'other_geburts_jahr',2.5,7,2,0,'review','2026-01-03',
      row(2.5,3,1,0,'review','2026-02-01',3,'2026-01-02')::review_schedule from auth.users;
      insert into learner_srs(user_id,word_id,ease,interval_days,reps,lapses,state,last_review_at,production)
      select id,'noun_geburtsjahr',2.5,1,1,0,'review','2026-01-01',
      row(2.5,9,3,0,'review','2026-02-02',3,'2026-01-04')::review_schedule from auth.users limit 1;`);
    const migration = readFileSync('supabase/migrations/202611030002_merge_geburtsjahr.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    assert.equal((await db.query("select * from words where id='other_geburts_jahr'")).rows.length, 0);
    for (const table of ['learner_decisions', 'learner_reviews', 'learner_word_marks', 'learner_srs', 'sentences', 'word_activities']) {
      assert.equal((await db.query(`select * from ${table} where word_id='other_geburts_jahr'`)).rows.length, 0);
    }
    assert.deepEqual((await db.query('select interval_days::int days,(production).interval_days::int production from learner_srs order by user_id')).rows,
      [{ days: 7, production: 9 }, { days: 7, production: 3 }]);
    assert.equal((await db.query('select * from learner_decisions where planted_at is null')).rows.length, 0);
    assert.equal((await db.query('select * from learner_word_marks')).rows.length, 2);
    assert.equal((await db.query('select * from learner_reviews')).rows.length, 2);
    assert.deepEqual((await db.query('select version::int version from learner_profiles')).rows, [{ version: 1 }, { version: 1 }]);
    assert.deepEqual((await db.query('select relevance from word_activities')).rows, [{ relevance: 3 }]);
    assert.deepEqual((await db.query('select related_id from word_associations')).rows, [{ related_id: 'noun_geburtsjahr' }]);
    assert.deepEqual((await db.query('select noun_id from verb_objects')).rows, [{ noun_id: 'noun_geburtsjahr' }]);
  } finally { await db.close(); }
});
