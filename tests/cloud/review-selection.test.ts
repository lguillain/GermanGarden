import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Garden, reviewSelectionResponse } from '../../supabase/functions/garden/domain.ts';
import { Catalog, freshLearner, Learner, ReviewSelection } from '../../supabase/functions/garden/model.ts';
import { initialSrs } from '../../supabase/functions/garden/scheduler.ts';
import { dispatch } from '../../supabase/functions/garden/service.ts';

const userA = '00000000-0000-4000-8000-000000000001';
const userB = '00000000-0000-4000-8000-000000000002';
const emptyCatalog: Catalog = { words: [], activities: [], word_activities: [], sentences: [] };

test('review GET bypasses full progress and catalogue; validates scope before reading', async () => {
  let reads = 0;
  const store = {
    async load() { throw new Error('Must not load progress'); },
    async save() { throw new Error('Must not save progress'); },
    async review(scope: string, topic: string): Promise<ReviewSelection> {
      reads++; assert.equal(scope, 'all'); assert.equal(topic, '');
      return { selected: null, remaining: 0, counts: { plants: 0, seeds: 0 }, topic_exists: false, vocabulary_available: true };
    },
  };
  assert.deepEqual(await dispatch('/review', 'GET', new URLSearchParams('scope=all'), {}, store, emptyCatalog),
    { card: null, remaining: 0, counts: { plants: 0, seeds: 0 } });
  await assert.rejects(dispatch('/review', 'GET', new URLSearchParams('scope=invalid'), {}, store, emptyCatalog), /Unknown word set/);
  assert.equal(reads, 1);
});

test('compact review and practice queries match domain counts, selection and rating previews', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      insert into auth.users values ('${userA}'),('${userB}');`);
    for (const migration of ['202610190001_garden', '202610200001_normalize_learners', '202610200002_catalog_reads', '202610200005_review_selection', '202610200007_practice_summary']) {
      await db.exec(readFileSync(`supabase/migrations/${migration}.sql`, 'utf8'));
    }
    await db.exec(`insert into activities values ('home','Home',null),('work','Work',null),('empty','Empty',null);
      insert into words(id,lemma,pos,english,level)
        select 'word-'||n,'Wort'||n,'noun','word','A2' from generate_series(0,1005) n;
      insert into word_activities select id,'home',3 from words;
      insert into word_activities values ('word-1','work',3),('word-8','work',3);
      insert into sentences(id,word_id,activity_id,text,english,source)
        select n+1,'word-'||n,'home','Ein Wort.','A word.','test' from generate_series(0,1005) n where n<>8;`);
    const source = freshLearner('First');
    for (let i = 0; i <= 8; i++) {
      source.swipes.push({ word_id: `word-${i}`, action: 'keep', activity_id: 'home', sentence_id: i + 1,
        swiped_at: '2000-01-01T00:00:00Z', planted_at: i === 2 ? null : '2000-01-01T00:00:00Z' });
      if (i !== 0 && i !== 2) source.srs[`word-${i}`] = { ...initialSrs(), reps: 3, state: 'review', interval_days: 7, due_at: '2000-01-02T00:00:00Z' };
    }
    source.srs['word-3'].due_at = '2099-01-01T00:00:00Z';
    delete source.srs['word-4'].due_at; // Existing SRS without a due date is not due.
    source.known.push('word-5'); source.learned.push('word-6');
    source.swipes[7].action = 'drop';
    // A later keep must not replace the first keep's bag/planted status.
    source.swipes.push({ ...source.swipes[2], planted_at: '2000-01-01T00:00:00Z' });
    // Progress for removed vocabulary must not become a review card.
    source.swipes.push({ ...source.swipes[0], word_id: 'removed-word' });
    const second = freshLearner('Second');
    second.swipes.push({ ...source.swipes[0], word_id: 'word-9' });
    for (const [id, state] of [[userA, source], [userB, second]] as const) {
      await db.query('select import_learner_progress($1,$2::jsonb)', [id, JSON.stringify(state)]);
    }
    const catalog = (await db.query<{ data: Catalog }>('select load_garden_catalog() data')).rows[0].data;
    const now = Date.now();
    async function selection(user: string, scope: string, topic = '') {
      return (await db.query<{ data: ReviewSelection }>('select load_review_selection($1,$2,$3,$4) data',
        [user, scope, topic, new Date(now).toISOString()])).rows[0].data;
    }
    async function compare(user: string) {
      const snapshot = (await db.query<{ data: { data: Learner } }>('select load_learner_progress($1,$2) data', [user, 'Test'])).rows[0].data;
      const garden = new Garden(catalog, snapshot.data, now);
      for (const [scope, topic] of [['all', ''], ['bag', ''], ['topic', 'home'], ['topic', 'work'], ['topic', 'empty'], ['all', 'work'], ['bag', 'work']]) {
        const summary = (await db.query<{ data: { counts: { plants: number; seeds: number }; all_plants: number; topic_exists: boolean } }>(
          'select load_practice_summary($1,$2) data', [user, topic])).rows[0].data;
        assert.deepEqual(summary.counts, garden.counts(topic));
        assert.equal(summary.all_plants, garden.scope('all').length);
        assert.equal(summary.topic_exists, Boolean(topic));
        assert.ok(JSON.stringify(summary).length < 150, 'Practice summary stays bounded');
        const compact = await selection(user, scope, topic);
        assert.deepEqual(reviewSelectionResponse(compact, scope, topic), garden.review(scope, topic), `${user}: ${scope}/${topic}`);
        assert.ok(JSON.stringify(compact).length < 2000, 'Response must stay bounded to one card');
      }
    }
    await compare(userA); await compare(userB);
    const compactBytes = Buffer.byteLength(JSON.stringify(await selection(userA, 'all')));
    t.diagnostic(`Catalogue alone: ${Buffer.byteLength(JSON.stringify(catalog))} bytes; compact review selection: ${compactBytes} bytes (1006-word fixture).`);
    assert.equal((await selection(userA, 'all')).selected?.word.id, 'word-0');
    assert.equal((await selection(userB, 'all')).selected?.word.id, 'word-9');
    const missing = await selection(userA, 'topic', 'missing');
    for (const scope of ['all', 'bag', 'topic']) {
      assert.throws(() => reviewSelectionResponse(missing, scope, 'missing'), /Unknown topic/);
    }
    // Move the unscheduled plant into the future to exercise scheduled ordering.
    await db.query(`insert into learner_srs(user_id,word_id,ease,interval_days,reps,lapses,state,due_at)
      values ($1,'word-0',2.5,1,1,0,'review','2099-01-01')`, [userA]);
    await compare(userA);
    assert.equal((await selection(userA, 'all')).selected?.word.id, 'word-1');
    // A topic-specific sentence wins over the fallback.
    await db.exec(`insert into sentences values (2000,'word-1','work','Bei der Arbeit.','At work.','test',null)`);
    assert.equal((await selection(userA, 'topic', 'work')).selected?.sentence?.id, 2000);
    // The other due work word has no sentence at all.
    await db.query("update learner_srs set due_at='2099-01-01' where user_id=$1 and word_id='word-1'", [userA]);
    const noSentence = await selection(userA, 'topic', 'work');
    assert.equal(noSentence.selected?.word.id, 'word-8'); assert.equal(noSentence.selected?.sentence, null);
    assert.equal(reviewSelectionResponse(noSentence, 'topic', 'work').card?.de, '');
    await db.query("update learner_srs set due_at='2099-01-01' where user_id=$1", [userA]);
    assert.equal((await selection(userA, 'all')).remaining, 0);
    assert.equal((await selection(userA, 'all')).selected, null);
    await db.exec('set role authenticated');
    await assert.rejects(selection(userB, 'all'), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(selection(userA, 'all'), /permission denied/);
    await db.exec('reset role; set role service_role');
    assert.equal((await selection(userB, 'all')).selected?.word.id, 'word-9');
  } finally { await db.close(); }
});

