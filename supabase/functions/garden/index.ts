import { createClient } from '@supabase/supabase-js';
import { Catalog, HttpError, requireThat, Learner } from './model.ts';
import { Complete } from './ai.ts';
import { dispatch, Store } from './service.ts';
import { createCatalogLoader } from './catalog-loader.ts';
import { progressChanges } from './persistence.ts';
import { loadPracticeData } from './practice-catalog.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4174').split(',').map(s => s.trim());
const catalog = createCatalogLoader(async request => {
  const { data, error } = await admin.rpc('load_garden_catalog', { ...request });
  if (error) throw error;
  return data as Catalog;
});
type Measure = <T>(name: string, operation: () => PromiseLike<T>) => Promise<T>;
const emptyCatalog: Catalog = { words: [], activities: [], word_activities: [], sentences: [] };
function storeFor(userId: string, name: string, measure: Measure, matcher = false): Store {
  let snapshot: { version: number; data: Learner } | undefined;
  return {
    async profile() {
      const { data, error } = await measure('profile', () => admin.from('learner_profiles')
        .select('name, level, swipe_count').eq('user_id', userId).maybeSingle());
      if (error) throw error;
      return data ?? { name, level: null, swipe_count: 0 };
    },
    async load() {
      const { data, error } = await measure('progress', () => admin.rpc(matcher ? 'load_matcher_progress' : 'load_learner_progress', { p_user_id: userId, p_name: name }));
      if (error) throw error;
      snapshot = data as { version: number; data: Learner };
      // Keep the comparison baseline separate from mutable domain state.
      return structuredClone(snapshot);
    },
    async save(version, data) {
      requireThat(snapshot && snapshot.version === version, 'Progress must be loaded before saving.', 500);
      if (matcher) {
        const result = await measure('save', () => admin.rpc('save_matcher_progress', {
          p_user_id: userId, p_version: version, p_user: data.user,
          p_swipes: data.swipes.slice(snapshot!.data.swipes.length),
          p_known: data.known.slice(snapshot!.data.known.length),
        }));
        if (result.error) throw result.error;
        return result.data === true;
      }
      const changes = progressChanges(snapshot.data, data);
      const result = await measure('save', () => admin.rpc('save_learner_progress', {
        p_user_id: userId, p_version: version, p_changes: changes,
      }));
      if (result.error) throw result.error;
      return result.data === true;
    },
    async heartbeat() {
      const { data, error } = await measure('heartbeat', () => admin.rpc('heartbeat_learner', { p_user_id: userId, p_name: name }));
      if (error) throw error;
      return data as NonNullable<Learner['time_summary']>;
    },
  };
}
const key = Deno.env.get('ANTHROPIC_API_KEY');
const complete: Complete | undefined = key ? async (system, message, history = []) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6', max_tokens: 1500, system,
      messages: [...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: message }] }),
  });
  if (!response.ok) throw new HttpError(502, 'AI practice is temporarily unavailable. Please try again.');
  const data = await response.json();
  const raw = data.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
  try { const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')); requireThat(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'Invalid AI response.', 502); return parsed; }
  catch { throw new HttpError(502, 'The AI returned an unreadable response. Please try again.'); }
} : undefined;

export async function handler(request: Request): Promise<Response> {
  const timings: string[] = [];
  const measure: Measure = async (name, operation) => {
    const started = performance.now();
    try { return await operation(); }
    finally { timings.push(`${name};dur=${(performance.now() - started).toFixed(1)}`); }
  };
  const origin = request.headers.get('Origin') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Max-Age'] = '3600';
  headers['Access-Control-Expose-Headers'] = 'Server-Timing';
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...headers, 'Server-Timing': timings.join(', ') },
  });
  try {
    requireThat(!origin || allowedOrigins.includes(origin), 'This site is not allowed to access the garden.', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    requireThat(token, 'Please sign in.', 401);
    // Never trust a user ID supplied in the request body or an unverified JWT.
    const { data: { user }, error } = await measure('auth', () => admin.auth.getUser(token));
    requireThat(!error && user, 'Your session has expired. Please sign in again.', 401);
    requireThat(['GET', 'POST'].includes(request.method), 'Method not allowed.', 405);
    let body = {};
    if (request.method === 'POST') {
      const raw = await request.text(); requireThat(raw.length <= 100_000, 'Request is too large.', 413);
      try { body = JSON.parse(raw || '{}'); } catch { throw new HttpError(400, 'Invalid JSON.'); }
      requireThat(body && typeof body === 'object' && !Array.isArray(body), 'Invalid request.');
    }
    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname.replace(/^\/(?:functions\/v1\/)?garden(?=\/|$)/, '') || '/';
    const store = storeFor(user.id, String(user.user_metadata?.name || user.email?.split('@')[0] || 'Learner'), measure, path === '/matcher');
    if (path === '/heartbeat') return respond(await dispatch(path, request.method, requestUrl.searchParams, body, store, emptyCatalog));
    if (path === '/session' && request.method === 'GET') {
      const [profile, vocabulary] = await Promise.all([store.profile!(), measure('catalog', () => catalog(path, request.method))]);
      return respond(await dispatch(path, request.method, requestUrl.searchParams, body, { ...store, profile: async () => profile }, vocabulary, complete));
    }
    const [vocabulary, snapshot] = path === '/practice' && request.method === 'GET'
      ? await loadPracticeData(() => store.load(), wordIds => measure('catalog', async () => {
        const { data, error } = await admin.rpc('load_practice_catalog', { p_word_ids: wordIds });
        if (error) throw error;
        return data as Catalog;
      }))
      : await Promise.all([measure('catalog', () => catalog(path, request.method)), store.load()]);
    const timedComplete: Complete | undefined = complete
      ? (...args) => measure('ai', () => complete(...args)) : undefined;
    return respond(await measure('dispatch', () => dispatch(path, request.method, requestUrl.searchParams, body, store, vocabulary, timedComplete, snapshot)));
  } catch (error) {
    if (error instanceof HttpError) return respond({ detail: error.message }, error.status);
    // Avoid logging tokens, request bodies, database rows or API keys.
    console.error('Garden request failed:', error instanceof Error ? error.name : 'database error');
    return respond({ detail: 'The garden is temporarily unavailable. Please try again.' }, 500);
  }
}
Deno.serve(handler);
