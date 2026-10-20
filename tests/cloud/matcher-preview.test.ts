import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { freshLearner, Catalog } from '../../supabase/functions/garden/model.ts';
import { matcherPreview } from '../../supabase/functions/garden/matcher-preview.ts';

const catalog: Catalog = {
  words: Array.from({ length: 60 }, (_, i) => ({ id: `w${i}`, lemma: `Word ${i}`, level: ['A1','A2','B1'][i % 3], pos: 'noun', english: 'word' })),
  activities: [{ id: 'home', name: 'Home' }, { id: 'work', name: 'Work' }],
  word_activities: Array.from({ length: 60 }, (_, i) => ({ word_id: `w${i}`, activity_id: i < 30 ? 'home' : 'work', relevance: 3 })),
  sentences: Array.from({ length: 60 }, (_, i) => ({ id: i, word_id: `w${i}`, activity_id: i < 30 ? 'home' : 'work', text: 'Example', english: 'Example' })),
};
test('previews match confirmed decisions, including topic changes, without changing progress', () => {
  for (const action of ['keep','learned','not_now'] as const) {
    const garden = new Garden(catalog, freshLearner('Test'));
    garden.state.user.level = 'A2'; garden.state.user.current_topic = 'home';
    garden.state.user.cards_in_bucket = 5; garden.state.user.drop_streak = 6;
    const result = garden.matcher(), before = structuredClone(garden.state);
    const response = matcherPreview(garden, result);
    assert.deepEqual(garden.state, before);
    const card = result.card!;
    const confirmed = garden.swipe(card.word_id, action, card.activity_id, card.sentence_id!);
    assert.deepEqual(response.previews[action], confirmed);
    assert.notEqual(confirmed.card?.word_id, card.word_id);
  }
});
test('compact historical IDs stay excluded, and previews handle an exhausted seed bank', () => {
  const state = freshLearner('Test'); state.user.level = 'A2'; state.user.current_topic = 'home';
  state.seen_ids = catalog.words.filter(w => w.id !== 'w1').map(w => w.id);
  const garden = new Garden(catalog, state);
  const response = matcherPreview(garden, garden.matcher());
  assert.equal(response.card?.word_id, 'w1');
  for (const preview of Object.values(response.previews)) assert.equal(preview?.card, null);
});
