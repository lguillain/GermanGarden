import type { QueryClient } from '@tanstack/react-query';

type ProgressChange = 'matcher' | 'topic-addition' | 'review';

// Keep each flow's refetch policy explicit: topic additions already update the
// visible row, while review responses supply the next card directly.
const policies = {
  matcher: { active: ['garden', 'practice'], stale: [] },
  'topic-addition': {
    active: [],
    stale: ['topic', 'garden', 'matcher', 'practice', 'review', 'flashcards'],
  },
  review: { active: ['garden', 'topic', 'matcher', 'practice', 'flashcards'], stale: [] },
} satisfies Record<ProgressChange, { active: string[]; stale: string[] }>;

export function invalidateProgress(cache: QueryClient, change: ProgressChange) {
  const policy = policies[change];
  for (const name of policy.active)
    void cache.invalidateQueries({ queryKey: [name], refetchType: 'active' });
  for (const name of policy.stale)
    void cache.invalidateQueries({ queryKey: [name], refetchType: 'none' });
}
