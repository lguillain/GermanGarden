import type { Word } from '../../api';
import { statusLabel } from '../../components/word-status';

export interface TopicWordSort {
  key: 'lemma' | 'english' | 'level' | 'status';
  descending: boolean;
}

export function topicWordList(
  words: Word[],
  {
    level,
    showOtherLevels,
    filter,
    search,
    sort,
  }: {
    level?: string | null;
    showOtherLevels: boolean;
    filter: string;
    search: string;
    sort: TopicWordSort | null;
  },
) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleWords = words.filter(
    (w) => showOtherLevels || w.level === level || (w.status !== 'new' && w.status !== 'not_now'),
  );
  const matching = visibleWords.filter(
    (w) =>
      (filter === 'all' ||
        (filter === 'due'
          ? w.review_due
          : filter === 'grown'
            ? w.visual_stage === 'grown'
            : filter === 'learned'
              ? w.learned
              : w.status === filter)) &&
      `${w.article || ''} ${w.lemma} ${w.english}`.toLowerCase().includes(normalizedSearch),
  );
  if (sort)
    matching.sort((a, b) => {
      const valueA = sort.key === 'status' ? statusLabel(a) : a[sort.key];
      const valueB = sort.key === 'status' ? statusLabel(b) : b[sort.key];
      const order = valueA.localeCompare(valueB, sort.key === 'lemma' ? 'de' : 'en', {
        numeric: true,
        sensitivity: 'base',
      });
      return (
        (sort.descending ? -order : order) ||
        a.lemma.localeCompare(b.lemma, 'de') ||
        a.id.localeCompare(b.id)
      );
    });
  return { visibleWords, matching };
}
