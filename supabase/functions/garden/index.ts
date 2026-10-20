import { createClient } from '@supabase/supabase-js';
import { Catalog, HttpError, requireThat } from './model.ts';
import { Complete } from './ai.ts';
import { dispatch } from './service.ts';
import { catalogCache } from './catalog-cache.ts';
import { createCatalogLoader } from './catalog-loader.ts';
import { createStore } from './store.ts';
import { createCompletion } from './anthropic.ts';
import type { Measure } from './timing.ts';
import { loadPracticeData } from './practice-catalog.ts';
import { scopedProgressRequest } from './progress-request.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const allowedOrigins = (
  Deno.env.get('ALLOWED_ORIGINS') ||
  'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4174'
)
  .split(',')
  .map((s) => s.trim());
const catalog = createCatalogLoader(async (request) => {
  const { data, error } = await admin.rpc('load_garden_catalog', { ...request });
  if (error) throw error;
  return data as Catalog;
});
const activities = catalogCache(async () => {
  const { data, error } = await admin.from('activities').select('id, name').order('name');
  if (error) throw error;
  return data;
});
const emptyCatalog: Catalog = { words: [], activities: [], word_activities: [], sentences: [] };
const complete = createCompletion(
  Deno.env.get('ANTHROPIC_API_KEY'),
  Deno.env.get('ANTHROPIC_MODEL') || undefined,
);

export async function handler(request: Request): Promise<Response> {
  const timings: string[] = [];
  const measure: Measure = async (name, operation) => {
    const started = performance.now();
    try {
      return await operation();
    } finally {
      timings.push(`${name};dur=${(performance.now() - started).toFixed(1)}`);
    }
  };
  const origin = request.headers.get('Origin') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Max-Age'] = '3600';
  headers['Access-Control-Expose-Headers'] = 'Server-Timing';
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, 'Server-Timing': timings.join(', ') },
    });
  try {
    requireThat(
      !origin || allowedOrigins.includes(origin),
      'This site is not allowed to access the garden.',
      403,
    );
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    requireThat(token, 'Please sign in.', 401);
    // Never trust a user ID supplied in the request body or an unverified JWT.
    const {
      data: { user },
      error,
    } = await measure('auth', () => admin.auth.getUser(token));
    requireThat(!error && user, 'Your session has expired. Please sign in again.', 401);
    requireThat(['GET', 'POST'].includes(request.method), 'Method not allowed.', 405);
    let body = {};
    if (request.method === 'POST') {
      const raw = await request.text();
      requireThat(raw.length <= 100_000, 'Request is too large.', 413);
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        throw new HttpError(400, 'Invalid JSON.');
      }
      requireThat(body && typeof body === 'object' && !Array.isArray(body), 'Invalid request.');
    }
    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname.replace(/^\/(?:functions\/v1\/)?garden(?=\/|$)/, '') || '/';
    const store = createStore(admin, {
      userId: user.id,
      name: String(user.user_metadata?.name || user.email?.split('@')[0] || 'Learner'),
      measure,
      matcher: path === '/matcher',
      scoped: scopedProgressRequest(path, request.method),
    });
    if (path === '/heartbeat')
      return respond(
        await dispatch(path, request.method, requestUrl.searchParams, body, store, emptyCatalog),
      );
    if (path === '/activities' && request.method === 'GET')
      return respond(await measure('activities', activities));
    if ((path === '/review' || path === '/practice/summary') && request.method === 'GET') {
      return respond(
        await measure('dispatch', () =>
          dispatch(path, request.method, requestUrl.searchParams, body, store, emptyCatalog),
        ),
      );
    }
    if (path === '/session' && request.method === 'GET') {
      return respond(
        await dispatch(
          path,
          request.method,
          requestUrl.searchParams,
          body,
          store,
          emptyCatalog,
          complete,
        ),
      );
    }
    const [vocabulary, snapshot] =
      path === '/practice' && request.method === 'GET'
        ? await loadPracticeData(
            () => store.load(),
            (wordIds) =>
              measure('catalog', async () => {
                const { data, error } = await admin.rpc('load_practice_catalog', {
                  p_word_ids: wordIds,
                });
                if (error) throw error;
                return data as Catalog;
              }),
          )
        : await Promise.all([
            measure('catalog', () => catalog(path, request.method)),
            store.load(),
          ]);
    const timedComplete: Complete | undefined = complete
      ? (...args) => measure('ai', () => complete(...args))
      : undefined;
    return respond(
      await measure('dispatch', () =>
        dispatch(
          path,
          request.method,
          requestUrl.searchParams,
          body,
          store,
          vocabulary,
          timedComplete,
          snapshot,
        ),
      ),
    );
  } catch (error) {
    if (error instanceof HttpError) return respond({ detail: error.message }, error.status);
    // Avoid logging tokens, request bodies, database rows or API keys.
    console.error('Garden request failed:', error instanceof Error ? error.name : 'database error');
    return respond({ detail: 'The garden is temporarily unavailable. Please try again.' }, 500);
  }
}
Deno.serve(handler);
