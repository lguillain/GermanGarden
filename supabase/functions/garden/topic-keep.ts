import { singleWordGarden } from './domain.ts';
import { topicKeepPath } from './routes.ts';
import { HttpError, MESSAGES, type Word, type Swipe, type Srs } from './model.ts';

export type TopicKeepResult =
  | { error: 'unknown_word' | 'unknown_topic' | 'wrong_topic' | 'bag_full' | 'learned' }
  | { added: boolean; word: Word; swipe: Swipe; srs: Srs | null; learned: boolean };

export function topicKeepRequest(path: string, method: string) {
  return method === 'POST' ? topicKeepPath(path) : null;
}

// Keep display rules in the domain, including permanently grown learned words.
export function topicKeepResponse(result: TopicKeepResult) {
  if ('error' in result) {
    const errors = {
      learned: [409, MESSAGES.learnedComplete],
      unknown_word: [404, MESSAGES.unknownWord],
      unknown_topic: [422, MESSAGES.unknownTopic],
      wrong_topic: [422, MESSAGES.wrongTopic],
      bag_full: [409, MESSAGES.bagFull],
    } as const;
    const [status, message] = errors[result.error];
    throw new HttpError(status, message);
  }
  const garden = singleWordGarden(result);
  return { added: result.added, word: garden.details(result.word) };
}
