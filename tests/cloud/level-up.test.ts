import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { freshLearner, type Catalog } from '../../supabase/functions/garden/model.ts';
import { dispatch, type Store } from '../../supabase/functions/garden/service.ts';

const catalog: Catalog = {
  words: ['A1', 'A2', 'B1'].flatMap(level => [0, 1].map(i => ({ id: `${level}-${i}`, lemma: 'Wort', english: 'word', pos: 'noun', level }))),
  activities: [], word_activities: [], sentences: [],
};
for (const level of ['A1', 'A2']) {
  test(`${level} suggests advancement only when its entire level is seen`, () => {
    const state = freshLearner('Test'); state.user.level = level;
    const garden = new Garden(catalog, state);
    assert.equal(garden.home().level_up, null);
    state.learned.push(`${level}-0`);
    assert.equal(garden.levelUpSuggestion(), null);
    state.seen_ids = [`${level}-1`];
    assert.deepEqual(garden.levelUpSuggestion(), { current_level: level, next_level: level === 'A1' ? 'A2' : 'B1', all_learned: false });
    state.learned.push(`${level}-1`);
    assert.equal(garden.levelUpSuggestion()?.all_learned, true);
  });
}
test('unset, B1 and empty levels do not suggest advancement', () => {
  const state = freshLearner('Test');
  const garden = new Garden(catalog, state);
  assert.equal(garden.levelUpSuggestion(), null);
  state.user.level = 'B1'; state.seen_ids = catalog.words.map(w => w.id);
  assert.equal(garden.levelUpSuggestion(), null);
  state.user.level = 'A1';
  assert.equal(new Garden({ ...catalog, words: [] }, state).levelUpSuggestion(), null);
});
test('level-up saves explicitly, preserves progress, and rejects duplicate or ineligible requests', async () => {
  const state = freshLearner('Test'); state.user.level = 'A1';
  state.seen_ids = catalog.words.map(w => w.id);
  state.user.affinity_below = 0.4; state.user.affinity_above = 1.5;
  let saved = structuredClone(state);
  const store: Store = {
    load: async () => ({ version: 0, data: structuredClone(saved) }),
    save: async (_version, data) => { saved = structuredClone(data); return true; },
  };
  await dispatch('/level-up', 'POST', new URLSearchParams(), { current_level: 'A1' }, store, catalog);
  assert.deepEqual(saved, { ...state, user: { ...state.user, level: 'A2', affinity_below: 1, affinity_above: 1 } });
  await assert.rejects(() => dispatch('/level-up', 'POST', new URLSearchParams(), { current_level: 'A1' }, store, catalog), /changed/);
  saved.seen_ids = [];
  await assert.rejects(() => dispatch('/level-up', 'POST', new URLSearchParams(), { current_level: 'A2' }, store, catalog), /changed/);
});

for (const [from, to] of [['A1', 'A2'], ['A2', 'B1'], ['B1', 'A1'], ['A2', 'A2']]) {
  test(`saving level ${from} → ${to} resets affinities only on a change`, async () => {
    const state = freshLearner('Test'); state.user.level = from;
    state.user.affinity_below = 0.4; state.user.affinity_above = 1.5;
    let saved = structuredClone(state);
    const store: Store = {
      load: async () => ({ version: 0, data: structuredClone(saved) }),
      save: async (_version, data) => { saved = structuredClone(data); return true; },
    };
    await dispatch('/onboarding', 'POST', new URLSearchParams(), { level: to }, store, catalog);
    assert.deepEqual(saved, { ...state, user: { ...state.user, level: to,
      affinity_below: from === to ? 0.4 : 1, affinity_above: from === to ? 1.5 : 1 } });
  });
}
