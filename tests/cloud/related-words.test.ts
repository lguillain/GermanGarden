import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Catalog, type Word, freshLearner } from '../../supabase/functions/garden/model.ts';
import { compoundParts, lemmaForms, relatedWordIds, stemInForm } from '../../supabase/functions/garden/related-words.ts';
import { dispatch } from '../../supabase/functions/garden/service.ts';

const word = (id: string, lemma: string, pos = 'noun'): Word => ({ id, lemma, pos, english: id, level: 'A1' });
const catalog: Catalog = {
  activities: [],
  word_activities: [],
  words: [
    word('fahren', 'fahren', 'verb'), word('ab-fahren', '(ab)fahren', 'verb'), word('abfahrt', 'Abfahrt'),
    word('fahrkarte', 'Fahrkarte'), word('karte', 'Karte'), word('rad', 'Rad'), word('radio', 'Radio'), word('ende', 'Ende'),
    word('anwenden', 'anwenden', 'verb'), word('zug', 'Zug'), word('bahnhof', 'Bahnhof'), word('mit', 'mit', 'prep'),
    word('atmen', 'atmen', 'verb'), word('atem', 'Atem'), word('regnen', 'regnen', 'verb'), word('regen', 'Regen'),
    word('aufregen', 'aufregen', 'verb'), word('schoen', 'schön', 'other'), word('schon', 'schon', 'other'),
    word('arzt', 'Arzt'), word('aerztin', 'Ärztin'), word('see', 'See'),
  ],
  sentences: [],
};

test('lemma forms handle optional parts, alternatives and fillers', () => {
  assert.deepEqual(lemmaForms('(ab)fahren').sort(), ['abfahren', 'fahren']);
  assert.deepEqual(lemmaForms('der/die Bekannte'), ['bekannte']);
  assert.deepEqual(lemmaForms('Rad fahren').sort(), ['fahren', 'rad', 'radfahren']);
});

test('family links shared stems and compounds without loose substring matches', () => {
  const parts = compoundParts(['karte', 'feiertag', 'montag', 'wunder']);
  assert.ok(stemInForm('fahr', 'abfahrt', true, parts));
  assert.ok(stemInForm('fahr', 'fahrkarte', true, parts));
  assert.ok(stemInForm('geburt', 'geburtstag', true, parts)); // "-tag" is shared by two words
  assert.ok(stemInForm('wunder', 'wunderbar', false, parts));
  assert.ok(!stemInForm('wunde', 'wunderbar', false, parts)); // "rbar" is not a word part
  assert.ok(!stemInForm('ende', 'anwenden', false, parts));
  const { family } = relatedWordIds(catalog, 'fahren');
  assert.deepEqual(family.sort(), ['abfahrt', 'fahrkarte']); // "(ab)fahren" is a duplicate entry
  assert.deepEqual(relatedWordIds(catalog, 'rad').family, []);
  assert.deepEqual(relatedWordIds(catalog, 'ende').family, []);
  assert.deepEqual(relatedWordIds(catalog, 'atmen').family, ['atem']);
  assert.deepEqual(relatedWordIds(catalog, 'regnen').family, ['regen']); // not "aufregen"
  assert.deepEqual(relatedWordIds(catalog, 'arzt').family, ['aerztin']);
  assert.deepEqual(relatedWordIds(catalog, 'schoen').family, []);
});

test('used together keeps pipeline associations that are known, distinct and not family', () => {
  const { together } = relatedWordIds(catalog, 'zug', ['bahnhof', 'missing', 'zug', 'bahnhof', 'see']);
  assert.deepEqual(together, ['bahnhof', 'see']);
  assert.deepEqual(relatedWordIds(catalog, 'fahren', ['abfahrt', 'zug']).together, ['zug']);
  assert.deepEqual(relatedWordIds(catalog, 'unknown', ['zug']), { family: [], together: [] });
});

test('related words route returns the learner’s own word states and never writes', async () => {
  const learner = freshLearner('Test');
  learner.swipes = [{ word_id: 'abfahrt', activity_id: null, sentence_id: null, action: 'keep', swiped_at: '2026-01-01T00:00:00Z', planted_at: null }];
  const store = {
    async load() { return { version: 1, data: learner }; },
    async save(): Promise<boolean> { throw new Error('Must not save'); },
    async associations(id: string) { assert.equal(id, 'fahren'); return ['zug', 'see']; },
  };
  const response = (await dispatch('/words/fahren/related', 'GET', new URLSearchParams({ user_id: 'other' }), {}, store, catalog)) as {
    word: Word; family: (Word & { status: string })[]; together: Word[];
  };
  assert.equal(response.word.id, 'fahren');
  assert.equal(response.family.find((w) => w.id === 'abfahrt')?.status, 'bag');
  assert.equal(response.family.find((w) => w.id === 'fahrkarte')?.status, 'new');
  assert.deepEqual(response.together.map((w) => w.id), ['zug', 'see']);
  await assert.rejects(dispatch('/words/missing/related', 'GET', new URLSearchParams(), {}, store, catalog), /Unknown word/);
});
