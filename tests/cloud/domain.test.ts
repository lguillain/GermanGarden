import { test } from 'node:test';
import { gardenGnomeCount } from '../../frontend/src/components/garden-gnome-count.ts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { Catalog, freshLearner } from '../../supabase/functions/garden/model.ts';
import { growth, initialSrs, reviewOutcome } from '../../supabase/functions/garden/scheduler.ts';
import { dispatch, Store } from '../../supabase/functions/garden/service.ts';
import { aiPractice } from '../../supabase/functions/garden/ai.ts';
import { createCompletion } from '../../supabase/functions/garden/anthropic.ts';

export const catalog: Catalog = {
  words: Array.from({ length: 24 }, (_, i) => ({ id: `word-${i}`, lemma: `Wort${i}`, article: 'das', pos: 'noun', english: `word ${i}`, level: 'A2' })),
  activities: [{ id: 'home', name: 'Home' }, { id: 'work', name: 'Work' }],
  word_activities: Array.from({ length: 24 }, (_, i) => ({ word_id: `word-${i}`, activity_id: i < 22 ? 'home' : 'work', relevance: 3 })),
  sentences: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, word_id: `word-${i}`, activity_id: i < 22 ? 'home' : 'work', text: `Ein Wort${i}.`, english: `A word ${i}.` })),
};
function fixture() { const state = freshLearner('Test'); state.user.level = 'A2'; return new Garden(catalog, state, Date.parse('2026-10-19T12:00:00Z')); }

test('Forms generation supplies a valid JSON example that the provider parser accepts', async (t) => {
  const g = fixture();
  g.add('word-0', 'home');
  const before = structuredClone(g.state);
  let example: Record<string, string> | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(init.body as string);
    const raw = request.system.slice(request.system.lastIndexOf('\n') + 1);
    example = JSON.parse(raw);
    return Response.json({ content: [{ type: 'text', text: raw }] });
  });
  const result = await aiPractice('/grammar', { word_id: 'word-0', action: 'generate' }, g, createCompletion('test-key')!);
  assert.deepEqual(Object.keys(result), ['case_trigger', 'expected_form', 'de', 'en', 'focus']);
  assert.deepEqual(result, example);
  assert.deepEqual(g.state, before);
});
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

test('today counts each planted word once across tracks, including overdue but excluding seeds and Learned words', () => {
  const g = fixture();
  g.now = Date.parse('2026-10-25T12:00:00Z');
  for (let i = 0; i < 8; i++) {
    g.add(`word-${i}`, 'home');
    g.kept(`word-${i}`)!.planted_at = g.iso();
    g.state.srs[`word-${i}`] = { ...initialSrs(), due_at: '2026-10-26T12:00:00Z' };
  }
  g.state.srs['word-0'].due_at = '2026-10-24T10:00:00Z'; // overdue
  g.state.srs['word-1'].due_at = '2026-10-25T22:59:59Z'; // just before local midnight
  g.state.srs['word-1'].production = { ...initialSrs(), due_at: '2026-10-25T20:00:00Z' };
  g.state.srs['word-2'].production = { ...initialSrs(), due_at: '2026-10-25T18:00:00Z' };
  g.state.srs['word-3'].due_at = '2026-10-25T23:00:00Z'; // tomorrow in Zurich, today in UTC
  g.state.srs['word-4'].due_at = g.iso();
  g.state.known.push('word-4');
  g.state.srs['word-5'].due_at = g.iso();
  g.state.learned.push('word-5');
  g.state.srs['word-6'].due_at = g.iso();
  g.kept('word-6')!.planted_at = null;
  delete g.state.srs['word-7']; // unscheduled planted word
  const before = structuredClone(g.state);
  assert.deepEqual(g.home('Europe/Zurich').summary.upcoming_reviews, [{ date: '2026-10-25', count: 2 }, { date: '2026-10-26', count: 1 }]);
  assert.equal(g.home('Europe/Zurich').summary.due_today, 4);
  assert.equal(g.home('UTC').summary.due_today, 5);
  assert.equal(g.home('Europe/Zurich').summary.due_now, 2);
  assert.equal(g.review().remaining, 2); // upcoming words cannot be reviewed early
  assert.deepEqual(g.state, before);
  assert.throws(() => g.home('Not/AZone'), /Unknown time zone/);
});

test('today uses local calendar dates across DST and UTC date boundaries', () => {
  for (const [now, zone, lastToday, tomorrow] of [
    ['2026-03-28T23:30:00Z', 'Europe/Zurich', '2026-03-29T21:59:59Z', '2026-03-29T22:00:00Z'],
    ['2026-10-24T22:30:00Z', 'Europe/Zurich', '2026-10-25T22:59:59Z', '2026-10-25T23:00:00Z'],
    ['2026-10-26T02:00:00Z', 'America/Los_Angeles', '2026-10-26T06:59:59Z', '2026-10-26T07:00:00Z'],
  ]) {
    const g = fixture();
    g.now = Date.parse(now);
    g.add('word-0', 'home');
    g.kept('word-0')!.planted_at = g.iso();
    g.state.srs['word-0'] = { ...initialSrs(), due_at: lastToday };
    assert.equal(g.home(zone).summary.due_today, 1);
    assert.equal(g.home(zone).summary.due_now, 0);
    g.state.srs['word-0'].due_at = tomorrow;
    assert.equal(g.home(zone).summary.due_today, 0);
  }
});

test('Forms options bypass progress reads and exercises preserve schedules for seeds, plants and Learned words', async () => {
  const g = fixture();
  const store = memoryStore(g);
  store.load = async () => { throw new Error('Options must not load progress'); };
  const options = await dispatch('/grammar/options', 'GET', new URLSearchParams(), {}, store, catalog);
  assert.ok('noun' in options);
  g.add('word-0', 'home');
  g.add('word-1', 'home');
  g.grade('word-1', 3, 'bag');
  g.state.known.push('word-2');
  const before = structuredClone(g.state);
  for (const id of ['word-0', 'word-1', 'word-2']) {
    for (const action of ['generate', 'correct']) {
      await aiPractice('/grammar', { word_id: id, config: { case: 'Dativ' }, action, sentence: 'Ein Wort.' }, g,
        async () => ({ expected_form: 'dem Wort', de: 'Mit dem Wort.', corrections: [] }));
    }
  }
  assert.deepEqual(g.state, before);
  await assert.rejects(aiPractice('/grammar', { word_id: 'word-3' }, g, async () => ({})), /Practice word not found/);
});

test('words found today counts first keeps in local time, including planted and Learned words', () => {
  const g = fixture();
  g.now = Date.parse('2026-10-25T12:00:00Z');
  for (let i = 0; i < 3; i++) g.add(`word-${i}`, 'home');
  g.state.swipes[0].swiped_at = '2026-10-24T22:30:00Z'; // today in Zurich, yesterday UTC
  g.state.swipes[1].swiped_at = '2026-10-24T21:30:00Z';
  g.state.swipes[2].planted_at = g.iso();
  g.state.learned.push('word-2');
  g.state.known.push('word-4'); // never kept
  g.state.swipes.push({ ...g.state.swipes[1], swiped_at: g.iso() }); // duplicate old keep
  g.state.swipes.push({ ...g.state.swipes[0], word_id: 'word-3', action: 'drop', swiped_at: g.iso() });
  const before = structuredClone(g.state);
  assert.equal(g.home('Europe/Zurich').summary.found_today, 2);
  assert.equal(g.home('UTC').summary.found_today, 1);
  assert.deepEqual(g.state, before);
});

test('weak practice selects current difficulty once per planted word and excludes seeds, Learned and fresh production', () => {
  const g = fixture();
  for (let i = 0; i < 9; i++) {
    g.add(`word-${i}`, 'home');
    g.kept(`word-${i}`)!.planted_at = g.iso();
    g.state.srs[`word-${i}`] = { ...initialSrs(), interval_days: 4, last_grade: 3 };
  }
  g.state.srs['word-0'].last_grade = 2; // Hard even with a long interval
  g.state.srs['word-1'].production = { ...initialSrs(), last_grade: 1, last_review_at: g.iso(), interval_days: 1 / 1440 };
  g.state.srs['word-1'].last_grade = 2; // both tracks qualify, one word
  g.state.srs['word-2'].interval_days = 0.5;
  g.state.srs['word-3'].interval_days = 1; // exactly one day doesn't qualify
  g.state.srs['word-4'].production = initialSrs(); // newly unlocked
  g.state.srs['word-5'].last_grade = 1;
  g.state.learned.push('word-5');
  g.state.srs['word-6'].last_grade = 1;
  g.kept('word-6')!.planted_at = null;
  g.state.reviews.push({ word_id: 'word-7', grade: 1, track: 'recognition', reviewed_at: '2020-01-01' }); // obsolete rating
  const before = structuredClone(g.state);
  assert.deepEqual(g.weakWords().map(word => word.id), ['word-1', 'word-0', 'word-2']);
  assert.equal(g.weakWords()[0].practice_reasons.length, 2);
  assert.deepEqual(g.weakWords('bag'), []);
  assert.deepEqual(g.weakWords('topic', 'work'), []);
  assert.deepEqual(g.state, before);
});

test('reading and chat preserve exact session targets, validate ownership, and never mutate progress', async () => {
  const g = fixture();
  for (let i = 0; i < 6; i++) { g.add(`word-${i}`, 'home'); g.kept(`word-${i}`)!.planted_at = g.iso(); }
  const ids = ['word-4', 'word-2', 'word-0'];
  const before = structuredClone(g.state);
  const reading = await aiPractice('/reading', { target_ids: ids }, g, async () => ({ de: 'Text.', en: 'Text.' }));
  assert.ok('targets' in reading && Array.isArray(reading.targets));
  assert.deepEqual(reading.targets.map(word => word.id), ids);
  const chat = await aiPractice('/chat', { target_ids: ids, start: true }, g, async () => ({ reply: 'Hallo!' }));
  assert.ok('targets' in chat && Array.isArray(chat.targets) && 'history' in chat && Array.isArray(chat.history));
  assert.deepEqual(chat.targets.map(word => word.id), ids);
  assert.deepEqual(chat.history.map(message => message.role), ['assistant']);
  for (const path of ['/reading', '/chat']) {
    for (const target_ids of [['word-23'], ['word-0', 'word-0'], Array.from({ length: 6 }, (_, i) => `word-${i}`)]) {
      await assert.rejects(aiPractice(path, { target_ids, start: true }, g, async () => { throw new Error('must not call AI'); }), /target words|practice set/);
    }
  }
  assert.deepEqual(g.state, before);
});

test('gnomes follow the oldest overdue track, exclude seeds and Learned words, and recede after review', () => {
  const g = fixture();
  for (const id of ['word-0', 'word-1', 'word-22']) {
    g.add(id, id === 'word-22' ? 'work' : 'home');
    g.grade(id, 3, 'bag');
  }
  const ago = (hours: number) => new Date(g.now - hours * 3_600_000).toISOString();
  g.state.srs['word-0'].due_at = ago(168);
  g.state.srs['word-1'].due_at = ago(48);
  g.state.srs['word-22'].due_at = ago(12);
  const count = (topic: string) => gardenGnomeCount(g.home().plots.find(p => p.id === topic)!.words, g.now);
  assert.equal(count('home'), 6);
  assert.equal(count('work'), 1);
  const before = structuredClone(g.state);
  g.practice('topic', 'home');
  assert.deepEqual(g.state, before);
  assert.equal(count('home'), 6);
  g.grade('word-0', 3);
  assert.equal(count('home'), 3);
  g.grade('word-1', 3);
  assert.equal(count('home'), 0);
  g.state.srs['word-0'].due_at = ago(96);
  g.state.srs['word-0'].production = { ...initialSrs(), due_at: ago(168) };
  assert.equal(count('home'), 6);
  g.grade('word-0', 2);
  assert.equal(count('home'), 5); // Hard production leaves recognition overdue.
  g.state.learned.push('word-0');
  assert.equal(count('home'), 0);
  assert.equal(g.details(g.word('word-0')).overdue_since, null);
  g.add('word-2', 'home');
  g.state.srs['word-2'] = { ...initialSrs(), due_at: ago(168) };
  assert.equal(g.details(g.word('word-2')).overdue_since, null);
});

test('gnome arrival thresholds are exact and capped at six', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  for (const [hours, expected] of [[0, 0], [11.999, 0], [12, 1], [23.999, 1], [24, 2], [48, 3], [72, 4], [96, 5], [120, 6], [168, 6], [1000, 6]]) {
    const word = { ...catalog.words[0], review_due: true, overdue_since: new Date(now - hours * 3_600_000).toISOString() };
    assert.equal(gardenGnomeCount([word], now), expected, `${hours} hours`);
    assert.equal(gardenGnomeCount([{ ...word, learned: true }], now), 0);
  }
  assert.equal(gardenGnomeCount([], now), 0);
  assert.equal(gardenGnomeCount([{ ...catalog.words[0], review_due: true, overdue_since: 'invalid' }], now), 0);
});
