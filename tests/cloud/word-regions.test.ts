import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { freshLearner } from '../../supabase/functions/garden/model.ts';

test('regional annotations reach word details without changing learner state', () => {
  const words = ['noun_brotli', 'noun_fauteuil', 'noun_baum'].map(id => ({ id, lemma: id, pos: 'noun', level: 'B1', english: id }));
  const state = freshLearner('Test');
  const before = structuredClone(state);
  const garden = new Garden({ words, activities: [], word_activities: [], sentences: [] }, state);
  assert.deepEqual(garden.details(words[0]).regions, ['CH']);
  assert.deepEqual(garden.details(words[1]).regions, ['AT', 'CH']);
  assert.equal(garden.details(words[2]).regions, undefined);
  assert.deepEqual(state, before);
});
