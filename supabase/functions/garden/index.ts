import { createClient } from '@supabase/supabase-js';
import { Catalog, freshLearner, HttpError, requireThat, Learner } from './model.ts';
import { Complete } from './ai.ts';
import { dispatch, Store } from './service.ts';
import { catalogCache } from './catalog-cache.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4174').split(',').map(s => s.trim());
const catalog = catalogCache(async (): Promise<Catalog> => {
  async function rows(table: string, order: string[]) {
    const all = [];
    for (let offset = 0; ; offset += 1000) {
      let query = admin.from(table).select('*');
      for (const column of order) query = query.order(column);
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw error;
      all.push(...data); if (data.length < 1000) break;
    }
    return all;
  }
  const [words, activities, word_activities, sentences] = await Promise.all([
    rows('words', ['id']), rows('activities', ['id']), rows('word_activities', ['word_id', 'activity_id']), rows('sentences', ['id']),
  ]);
  const data = { words, activities, word_activities, sentences } as Catalog;
  requireThat(words.length && activities.length, 'Vocabulary has not been imported yet.', 503);
  return data;
});
const emptyCatalog: Catalog = { words: [], activities: [], word_activities: [], sentences: [] };
function storeFor(userId: string, name: string): Store {
  return {
    async load() {
      const { data, error } = await admin.from('learner_state').select('version,data').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (data) return data as { version: number; data: Learner };
      const inserted = await admin.from('learner_state').upsert({ user_id: userId, data: freshLearner(name) }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (inserted.error) throw inserted.error;
      const result = await admin.from('learner_state').select('version,data').eq('user_id', userId).single();
      if (result.error) throw result.error;
      return result.data as { version: number; data: Learner };
    },
    async save(version, data) {
      const result = await admin.rpc('save_learner_state', { p_user_id: userId, p_version: version, p_data: data });
      if (result.error) throw result.error;
      return result.data === true;
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
  const origin = request.headers.get('Origin') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Max-Age'] = '3600';
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  try {
    requireThat(!origin || allowedOrigins.includes(origin), 'This site is not allowed to access the garden.', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    requireThat(token, 'Please sign in.', 401);
    // Never trust a user ID supplied in the request body or an unverified JWT.
    const { data: { user }, error } = await admin.auth.getUser(token);
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
    return respond(await dispatch(path, request.method, requestUrl.searchParams, body, storeFor(user.id, String(user.user_metadata?.name || user.email?.split('@')[0] || 'Learner')), path === '/heartbeat' ? emptyCatalog : await catalog(), complete));
  } catch (error) {
    if (error instanceof HttpError) return respond({ detail: error.message }, error.status);
    // Avoid logging tokens, request bodies, database rows or API keys.
    console.error('Garden request failed:', error instanceof Error ? error.name : 'database error');
    return respond({ detail: 'The garden is temporarily unavailable. Please try again.' }, 500);
  }
}
Deno.serve(handler);
