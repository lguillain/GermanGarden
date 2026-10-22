import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';

export interface PracticeSummary {
  word_count: number;
  counts: { plants: number; seeds: number };
}
export function usePracticeSummary(query: string) {
  return useQuery({
    queryKey: ['practice', 'summary', query],
    queryFn: () => api<PracticeSummary>(`/practice/summary${query}`),
    staleTime: 30_000,
  });
}
