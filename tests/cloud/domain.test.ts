import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { Catalog, freshLearner } from '../../supabase/functions/garden/model.ts';
import { growth, initialSrs, reviewOutcome } from '../../supabase/functions/garden/scheduler.ts';
import { dispatch, Store } from '../../supabase/functions/garden/service.ts';
import { aiPractice } from '../../supabase/functions/garden/ai.ts';

export const catalog: Catalog = {
  words: Array.from({ length: 24 }, (_, i) => ({ id: `word-${i}`, lemma: `Wort${i}`, article: 'das', pos: 'noun', english: `word ${i}`, level: 'A2' })),
  activities: [{ id: 'home', name: 'Home' }, { id: 'work', name: 'Work' }],
  word_activities: Array.from({ length: 24 }, (_, i) => ({ word_id: `word-${i}`, activity_id: i < 22 ? 'home' : 'work', relevance: 3 })),
  sentences: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, word_id: `word-${i}`, activity_id: i < 22 ? 'home' : 'work', text: `Ein Wort${i}.`, english: `A word ${i}.` })),
};
function fixture() { const state = freshLearner('Test'); state.user.level = 'A2'; return new Garden(catalog, state, Date.parse('2026-10-19T12:00:00Z')); }
function memoryStore(garden = fixture()): Store & { state: typeof garden.state } {
  let version = 0;
  return { state: structuredClone(garden.state), async load() { return { version, data: structuredClone(this.state) }; }, async save(expected, data) { if (version !== expected) return false; this.state = structuredClone(data); version++; return true; } };
}

test('seed bag capacity, practice, planting and review completion', () => {
  const g = fixture();
  for (let i = 0; i < 20; i++) g.add(`word-${i}`, 'home');
  assert.equal(g.bag().length, 20); assert.equal(g.scope().length, 0);
  assert.throws(() => g.add('word-20', 'home'), /full/);
  const before = structuredClone(g.state); g.practice('bag', ''); g.targets('bag', '');
  assert.deepEqual(g.state, before);
  g.grade('word-0', 3, 'bag'); assert.equal(g.bag().length, 19); assert.equal(g.scope().length, 1);
  assert.equal(g.review().card, null); assert.equal(g.review().remaining, 0);
  assert.equal(g.review('topic', 'home').card, null);
  assert.throws(() => g.grade('word-0', 3), /no longer due/);
  g.add('word-20', 'home'); assert.equal(g.bag().length, 20);
  g.now += 86_401_000;
  assert.equal(g.review().card?.word_id, 'word-0'); assert.equal(g.details(g.word('word-0')).review_due, true);
  g.grade('word-0', 3); assert.equal(g.review().card, null); assert.equal(g.details(g.word('word-0')).review_due, false);
});

test('all ratings plant a seed immediately, learned plants stay grown', () => {
  for (const grade of [1, 2, 3, 4]) {
    const g = fixture(); g.add('word-0', 'home'); g.grade('word-0', grade, 'bag');
    assert.equal(g.bag().length, 0); assert.equal(g.scope().length, 1);
    g.state.learned.push('word-0'); g.now += 100 * 86_400_000;
    assert.equal(g.details(g.word('word-0')).growth, 5);
    assert.equal(g.details(g.word('word-0')).review_due, false);
    assert.equal(g.review().card, null);
  }
});

test('scope isolation and duplicate discovery actions', () => {
  const g = fixture(); g.swipe('word-0', 'learned', 'home', 1);
  assert.throws(() => g.swipe('word-0', 'keep', 'home', 1), /already been handled/);
  g.add('word-22', 'work'); g.grade('word-22', 3, 'bag');
  assert.equal(g.scope('topic', 'home').length, 1); // Learned words remain available for practice.
  assert.equal(g.review('topic', 'home').remaining, 0);
  assert.equal(g.scope('topic', 'work').length, 1);
  assert.throws(() => g.scope('topic', 'unknown'), /Unknown topic/);
  assert.equal(g.home().plots.find(p => p.id === 'home')?.words[0].growth, 5);
});

test('concurrent additions cannot overfill a seed bag or lose progress', async () => {
  const g = fixture(); for (let i = 0; i < 19; i++) g.add(`word-${i}`, 'home');
  const store = memoryStore(g);
  const outcomes = await Promise.allSettled([19, 20].map(i => dispatch(`/topics/home/words/word-${i}/keep`, 'POST', new URLSearchParams(), {}, store, catalog)));
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(new Garden(catalog, store.state).bag().length, 20);
});

test('concurrent grading cannot apply the same review twice', async () => {
  const g = fixture(); g.add('word-0', 'home'); const store = memoryStore(g);
  const outcomes = await Promise.allSettled([1, 2].map(() => dispatch('/review', 'POST', new URLSearchParams(), { word_id: 'word-0', grade: 3, scope: 'bag' }, store, catalog)));
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(store.state.reviews.length, 1);
});

test('ordinary discovery never waits for AI, while submitted guidance still uses it', async () => {
  const garden = fixture();
  for (let i = 0; i < 5; i++) garden.add(`word-${i}`, 'home');
  const store = memoryStore(garden);
  let calls = 0;
  const complete = async () => { calls++; return { home: 3, work: 1 }; };
  await dispatch('/matcher', 'GET', new URLSearchParams(), {}, store, catalog, complete);
  assert.equal(calls, 0);
  await dispatch('/guide', 'POST', new URLSearchParams(), { guidance: 'Words for home' }, store, catalog, complete);
  assert.equal(calls, 1);
  assert.equal(store.state.weights.home, 3);
});

test('topic selection prefers least explored eligible topics and respects exclusions', () => {
  const garden = fixture();
  garden.add('word-0', 'home');
  assert.equal(garden.bestTopic(), 'work');
  assert.equal(garden.bestTopic('work'), 'home');
  garden.state.known.push('word-22', 'word-23');
  assert.equal(garden.bestTopic(), 'home');
  assert.equal(garden.bestTopic('home'), null);
});

test('reviews reuse their initial progress read', async () => {
  const g = fixture(); g.add('word-0', 'home');
  const store = memoryStore(g);
  let reads = 0;
  const counted: Store = {
    async load() { reads++; return store.load(); },
    save: (version, data) => store.save(version, data),
  };
  await dispatch('/review', 'POST', new URLSearchParams(), { word_id: 'word-0', grade: 3, scope: 'bag' }, counted, catalog);
  assert.equal(reads, 1);
  assert.equal(store.state.reviews.length, 1);
});

test('catalogue indexes preserve memberships, sentence choices and catalogue isolation', () => {
  const g = fixture();
  for (const word of catalog.words) {
    for (const activity of catalog.activities) {
      assert.equal(g.inTopic(word.id, activity.id), catalog.word_activities.some(row => row.word_id === word.id && row.activity_id === activity.id));
    }
    assert.equal(g.sentence(word).sentence_id, catalog.sentences.find(sentence => sentence.word_id === word.id)?.id);
  }
  const other = new Garden({ ...catalog, word_activities: [], sentences: [] }, freshLearner('Other'));
  assert.equal(other.inTopic('word-0', 'home'), false);
  assert.equal(other.sentence(other.word('word-0')).sentence_id, null);
  assert.equal(g.inTopic('word-0', 'home'), true);
});

test('practice AI preserves state and rejects out-of-scope words', async () => {
  const g = fixture(); g.add('word-0', 'home');
  const before = structuredClone(g.state);
  const result = await aiPractice('/reading', { scope: 'bag' }, g, async () => ({ setting: 'Test', de: 'Hallo.', en: 'Hello.' }));
  assert.ok('targets' in result); assert.deepEqual(g.state, before);
  await assert.rejects(aiPractice('/chat', { scope: 'bag', target_ids: ['word-22'] }, g, async () => ({})), /current practice set/);
  await assert.rejects(aiPractice('/grammar', { word_id: 'word-0', config: { case: 'wrong' } }, g, async () => ({})), /valid grammar option/);
  const chat = await aiPractice('/chat', { scope: 'bag', target_ids: ['word-0'], message: 'Hallo', history: [] }, g,
    async () => ({ reply: 'Guten Tag!', corrections: [{ original: 'unrelated', corrected: 'other' }] }));
  assert.ok('history' in chat && Array.isArray(chat.history)); assert.deepEqual(chat.history[0].corrections, []);
});


test('scheduler matches the original Python implementation over every stage and rating', () => {
  const states = [initialSrs(), { ...initialSrs(), state: 'relearning', reps: 0, lapses: 2 }, ...[1, 7, 21, 45, 60].map(interval_days => ({ ...initialSrs(), state: interval_days >= 60 ? 'graduated' : 'review', interval_days, reps: 4 }))];
  const cases = states.flatMap(state => [1, 2, 3, 4].map(grade => ({ state, grade })));
  const expected = JSON.parse(execFileSync('python3', ['-c', 'import json,sys; from app.garden import review_outcome,growth_stage; print(json.dumps([dict(outcome=review_outcome(c["state"],c["grade"]),growth=growth_stage(review_outcome(c["state"],c["grade"]))) for c in json.load(sys.stdin)]))'], { input: JSON.stringify(cases), encoding: 'utf8' }));
  cases.forEach((c, i) => { const outcome = reviewOutcome(c.state, c.grade); assert.deepEqual(outcome, expected[i].outcome); assert.equal(growth(outcome), expected[i].growth); });
});
