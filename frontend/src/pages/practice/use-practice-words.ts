import { queryOptions, useQuery } from '@tanstack/react-query';
import { api, type GrammarOptions, type Word } from '../../api';
export interface PracticeWords {
  words: Word[];
  grammar_options: GrammarOptions;
  counts: { plants: number; seeds: number };
}
export function practiceWordsQuery(query: string) {
  return queryOptions({
    staleTime: 30_000,
    queryKey: ['practice', query],
    queryFn: () => api<PracticeWords>(`/practice${query}`),
  });
}

export function usePracticeWords(query: string) {
  return useQuery(practiceWordsQuery(query));
}
