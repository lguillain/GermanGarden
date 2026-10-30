import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { catalogRequest, createCatalogLoader } from '../../supabase/functions/garden/catalog-loader.ts';
import { Catalog, freshLearner } from '../../supabase/functions/garden/model.ts';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { loadPracticeData, practiceWordIds } from '../../supabase/functions/garden/practice-catalog.ts';

test('list screens request only needed vocabulary; mutations retain the full seed bag', () => {
  assert.deepEqual(catalogRequest('/topics/at%20home', 'GET'), {
    p_topic: 'at home', p_include_sentences: false, p_activities_only: false, p_include_associations: false,
  });
  for (const path of ['/onboarding']) assert.equal(catalogRequest(path, 'GET').p_activities_only, true);
  assert.equal(catalogRequest('/garden', 'GET').p_include_sentences, false);
  assert.equal(catalogRequest('/words/noun_zug/related', 'GET').p_include_sentences, false);
  for (const path of ['/matcher', '/guide', '/review', '/practice', '/topics/home/words/word/keep']) {
    assert.deepEqual(catalogRequest(path, 'POST'), {
      p_topic: null, p_include_sentences: true, p_activities_only: false, p_include_associations: true,
    });
  }
});

test('catalogue caches separate scopes and share concurrent requests', async () => {
  let loads = 0;
  const load = createCatalogLoader(async request => {
    loads++;
    return {
      activities: [{ id: 'home', name: 'Home' }],
      words: request.p_activities_only ? [] : [{ id: request.p_topic || 'all', lemma: 'Wort', pos: 'noun', english: 'word', level: 'A2' }],
      word_activities: [], sentences: [],
    };
  });
  const [first, second] = await Promise.all([load('/topics/home', 'GET'), load('/topics/home', 'GET')]);
  assert.equal(first, second); assert.equal(loads, 1);
  const full = await load('/matcher', 'GET');
  assert.notEqual(full, first); assert.equal(full.words[0].id, 'all');
  assert.equal((await load('/onboarding', 'GET')).words.length, 0);
  assert.equal(loads, 3);
});

test('catalogue RPC returns more than 1000 rows, scopes lists, and preserves topic results', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
    await db.exec(readFileSync('supabase/migrations/202610190001_garden.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610200002_catalog_reads.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610200003_practice_catalog.sql', 'utf8'));
    await db.exec(`insert into activities values ('home','Home',null),('work','Work',null);
      insert into words(id,lemma,pos,english,level)
        select 'word-'||n,'Wort'||n,'noun','word','A2' from generate_series(1,1005) n;
      insert into word_activities select id,case when id='word-1' then 'home' else 'work' end,3 from words;
      insert into sentences(id,word_id,activity_id,text,english,source)
        select n,'word-'||n,case when n=1 then 'home' else 'work' end,'Ein Wort.','A word.','test' from generate_series(1,1005) n;`);
    async function load(topic: string | null, sentences: boolean, activitiesOnly: boolean) {
      const result = await db.query<{ data: Catalog }>('select load_garden_catalog($1,$2,$3) data', [topic, sentences, activitiesOnly]);
      return result.rows[0].data;
    }
    const full = await load(null, true, false);
    assert.equal(full.words.length, 1005); assert.equal(full.sentences.length, 1005);
    const scoped = await load('home', false, false);
    assert.equal(scoped.words.length, 1); assert.equal(scoped.word_activities.length, 1);
    assert.equal(scoped.sentences.length, 0);
    assert.deepEqual(new Garden(scoped, freshLearner('Test')).topicDetail('home'), new Garden(full, freshLearner('Test')).topicDetail('home'));
    assert.equal((await load(null, false, false)).sentences.length, 0);
    const activities = await load(null, false, true);
    assert.equal(activities.activities.length, 2); assert.equal(activities.words.length, 0);
    assert.equal((await load('unknown', false, false)).words.length, 0);
    const garden = new Garden(full, freshLearner('Test'));
    garden.add('word-1', 'home');
    garden.add('word-2', 'work');
    garden.grade('word-2', 3, 'bag');
    garden.state.known.push('word-3');
    const practice = await db.query<{ data: Catalog }>('select load_practice_catalog($1) data', [practiceWordIds(garden.state)]);
    assert.equal(practice.rows[0].data.words.length, 3);
    assert.equal(practice.rows[0].data.sentences.length, 0);
    const small = new Garden(practice.rows[0].data, structuredClone(garden.state), garden.now);
    for (const [scope, topic] of [['bag', ''], ['all', ''], ['topic', 'home'], ['topic', 'work']]) {
      assert.deepEqual(small.practice(scope, topic), garden.practice(scope, topic));
    }
    const empty = await db.query<{ data: Catalog }>('select load_practice_catalog($1) data', [[]]);
    assert.equal(empty.rows[0].data.words.length, 0);
    assert.equal(empty.rows[0].data.activities.length, 2);
    await db.exec('set role authenticated');
    await assert.rejects(db.exec('select load_garden_catalog()'), /permission denied/);
    await assert.rejects(db.exec("select load_practice_catalog('{}')"), /permission denied/);
    await db.exec('reset role; set role service_role');
    assert.equal((await load('home', false, false)).words.length, 1);
  } finally { await db.close(); }
});

test('practice catalogue uses the current learner snapshot without caching another learner’s words', async () => {
  const first = freshLearner('First'), second = freshLearner('Second');
  first.swipes.push({ word_id: 'kept', activity_id: null, sentence_id: null, action: 'keep', swiped_at: '2026-10-20T00:00:00Z', planted_at: null });
  first.swipes.push({ ...first.swipes[0], word_id: 'dropped', action: 'drop' });
  const requested: string[][] = [];
  const fetchCatalog = async (ids: string[]): Promise<Catalog> => {
    requested.push(ids);
    return { words: [], activities: [], word_activities: [], sentences: [] };
  };
  const snapshot = { version: 4, data: first };
  const [, received] = await loadPracticeData(async () => snapshot, fetchCatalog);
  assert.equal(received, snapshot);
  await loadPracticeData(async () => ({ version: 0, data: second }), fetchCatalog);
  assert.deepEqual(requested, [['kept'], []]);
});
