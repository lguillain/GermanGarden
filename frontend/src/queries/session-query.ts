import { queryOptions } from '@tanstack/react-query';
import { api, type Session } from '../api';

export const sessionQuery = () =>
  queryOptions({
    queryKey: ['session'],
    queryFn: () => api<Session>('/session'),
    staleTime: 30_000,
  });
