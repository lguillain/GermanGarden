import { Catalog, Learner } from './model.ts';

// Use this exact progress snapshot to choose vocabulary, rather than a second
// independent progress query which could race with a keep/review in another tab.
export function practiceWordIds(learner: Learner): string[] {
  return [...new Set(learner.swipes.filter(swipe => swipe.action === 'keep').map(swipe => swipe.word_id))];
}
export async function loadPracticeData(
  loadProgress: () => Promise<{ version: number; data: Learner }>,
  loadCatalog: (wordIds: string[]) => Promise<Catalog>,
) {
  const snapshot = await loadProgress();
  const vocabulary = await loadCatalog(practiceWordIds(snapshot.data));
  return [vocabulary, snapshot] as const;
}
