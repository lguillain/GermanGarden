import { Garden } from './domain.ts';
import { Body, Complete, text, aiPractice, guidance, recommendTopic } from './ai.ts';
import { Catalog, Learner, HttpError, requireThat, shuffle } from './model.ts';
export interface Store {
  load(): Promise<{ version: number; data: Learner }>;
  save(version: number, data: Learner): Promise<boolean>;
}
type Snapshot = Awaited<ReturnType<Store['load']>>;
// Recompute mutations against the newest state on conflicts; never retry an AI call.
export async function transact<T>(store: Store, catalog: Catalog, operation: (garden: Garden) => T, initial?: Snapshot): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const snapshot = attempt === 0 && initial ? initial : await store.load(), garden = new Garden(catalog, structuredClone(snapshot.data));
    const result = operation(garden);
    if (await store.save(snapshot.version, garden.state)) return result;
  }
  throw new HttpError(409, 'Progress changed in another tab. Please try again.');
}
async function matcherTransaction(store: Store, catalog: Catalog, operation: (garden: Garden) => unknown, complete?: Complete, explicitTopic = false, initial?: Snapshot) {
  const snapshot = initial ?? await store.load(), preview = new Garden(catalog, structuredClone(snapshot.data));
  const previous = preview.state.user.current_topic;
  operation(preview);
  const preferred = complete && !explicitTopic && previous !== preview.state.user.current_topic
    ? await recommendTopic(preview, previous || '', complete) : undefined;
  return transact(store, catalog, g => { g.preferredTopic = preferred; return operation(g); }, snapshot);
}
export async function dispatch(path: string, method: string, query: URLSearchParams, body: Body, store: Store, catalog: Catalog, complete?: Complete) {
  const scope = method === 'GET' ? query.get('scope') || 'all' : text(body, 'scope', 'all');
  const topic = method === 'GET' ? query.get('topic') || '' : text(body, 'topic');
  const snapshot = await store.load(), garden = new Garden(catalog, snapshot.data);
  if (method === 'GET') {
    switch (path) {
      case '/session': return { user: { ...garden.state.user, swipes: garden.state.user.swipe_count }, ai_available: !!complete, activities: catalog.activities };
      case '/garden': return garden.home();
      case '/review': return garden.review(scope, topic);
      case '/practice': return garden.practice(scope, topic);
      case '/flashcards': return { cards: shuffle(garden.scope(scope, topic)).slice(0, 10).map(w => garden.sentence(w, topic)) };
      case '/matcher': return matcherTransaction(store, catalog, g => { if (topic) g.setTopic(topic); return g.matcher(); }, complete, !!topic, snapshot);
    }
    const match = path.match(/^\/topics\/([^/]+)$/); if (match) return garden.topicDetail(decodeURIComponent(match[1]));
  }
  if (method === 'POST') {
    if (['/reading', '/chat', '/grammar'].includes(path)) { requireThat(complete, 'AI practice is not configured.', 503); return aiPractice(path, body, garden, complete); }
    if (path === '/onboarding' || path === '/guide') {
      const input = text(body, path === '/guide' ? 'guidance' : 'goals').trim();
      if (topic) garden.topic(topic);
      const level = path === '/onboarding' ? text(body, 'level') : '';
      if (path === '/onboarding') requireThat(['A1', 'A2', 'B1', 'unsure'].includes(level), 'Choose a valid level.');
      let weights: Record<string, number> | undefined;
      if (input && !topic) { requireThat(complete, 'AI guidance is not configured.', 503); weights = await guidance(garden, input, complete); }
      return transact(store, catalog, g => {
        if (weights) g.state.weights = weights;
        if (path === '/onboarding') { g.state.user.level = level === 'unsure' ? 'A1' : level; return g.state.user; }
        g.setTopic(topic || (weights ? Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] : null) || g.bestTopic()); return g.matcher();
      }, snapshot);
    }
    if (path === '/heartbeat') return transact(store, catalog, g => g.heartbeat(), snapshot);
    if (path === '/review') return transact(store, catalog, g => g.grade(text(body, 'word_id'), Number(body.grade), scope, topic), snapshot);
    if (path === '/matcher') return matcherTransaction(store, catalog, g => g.swipe(text(body, 'word_id'), text(body, 'action'), text(body, 'activity_id') || null, Number(body.sentence_id)), complete, false, snapshot);
    const match = path.match(/^\/topics\/([^/]+)\/words\/([^/]+)\/keep$/);
    if (match) return transact(store, catalog, g => g.add(decodeURIComponent(match[2]), decodeURIComponent(match[1])), snapshot);
  }
  throw new HttpError(404, 'Page not found.');
}
