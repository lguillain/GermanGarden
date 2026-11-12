import { useLocation, useSearchParams } from 'react-router-dom';

// Seeds start with recognition; planted words default to production.
export function reviewMode(params: URLSearchParams, articles: boolean): string {
  if (articles) return 'article';
  return params.get('mode') || (params.get('scope') === 'bag' ? 'recognition' : 'production');
}
export function useReviewMode() {
  const [params] = useSearchParams();
  const articles = useLocation().pathname === '/articles';
  return { articles, mode: reviewMode(params, articles) };
}
