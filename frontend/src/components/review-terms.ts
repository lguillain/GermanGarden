import type { Word } from '../api';

// Vocabulary shared by review, practice and the design reference.
export const ARTICLES = ['der', 'die', 'das'] as const;
export const DIRECTION_LABELS = { recognition: 'DE → EN', production: 'EN → DE' } as const;
export const RATING_LABELS = ['Again', 'Hard', 'Good', 'Easy'] as const;

// Matches the server's article check: only nouns with der/die/das have one.
export function hasArticle(word: Pick<Word, 'pos' | 'article'> | null | undefined) {
  const article = word?.article?.trim().toLowerCase() || '';
  return word?.pos === 'noun' && (ARTICLES as readonly string[]).includes(article);
}
