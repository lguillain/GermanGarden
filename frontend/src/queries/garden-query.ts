import { queryOptions } from '@tanstack/react-query';
import { api, type Garden } from '../api';

export const gardenQuery = () => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return queryOptions({
    queryKey: ['garden', timeZone],
    queryFn: () => api<Garden>(`/garden?time_zone=${encodeURIComponent(timeZone)}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};
