import { topicKeepRequest, topicKeepResponse, type TopicKeepResult } from './topic-keep.ts';
import { matcherPreview } from './matcher-preview.ts';
import { Garden, reviewSelectionResponse } from './domain.ts';
import { Body, Complete, text, aiPractice, guidance } from './ai.ts';
import { Catalog, Learner, ReviewSelection, HttpError, requireThat, shuffle } from './model.ts';
export interface Store {
  keepTopicWord?(wordId: string, topic: string): Promise<TopicKeepResult>;
  load(): Promise<{ version: number; data: Learner }>;
  save(version: number, data: Learner): Promise<boolean>;
  profile?(): Promise<{ name: string; level: string | null }>;
  practiceSummary?(topic: string): Promise<{
    counts: { plants: number; seeds: number };
    all_plants: number;
    topic_exists: boolean;
  }>;
  heartbeat?(): Promise<NonNullable<Learner['time_summary']>>;
  review?(scope: string, topic: string): Promise<ReviewSelection>;
}
export type Snapshot = Awaited<ReturnType<Store['load']>>;
const MAX_WRITE_ATTEMPTS = 5;
// Recompute mutations against the newest state on conflicts; never retry an AI call.
export async function transact<T>(
  store: Store,
  catalog: Catalog,
  operation: (garden: Garden) => T,
  initial?: Snapshot,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const snapshot = attempt === 0 && initial ? initial : await store.load();
    const garden = new Garden(catalog, structuredClone(snapshot.data));
    const result = operation(garden);
    if (await store.save(snapshot.version, garden.state)) return result;
  }
  throw new HttpError(409, 'Progress changed in another tab. Please try again.');
}
export async function dispatch(
  path: string,
  method: string,
  query: URLSearchParams,
  body: Body,
  store: Store,
  catalog: Catalog,
  complete?: Complete,
  initial?: Snapshot,
) {
  // These read paths deliberately avoid loading a full learner snapshot.
  if (path === '/session' && method === 'GET' && store.profile) {
    const profile = await store.profile();
    return {
      user: { name: profile.name, level: profile.level },
      ai_available: !!complete,
    };
  }
  if (path === '/heartbeat' && method === 'POST' && store.heartbeat) return store.heartbeat();
  const scope = method === 'GET' ? query.get('scope') || 'all' : text(body, 'scope', 'all');
  const topic = method === 'GET' ? query.get('topic') || '' : text(body, 'topic');
  if (path === '/practice/summary' && method === 'GET' && store.practiceSummary) {
    requireThat(['all', 'topic', 'bag'].includes(scope), 'Unknown word set.');
    const summary = await store.practiceSummary(topic);
    requireThat(!(topic || scope === 'topic') || summary.topic_exists, 'Unknown topic.');
    return {
      counts: summary.counts,
      word_count:
        scope === 'bag'
          ? summary.counts.seeds
          : scope === 'topic'
            ? summary.counts.plants
            : summary.all_plants,
    };
  }
  if (path === '/review' && method === 'GET' && store.review) {
    requireThat(['all', 'topic', 'bag'].includes(scope), 'Unknown word set.');
    return reviewSelectionResponse(await store.review(scope, topic), scope, topic);
  }
  const keep = topicKeepRequest(path, method);
  if (keep && store.keepTopicWord)
    return topicKeepResponse(await store.keepTopicWord(keep.wordId, keep.topic));
  const snapshot = initial ?? (await store.load());
  const garden = new Garden(catalog, snapshot.data);
  if (method === 'GET') {
    switch (path) {
      case '/session':
        return {
          user: { name: garden.state.user.name, level: garden.state.user.level },
          ai_available: !!complete,
        };
      case '/garden':
        return garden.home();
      case '/review':
        return garden.review(scope, topic);
      case '/practice/summary':
        return { word_count: garden.scope(scope, topic).length, counts: garden.counts(topic) };
      case '/practice':
        return garden.practice(scope, topic);
      case '/flashcards':
        return {
          cards: shuffle(garden.scope(scope, topic))
            .slice(0, 10)
            .map((w) => garden.sentence(w, topic)),
        };
      case '/matcher':
        return transact(
          store,
          catalog,
          (currentGarden) => {
            if (topic) currentGarden.setTopic(topic);
            return matcherPreview(currentGarden, currentGarden.matcher());
          },
          snapshot,
        );
    }
    const match = path.match(/^\/topics\/([^/]+)$/);
    if (match) return garden.topicDetail(decodeURIComponent(match[1]));
  }
  if (method === 'POST') {
    if (['/reading', '/chat', '/grammar'].includes(path)) {
      requireThat(complete, 'AI practice is not configured.', 503);
      return aiPractice(path, body, garden, complete);
    }
    if (path === '/onboarding' || path === '/guide') {
      const input = text(body, path === '/guide' ? 'guidance' : 'goals').trim();
      if (topic) garden.topic(topic);
      const level = path === '/onboarding' ? text(body, 'level') : '';
      if (path === '/onboarding')
        requireThat(['A1', 'A2', 'B1', 'unsure'].includes(level), 'Choose a valid level.');
      // Resolve AI guidance once, outside the transaction retry loop.
      let weights: Record<string, number> | undefined;
      if (input && !topic) {
        requireThat(complete, 'AI guidance is not configured.', 503);
        weights = await guidance(garden, input, complete);
      }
      return transact(
        store,
        catalog,
        (currentGarden) => {
          if (weights) currentGarden.state.weights = weights;
          if (path === '/onboarding') {
            currentGarden.state.user.level = level === 'unsure' ? 'A1' : level;
            return currentGarden.state.user;
          }
          currentGarden.setTopic(
            topic ||
              (weights ? Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] : null) ||
              currentGarden.bestTopic(),
          );
          return matcherPreview(currentGarden, currentGarden.matcher());
        },
        snapshot,
      );
    }
    if (path === '/heartbeat')
      return transact(store, catalog, (currentGarden) => currentGarden.heartbeat(), snapshot);
    if (path === '/review')
      return transact(
        store,
        catalog,
        (currentGarden) =>
          currentGarden.grade(text(body, 'word_id'), Number(body.grade), scope, topic),
        snapshot,
      );
    if (path === '/matcher')
      return transact(
        store,
        catalog,
        (currentGarden) =>
          matcherPreview(
            currentGarden,
            currentGarden.swipe(
              text(body, 'word_id'),
              text(body, 'action'),
              text(body, 'activity_id') || null,
              Number(body.sentence_id),
            ),
          ),
        snapshot,
      );
    if (keep)
      return transact(
        store,
        catalog,
        (currentGarden) => {
          const result = currentGarden.add(keep.wordId, keep.topic);
          return { ...result, word: currentGarden.details(currentGarden.word(keep.wordId)) };
        },
        snapshot,
      );
  }
  throw new HttpError(404, 'Page not found.');
}
