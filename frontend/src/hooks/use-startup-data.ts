import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { gardenQuery } from '../queries/garden-query';
import { practiceSummaryQuery } from '../pages/practice/use-practice-summary';
import { practiceWordsQuery } from '../pages/practice/use-practice-words';

// Start read-only page data while the server verifies the learner profile.
// Pages use these same query options, so mounting reuses the result/request.
export function useStartupData(signedIn: boolean) {
  const cache = useQueryClient();
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!signedIn) return;
    const params = new URLSearchParams(search);
    const query = `?${new URLSearchParams({ scope: params.get('scope') || 'all', topic: params.get('topic') || '' })}`;
    if (pathname === '/' || pathname === '/explore') void cache.prefetchQuery(gardenQuery());
    if (['/practice', '/practice/read', '/practice/chat'].includes(pathname))
      void cache.prefetchQuery(practiceSummaryQuery(query));
    if (pathname === '/practice/grammar') void cache.prefetchQuery(practiceWordsQuery(query));
  }, [cache, signedIn, pathname, search]);
}
