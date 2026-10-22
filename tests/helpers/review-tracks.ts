import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import {
  freshLearner as currentFreshLearner,
  type Catalog,
  type Learner,
  type ReviewSelection,
} from '../../supabase/functions/garden/model.ts';
import { progressChanges } from '../../supabase/functions/garden/persistence.ts';
import type { Store } from '../../supabase/functions/garden/service.ts';
export const account = '00000000-0000-4000-8000-000000000001';
export const otherAccount = '00000000-0000-4000-8000-000000000002';
export async function tracksDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    insert into auth.users values ('${account}'),('${otherAccount}');`);
  const files = readdirSync('supabase/migrations').sort();
  for (const file of files.filter((f) => f.endsWith('.sql') && f < '202610200009_review_tracks.sql'))
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(`insert into activities values ('home','Home',null);
    insert into words(id,lemma,article,pos,english,level) values ('tree','Baum','der','noun','tree','A2'),('flower','Blume','die','noun','flower','A2');
    insert into word_activities select id,'home',3 from words;
    insert into sentences(id,word_id,activity_id,text,english,source) values (1,'tree','home','Der Baum ist groß.','The tree is tall.','test');`);
  const state = freshLearner('Test');
  state.user.level = 'A2';
  state.swipes = ['tree'].map((word_id) => ({
    word_id,
    activity_id: 'home',
    sentence_id: null,
    action: 'keep',
    swiped_at: '2026-01-01T00:00:00Z',
    planted_at: '2026-01-01T00:00:00Z',
  }));
  state.srs.tree = {
    ease: 2.5,
    interval_days: 25,
    reps: 5,
    lapses: 0,
    state: 'review',
    due_at: '2020-01-01T00:00:00Z',
  };
  state.known = ['flower'];
  await db.query('select import_learner_progress($1,$2)', [account, JSON.stringify(state)]);
  await db.query('select import_learner_progress($1,$2)', [
    otherAccount,
    JSON.stringify(freshLearner('Other')),
  ]);
  await db.exec(readFileSync('supabase/migrations/202610200009_review_tracks.sql', 'utf8'));
  await db.query("insert into learner_sessions(user_id,position,started_at,last_beat_at,seconds) values ($1,0,now(),now(),42)", [account]);
  for (const file of files.filter((f) => f.endsWith('.sql') && f > '202610200009_review_tracks.sql'))
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  const catalog = (await db.query<{ data: Catalog }>('select load_garden_catalog() data')).rows[0]
    .data;
  function store(userId = account): Store {
    let before: Learner;
    return {
      async load() {
        const value = (
          await db.query<{ data: { version: number; data: Learner } }>(
            'select load_learner_progress($1,$2) data',
            [userId, 'Test'],
          )
        ).rows[0].data;
        before = structuredClone(value.data);
        return value;
      },
      async save(version, data) {
        return (
          await db.query<{ saved: boolean }>('select save_learner_progress($1,$2,$3) saved', [
            userId,
            version,
            JSON.stringify(progressChanges(before, data)),
          ])
        ).rows[0].saved;
      },
      async review(scope, topic, excluded = []) {
        return (
          await db.query<{ data: ReviewSelection }>(
            'select load_review_selection($1,$2,$3,now(),$4) data',
            [userId, scope, topic, excluded],
          )
        ).rows[0].data;
      },
    };
  }
  return { db, catalog, store };
}

// Seed the pre-migration schema with its historical required field.
function freshLearner(name: string) {
  const state = currentFreshLearner(name);
  return { ...state, user: { ...state.user, level_bias: 0 } };
}
