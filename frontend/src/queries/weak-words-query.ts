import { queryOptions } from '@tanstack/react-query';
import { api } from '../api';
import type { PracticeWord } from '../pages/practice/practice-round';

export const weakWordsQuery = (query = '?scope=all&topic=') =>
  queryOptions({
    queryKey: ['practice', 'weak', query],
    queryFn: () => api<{ words: PracticeWord[] }>(`/practice/weak${query}`),
    staleTime: 30_000,
  });
