import { Catalog, requireThat } from './model.ts';
import { catalogCache } from './catalog-cache.ts';

export interface CatalogRequest {
  p_topic: string | null;
  p_include_sentences: boolean;
  p_activities_only: boolean;
}
export function catalogRequest(path: string, method: string): CatalogRequest {
  // This shared loader scopes only read-only topic lists; practice has its own
  // snapshot-based loader. Mutations and discovery need the full catalogue.
  const topic = method === 'GET' ? path.match(/^\/topics\/([^/]+)$/) : null;
  return {
    p_topic: topic ? decodeURIComponent(topic[1]) : null,
    p_include_sentences: !topic && !['/session', '/garden', '/onboarding'].includes(path),
    p_activities_only: path === '/session' || path === '/onboarding',
  };
}
export function createCatalogLoader(fetchCatalog: (request: CatalogRequest) => Promise<Catalog>) {
  const caches = new Map<string, () => Promise<Catalog>>();
  return (path: string, method: string) => {
    const request = catalogRequest(path, method),
      key = JSON.stringify(request);
    let get = caches.get(key);
    if (!get) {
      // Bound topic-specific caches, including invalid topic IDs.
      if (caches.size >= 32) caches.delete(caches.keys().next().value!);
      get = catalogCache(async () => {
        const data = await fetchCatalog(request);
        requireThat(
          data.activities.length &&
            (request.p_activities_only || request.p_topic !== null || data.words.length),
          'Vocabulary has not been imported yet.',
          503,
        );
        return data;
      });
      caches.set(key, get);
    }
    return get();
  };
}
