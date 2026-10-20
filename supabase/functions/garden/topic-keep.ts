import { Garden } from './domain.ts';
import { freshLearner, HttpError, type Word, type Swipe, type Srs } from './model.ts';

export type TopicKeepResult =
  | { error: 'unknown_word' | 'unknown_topic' | 'wrong_topic' | 'bag_full' }
  | { added: boolean; word: Word; swipe: Swipe; srs: Srs | null; learned: boolean };

export function topicKeepRequest(path: string, method: string) {
  if (method !== 'POST') return null;
  const match = path.match(/^\/topics\/([^/]+)\/words\/([^/]+)\/keep$/);
  return match
    ? { topic: decodeURIComponent(match[1]), wordId: decodeURIComponent(match[2]) }
    : null;
}

// Keep display rules in the domain, including permanently grown learned words.
export function topicKeepResponse(result: TopicKeepResult) {
  if ('error' in result) {
    const errors = {
      unknown_word: [404, 'Unknown word.'],
      unknown_topic: [422, 'Unknown topic.'],
      wrong_topic: [422, 'This word does not belong to this topic.'],
      bag_full: [409, 'Your seed bag is full. Review a seed to make room.'],
    } as const;
    const [status, message] = errors[result.error];
    throw new HttpError(status, message);
  }
  const state = freshLearner('');
  state.swipes = [result.swipe];
  if (result.learned) state.learned = [result.word.id];
  if (result.srs) state.srs[result.word.id] = result.srs;
  const garden = new Garden(
    { words: [result.word], activities: [], word_activities: [], sentences: [] },
    state,
  );
  return { added: result.added, word: garden.details(result.word) };
}
