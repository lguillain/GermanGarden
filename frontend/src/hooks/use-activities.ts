import { useQuery } from '@tanstack/react-query';
import { api, type Activity } from '../api';

export function useActivities(enabled = true) {
  return useQuery({
    queryKey: ['activities'],
    queryFn: () => api<Activity[]>('/activities'),
    staleTime: 300_000,
    enabled,
  });
}
