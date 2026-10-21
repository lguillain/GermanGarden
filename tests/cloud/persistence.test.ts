import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshLearner } from '../../supabase/functions/garden/model.ts';
import { initialSrs } from '../../supabase/functions/garden/scheduler.ts';
import { progressChanges } from '../../supabase/functions/garden/persistence.ts';
import { dispatch } from '../../supabase/functions/garden/service.ts';

test('saving a review sends only changed progress and newly appended history', () => {
  const before = freshLearner('Test');
  before.srs = { first: initialSrs(), second: initialSrs() };
  before.reviews = Array.from({ length: 1000 }, () => ({ word_id: 'second', grade: 3, reviewed_at: '2026-10-01T00:00:00Z' }));
  const after = structuredClone(before);
  after.srs.first.reps = 1;
  const review = { word_id: 'first', grade: 3, reviewed_at: '2026-10-20T00:00:00Z' };
  after.reviews.push(review);
  assert.deepEqual(progressChanges(before, after), {
    swipes: [], marks: [], srs: { first: after.srs.first }, reviews: [review],
  });
});


test('cloud session reads only the profile, without loading or saving progress', async () => {
  const result = await dispatch('/session', 'GET', new URLSearchParams(), {}, {
    async load() { throw new Error('Must not load progress'); },
    async save() { throw new Error('Must not save progress'); },
    async profile() { return { name: 'Test', level: 'A2', swipe_count: 12000 }; },
  }, { words: [], activities: [], word_activities: [], sentences: [] });
  assert.deepEqual(result, { user: { name: 'Test', level: 'A2' }, ai_available: false });
});


test('practice summary bypasses vocabulary and progress and preserves scope counts', async () => {
  let reads = 0;
  const store = {
    async load() { throw new Error('Must not load progress'); },
    async save() { throw new Error('Must not save progress'); },
    async practiceSummary(topic: string) {
      reads++;
      return { counts: { plants: topic ? 2 : 1000, seeds: 3 }, all_plants: 1000, topic_exists: topic === 'home' };
    },
  };
  const catalog = { words: [], activities: [], word_activities: [], sentences: [] };
  for (const [scope, topic, expected] of [['all', '', 1000], ['all', 'home', 1000], ['bag', 'home', 3], ['topic', 'home', 2]] as const) {
    const result = await dispatch('/practice/summary', 'GET', new URLSearchParams({scope, topic}), {}, store, catalog);
    assert.deepEqual(result, {word_count: expected, counts: {plants: topic ? 2 : 1000, seeds: 3}});
  }
  assert.equal(reads, 4);
  await assert.rejects(dispatch('/practice/summary', 'GET', new URLSearchParams('scope=invalid'), {}, store, catalog), /Unknown word set/);
  assert.equal(reads, 4);
  for (const query of ['scope=topic', 'scope=topic&topic=missing', 'scope=bag&topic=missing'])
    await assert.rejects(dispatch('/practice/summary', 'GET', new URLSearchParams(query), {}, store, catalog), /Unknown topic/);
});
