import { queryOptions } from '@tanstack/react-query';
import { api, type Garden } from '../api';

export const gardenQuery = () =>
  queryOptions({
    queryKey: ['garden'],
    queryFn: () => api<Garden>('/garden'),
    staleTime: 30_000,
  });
