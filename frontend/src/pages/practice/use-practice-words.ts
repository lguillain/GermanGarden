import { useQuery } from '@tanstack/react-query';
import { api, type GrammarOptions, type Word } from '../../api';
export interface PracticeWords {
  words: Word[];
  grammar_options: GrammarOptions;
  counts: { plants: number; seeds: number };
}
export function usePracticeWords(query: string) {
  return useQuery({
    queryKey: ['practice', query],
    queryFn: () => api<PracticeWords>(`/practice${query}`),
  });
}
