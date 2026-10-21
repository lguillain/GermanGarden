import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Catalog, freshLearner, Learner } from '../../supabase/functions/garden/model.ts';
import { initialSrs } from '../../supabase/functions/garden/scheduler.ts';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { scopedProgressRequest } from '../../supabase/functions/garden/progress-request.ts';

test('only read-only topic and practice routes use partial snapshots', () => {
  assert.deepEqual(scopedProgressRequest('/topics/home', 'GET'), { p_topic: 'home', p_kept_only: false });
  assert.deepEqual(scopedProgressRequest('/practice', 'GET'), { p_topic: null, p_kept_only: true });
  for (const path of ['/matcher', '/guide', '/garden', '/review', '/topics/home/words/w/keep'])
    assert.equal(scopedProgressRequest(path, 'GET'), null);
  for (const path of ['/practice', '/topics/home', '/review', '/matcher'])
    assert.equal(scopedProgressRequest(path, 'POST'), null);
});

test('scoped progress preserves topic/practice responses and isolates accounts', async () => {
  const db = new PGlite(), user = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      insert into auth.users values ('${user}'), ('${other}');`);
    for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort())
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    await db.exec(`insert into activities(id,name) values ('home','Home'),('work','Work');
      insert into words(id,lemma,pos,english,level)
        select id,id,'noun',id,'A1' from unnest(array['seed','plant','drop','known','elsewhere','new']) id;
      insert into word_activities(word_id,activity_id,relevance)
        select id,case when id='elsewhere' then 'work' else 'home' end,1 from words;`);
    const state = freshLearner('Test');
    state.swipes = ['seed', 'plant', 'drop', 'elsewhere'].map(word_id => ({
      word_id, action: word_id === 'drop' ? 'drop' as const : 'keep' as const,
      activity_id: null, sentence_id: null, swiped_at: '2026-10-01T00:00:00Z',
      planted_at: ['plant', 'elsewhere'].includes(word_id) ? '2026-10-01T00:00:00Z' : null,
    }));
    // Imported duplicate keeps must preserve the first keep's status.
    state.swipes.push({ ...state.swipes[1], planted_at: null });
    state.known = ['known'];
    state.learned = ['plant'];
    state.srs = { plant: initialSrs(), elsewhere: initialSrs(), drop: initialSrs() };
    const otherState = freshLearner('Other'); otherState.known = ['new'];
    await db.query('select import_learner_progress($1,$2)', [user, JSON.stringify(state)]);
    await db.query('select import_learner_progress($1,$2)', [other, JSON.stringify(otherState)]);
    const catalog = (await db.query<{ value: Catalog }>('select load_garden_catalog() as value')).rows[0].value;
    const full = (await db.query<{ value: { data: Learner } }>('select load_learner_progress($1,$2) as value', [user, 'Test'])).rows[0].value.data;
    const load = async (topic: string | null, kept: boolean) =>
      (await db.query<{ value: { data: Learner } }>('select load_scoped_progress($1,$2,$3,$4) as value',
        [user, 'Test', topic, kept])).rows[0].value.data;
    const topicState = await load('home', false), practiceState = await load(null, true);
    assert.deepEqual(new Garden(catalog, topicState).topicDetail('home'), new Garden(catalog, full).topicDetail('home'));
    for (const [scope, topic] of [['all', ''], ['bag', ''], ['topic', 'home'], ['topic', 'work']])
      assert.deepEqual(new Garden(catalog, practiceState).practice(scope, topic), new Garden(catalog, full).practice(scope, topic));
    assert.ok(!topicState.swipes.some(s => s.word_id === 'elsewhere'));
    assert.ok(practiceState.swipes.every(s => s.action === 'keep'));
    assert.equal(practiceState.srs.drop, undefined);
    assert.deepEqual(topicState.known, ['known']);
    assert.deepEqual((await load('missing', false)).swipes, []);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(load('home', false), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.deepEqual((await load('home', false)).known, ['known']);
  } finally { await db.close(); }
});
