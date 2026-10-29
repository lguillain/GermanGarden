import type { Catalog, Word } from './model.ts';

// Experimental: word families are derived from the catalogue on demand, so the
// rules can change freely while the feature is evaluated. Associated words are
// chosen offline by the vocabulary pipeline (word_associations).
const MIN_STEM = 4;
const LIMIT = 6;
const FILLERS = new Set(['der', 'die', 'das', 'sich', 'sein', 'ein', 'eine', 'bsp']);
const PREFIXES = new Set([
  'ab', 'an', 'auf', 'aus', 'be', 'bei', 'ein', 'emp', 'ent', 'er', 'ge', 'her', 'hin',
  'los', 'mit', 'nach', 'um', 'un', 'ver', 'vor', 'weg', 'zer', 'zu', 'zurück',
]); // prettier-ignore
const SUFFIXES = new Set(['e', 'en', 'er', 'n', 't', 'st', 'in', 'ung', 's', 'es', 'ig', 'lich']);
// Word-forming endings that may follow a stem, as in "Wunder|bar" or "Frei|heit".
const ENDINGS = new Set([
  'bar', 'heit', 'keit', 'schaft', 'lich', 'ung', 'ungen', 'los', 'chen', 'isch', 'ling', 'nis', 'sam', 'erin', 'ern',
]); // prettier-ignore
// Linking letters between compound parts, as in "Arbeit|s|platz" or "Geburt|s|tag".
const LINKS = ['', 's', 'n', 'en', 'es', 'e', 'er'];
const STEM_POS = new Set(['noun', 'verb', 'other']);

export interface RelatedWordIds {
  family: string[];
  together: string[];
}

interface Index {
  words: Map<string, Word>;
  parts: CompoundParts;
  forms: Map<string, string[]>;
  stems: Map<string, Stem[]>;
}

const indexes = new WeakMap<Catalog, Index>();

// Umlauts are folded so that "Arzt" matches "Ärztin" and "kaufen" matches "Käufer".
const letters = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-zäöüß]/g, '')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');

// Lemmas contain variants such as "(ab)fahren", "der/die Bekannte" and "Rad fahren".
function lemmaVariants(lemma: string): string[][] {
  return lemma
    .split('/')
    .flatMap((alternative) => [
      alternative.replace(/[()]/g, ''),
      alternative.replace(/\([^)]*\)/g, ''),
    ])
    .map((variant) =>
      variant
        .split(/\s+/)
        .map(letters)
        .filter((token) => token && !FILLERS.has(token)),
    )
    .filter((tokens) => tokens.length);
}

export function lemmaForms(lemma: string): string[] {
  return [...new Set(lemmaVariants(lemma).flatMap((tokens) => [...tokens, tokens.join('')]))];
}

// Verbs such as "atmen", "regnen" and "öffnen" drop an "e" from the related
// word ("Atem", "Regen", "offen"), so their stems are also tried with it restored.
// A restored stem must start the related word, so "regnen" matches "Regen" but not "aufregen".
interface Stem {
  text: string;
  restored: boolean;
}

export function wordStems(word: Word): Stem[] {
  if (!STEM_POS.has(word.pos)) return [];
  const stems = new Map<string, Stem>();
  for (const form of lemmaForms(word.lemma)) {
    const stem = word.pos === 'verb' ? form.replace(/e?n$/, '') : form;
    stems.set(stem, { text: stem, restored: false });
    if (word.pos === 'verb' && /[^aeiou][mn]$/.test(stem)) {
      const restored = `${stem.slice(0, -1)}e${stem.slice(-1)}`;
      if (!stems.has(restored)) stems.set(restored, { text: restored, restored: true });
    }
  }
  return [...stems.values()].filter((stem) => stem.text.length >= MIN_STEM);
}

// A compound part is a vocabulary word, or a word part that at least two
// vocabulary words share ("-tag" in "Feiertag" and "Montag"), since many
// everyday compound parts are not in the learner vocabulary themselves.
export interface CompoundParts {
  isHead(part: string): boolean;
  isModifier(part: string): boolean;
}

export function compoundParts(forms: Iterable<string>): CompoundParts {
  const vocabulary = new Set<string>();
  const endings = new Map<string, number>();
  const beginnings = new Map<string, number>();
  for (const form of forms) {
    if (vocabulary.has(form)) continue;
    vocabulary.add(form);
    for (let i = 1; i <= form.length - 3; i++) {
      endings.set(form.slice(i), (endings.get(form.slice(i)) ?? 0) + 1);
      beginnings.set(form.slice(0, -i), (beginnings.get(form.slice(0, -i)) ?? 0) + 1);
    }
  }
  const part = (shared: Map<string, number>) => (value: string) =>
    value.length >= 3 && (vocabulary.has(value) || (shared.get(value) ?? 0) >= 2);
  return { isHead: part(endings), isModifier: part(beginnings) };
}

// A stem relates to a form when the remaining parts are a prefix, an ending, or
// another vocabulary word (for example "ab|fahr|t", "Fahr|karte", "Haus|tür").
// Leftover letters that form no word ("Wunde|rbar") do not count as a compound.
// Only nouns start with another compound part, which avoids "Ende" in "anwenden".
export function stemInForm(
  stem: string,
  form: string,
  noun: boolean,
  parts: CompoundParts,
  restored = false,
): boolean {
  const compoundHead = (part: string) =>
    LINKS.some((link) => part.startsWith(link) && parts.isHead(part.slice(link.length)));
  const compoundModifier = (part: string) =>
    LINKS.some(
      (link) => part.endsWith(link) && parts.isModifier(part.slice(0, part.length - link.length)),
    );
  for (let at = form.indexOf(stem); at !== -1; at = form.indexOf(stem, at + 1)) {
    const before = form.slice(0, at);
    const after = form.slice(at + stem.length);
    if (
      (before === '' ||
        (!restored && (PREFIXES.has(before) || (noun && compoundModifier(before))))) &&
      (after === '' || SUFFIXES.has(after) || ENDINGS.has(after) || compoundHead(after))
    )
      return true;
  }
  return false;
}

function index(catalog: Catalog): Index {
  let result = indexes.get(catalog);
  if (result) return result;
  result = {
    words: new Map(catalog.words.map((word) => [word.id, word])),
    parts: compoundParts([]),
    forms: new Map(),
    stems: new Map(),
  };
  for (const word of catalog.words) {
    result.forms.set(word.id, lemmaForms(word.lemma));
    result.stems.set(word.id, wordStems(word));
  }
  // Verbs appear in compounds as their stem: "Fahr|karte", "Wasch|maschine".
  result.parts = compoundParts(
    catalog.words.flatMap((word) =>
      result!.forms
        .get(word.id)!
        .flatMap((form) => (word.pos === 'verb' ? [form, form.replace(/e?n$/, '')] : [form])),
    ),
  );
  indexes.set(catalog, result);
  return result;
}

const related = (data: Index, a: string, b: string) =>
  data.stems
    .get(a)!
    .some((stem) =>
      data.forms
        .get(b)!
        .some((form) =>
          stemInForm(stem.text, form, data.words.get(b)!.pos === 'noun', data.parts, stem.restored),
        ),
    );

// Folding umlauts must not equate different words such as "schön" and "schon".
const umlautTwins = (a: Word, b: Word) =>
  letters(a.lemma) === letters(b.lemma) && a.lemma.toLowerCase() !== b.lemma.toLowerCase();

// Catalogue entries such as "fahren" and "(ab)fahren" list the same word twice.
const variantOf = (data: Index, a: string, b: string) =>
  data.words.get(a)!.pos === data.words.get(b)!.pos &&
  data.forms.get(a)!.some((form) => data.forms.get(b)!.includes(form));

export function relatedWordIds(
  catalog: Catalog,
  wordId: string,
  associated: string[] = [],
): RelatedWordIds {
  const data = index(catalog);
  if (!data.words.has(wordId)) return { family: [], together: [] };
  const candidate = (id: string) => id !== wordId && !variantOf(data, wordId, id);

  const family = catalog.words
    .filter(
      (other) =>
        candidate(other.id) &&
        !umlautTwins(data.words.get(wordId)!, other) &&
        (related(data, wordId, other.id) || related(data, other.id, wordId)),
    )
    .sort((a, b) => a.lemma.length - b.lemma.length || a.lemma.localeCompare(b.lemma))
    .map((other) => other.id);

  // Associations come from the offline vocabulary pipeline; only keep known,
  // distinct words that are not already listed as family.
  const together: string[] = [];
  for (const id of associated)
    if (
      together.length < LIMIT &&
      data.words.has(id) &&
      candidate(id) &&
      !family.includes(id) &&
      !together.some((chosen) => chosen === id || variantOf(data, chosen, id))
    )
      together.push(id);

  return { family: family.slice(0, LIMIT), together };
}
