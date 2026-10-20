import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshLearner, initialSrs } from '../../supabase/functions/garden/model.ts';
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

test('cloud heartbeat skips loading and saving learner progress', async () => {
  const summary = { today_seconds: 15, total_seconds: 42, current_session_seconds: 15, timer_seconds: 300 };
  const result = await dispatch('/heartbeat', 'POST', new URLSearchParams(), {}, {
    async load() { throw new Error('Must not load progress'); },
    async save() { throw new Error('Must not save progress'); },
    async heartbeat() { return summary; },
  }, { words: [], activities: [], word_activities: [], sentences: [] });
  assert.equal(result, summary);
});

test('cloud session reads only the profile, without loading or saving progress', async () => {
  const result = await dispatch('/session', 'GET', new URLSearchParams(), {}, {
    async load() { throw new Error('Must not load progress'); },
    async save() { throw new Error('Must not save progress'); },
    async profile() { return { name: 'Test', level: 'A2', swipe_count: 12000 }; },
  }, { words: [], activities: [], word_activities: [], sentences: [] });
  assert.deepEqual(result, { user: { name: 'Test', level: 'A2', swipes: 12000 }, ai_available: false, activities: [] });
});
