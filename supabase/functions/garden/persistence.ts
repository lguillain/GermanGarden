import { Learner } from './model.ts';

// Only changed rows cross the database boundary. Review history is append-only;
// study sessions are updated independently by the heartbeat RPC.
export function progressChanges(before: Learner, after: Learner) {
  const different = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  return {
    ...(different(before.user, after.user) ? { user: after.user } : {}),
    swipes: after.swipes.flatMap((swipe, position) =>
      different(before.swipes[position], swipe) ? [{ ...swipe, position }] : [],
    ),
    marks: (['known', 'learned'] as const).flatMap((kind) =>
      after[kind].flatMap((word_id, position) =>
        before[kind][position] !== word_id ? [{ kind, position, word_id }] : [],
      ),
    ),
    srs: Object.fromEntries(
      Object.entries(after.srs).filter(([id, value]) => different(before.srs[id], value)),
    ),
    ...(different(before.weights, after.weights) ? { weights: after.weights } : {}),
    reviews: after.reviews.slice(before.reviews.length),
  };
}
