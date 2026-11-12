import { wordContext, type ContextStorage } from './word-context.ts';
import { topicKeepRequest, topicKeepResponse, type TopicKeepResult } from './topic-keep.ts';
import { matcherPreview } from './matcher-preview.ts';
import { relatedWordIds } from './related-words.ts';
import { Garden, grammarOptions, reviewSelectionResponse } from './domain.ts';
import { Body, Complete, text, aiPractice, guidance } from './ai.ts';
import { relatedWordsPath, topicDetailPath } from './routes.ts';
import {
  Catalog,
  Learner,
  ReviewSelection,
  ReviewMode,
  ReviewTrack,
  REVIEW_MODES,
  MESSAGES,
  HttpError,
  requireThat,
  requireWordSet,
  shuffle,
} from './model.ts';
export interface Store {
  context?: ContextStorage;
  keepTopicWord?(wordId: string, topic: string): Promise<TopicKeepResult>;
  associations?(wordId: string): Promise<string[]>;
  verbObjects?(wordId: string, pos: string): Promise<{ related_id: string; phrase: string }[]>;
  load(): Promise<{ version: number; data: Learner }>;
  save(version: number, data: Learner): Promise<boolean>;
  profile?(): Promise<{ name: string; level: string | null }>;
  practiceSummary?(topic: string): Promise<{
    counts: { plants: number; seeds: number };
    all_plants: number;
    topic_exists: boolean;
  }>;
  review?(
    scope: string,
    topic: string,
    excluded?: string[],
    mode?: ReviewMode,
  ): Promise<ReviewSelection>;
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
  const session = (user: { name: string; level: string | null }) => ({
    user: { name: user.name, level: user.level },
    ai_available: !!complete,
  });
  // GET requests carry parameters in the query string, POST requests in the body.
  const param = (name: string, fallback = '') =>
    method === 'GET' ? query.get(name) || fallback : text(body, name, fallback);
  // These read paths deliberately avoid loading a full learner snapshot.
  if (path === '/session' && method === 'GET' && store.profile)
    return session(await store.profile());
  const scope = param('scope', 'all');
  const topic = param('topic');
  if (path === '/practice/summary' && method === 'GET' && store.practiceSummary) {
    requireWordSet(scope);
    const summary = await store.practiceSummary(topic);
    requireThat(!(topic || scope === 'topic') || summary.topic_exists, MESSAGES.unknownTopic);
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
  const excludedValue = method === 'GET' ? query.getAll('exclude') : body.excluded || [];
  requireThat(
    Array.isArray(excludedValue) &&
      excludedValue.length <= 10000 &&
      excludedValue.every((id) => typeof id === 'string'),
    'Invalid review session.',
  );
  const excluded = excludedValue as string[];
  const mode = param('mode', 'mixed') as ReviewMode;
  requireThat(REVIEW_MODES.includes(mode), 'Unknown review mode.');
  if (path === '/review' && method === 'GET' && store.review) {
    requireWordSet(scope);
    return reviewSelectionResponse(
      await store.review(scope, topic, excluded, mode),
      scope,
      topic,
      mode,
    );
  }
  const keep = topicKeepRequest(path, method);
  if (keep && store.keepTopicWord)
    return topicKeepResponse(await store.keepTopicWord(keep.wordId, keep.topic));
  if (path === '/grammar/options' && method === 'GET') return grammarOptions;
  const snapshot = initial ?? (await store.load());
  const garden = new Garden(catalog, snapshot.data);
  // Every write starts from this request's snapshot and retries against newer state.
  const mutate = <T>(operation: (currentGarden: Garden) => T) =>
    transact(store, catalog, operation, snapshot);
  if (method === 'GET') {
    switch (path) {
      case '/session':
        return session(garden.state.user);
      case '/garden':
        return garden.home(query.get('time_zone') || 'UTC');
      case '/review':
        return garden.review(scope, topic, excluded, mode);
      case '/practice/summary':
        return { word_count: garden.scope(scope, topic).length, counts: garden.counts(topic) };
      case '/practice/weak':
        return { words: garden.weakWords(scope, topic) };
      case '/practice':
        return garden.practice(scope, topic);
      case '/flashcards':
        return {
          cards: shuffle(garden.scope(scope, topic))
            .slice(0, 10)
            .map((w) => garden.sentence(w, topic)),
        };
      case '/matcher':
        return mutate((currentGarden) => {
          if (topic) currentGarden.setTopic(topic);
          return matcherPreview(currentGarden, currentGarden.matcher());
        });
    }
    const detailTopic = topicDetailPath(path);
    if (detailTopic !== null) return garden.topicDetail(detailTopic);
    const relatedId = relatedWordsPath(path);
    if (relatedId !== null) {
      const word = garden.word(relatedId);
      const [associated, objects] = await Promise.all([
        store.associations?.(word.id) ?? [],
        store.verbObjects?.(word.id, word.pos) ?? [],
      ]);
      const pairings = objects
        .filter((pair) =>
          catalog.words.some(
            (other) =>
              other.id === pair.related_id &&
              other.pos === (word.pos === 'verb' ? 'noun' : word.pos === 'noun' ? 'verb' : null),
          ),
        )
        .slice(0, 6);
      const ids = relatedWordIds(
        catalog,
        word.id,
        associated.filter((id) => !pairings.some((pair) => pair.related_id === id)),
      );
      const details = (id: string) => garden.details(garden.word(id));
      return {
        word: garden.details(word),
        family: ids.family.map(details),
        objects: pairings.map((pair) => ({
          ...details(pair.related_id),
          object_phrase: pair.phrase,
        })),
        together: ids.together.map(details),
      };
    }
  }
  if (method === 'POST') {
    if (path === '/context') {
      requireThat(store.context, 'Context storage is unavailable.', 503);
      return wordContext(body, garden, store.context, complete);
    }
    if (path === '/level-up')
      return mutate((currentGarden) => currentGarden.levelUp(text(body, 'current_level')));

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
      return mutate((currentGarden) => {
        if (weights) currentGarden.state.weights = weights;
        if (path === '/onboarding') {
          currentGarden.setLevel(level === 'unsure' ? 'A1' : level);
          return currentGarden.state.user;
        }
        currentGarden.setTopic(
          topic ||
            (weights ? Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0] : null) ||
            currentGarden.bestTopic(),
        );
        return matcherPreview(currentGarden, currentGarden.matcher());
      });
    }
    if (path === '/review/learned')
      return mutate((currentGarden) => currentGarden.markLearned(text(body, 'word_id')));
    if (path === '/review/article') {
      requireThat(mode !== 'mixed', 'Choose a review direction.');
      requireThat(
        body.expected_article_reviewed_at === null ||
          typeof body.expected_article_reviewed_at === 'string',
        'Missing article version.',
      );
      return mutate((currentGarden) =>
        currentGarden.gradeArticle(
          text(body, 'word_id'),
          text(body, 'choice'),
          body.expected_article_reviewed_at as string | null,
          scope,
          topic,
          mode as ReviewTrack,
          excluded,
        ),
      );
    }
    if (path === '/review')
      return mutate((currentGarden) =>
        currentGarden.grade(
          text(body, 'word_id'),
          Number(body.grade),
          scope,
          topic,
          text(body, 'track', 'recognition') as ReviewTrack,
          excluded,
          mode,
          body.continuation === true,
          body.wrong_article === true,
        ),
      );
    if (path === '/matcher')
      return mutate((currentGarden) =>
        matcherPreview(
          currentGarden,
          currentGarden.swipe(
            text(body, 'word_id'),
            text(body, 'action'),
            text(body, 'activity_id') || null,
            Number(body.sentence_id),
          ),
        ),
      );
    if (keep)
      return mutate((currentGarden) => {
        const result = currentGarden.add(keep.wordId, keep.topic);
        return { ...result, word: currentGarden.details(currentGarden.word(keep.wordId)) };
      });
  }
  throw new HttpError(404, 'Page not found.');
}
