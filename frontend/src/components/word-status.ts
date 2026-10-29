import type { Word } from '../api';

export const statuses: Record<string, string> = {
  new: 'Unseen',
  not_now: 'Not now',
  learned: 'Learned',
  bag: 'In seed bag',
  planted: 'Planted',
  due: 'Review due',
  grown: 'Grown',
};
export const statusLabel = (word: Word) => {
  return word.review_due ? 'Review due' : word.learned ? 'Learned' : statuses[word.status || 'new'];
};
