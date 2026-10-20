import { Garden } from './domain.ts';

// Precompute one next card for each possible choice, without saving a decision.
// The browser can show it while the real write is pending, but cannot act again
// until the server confirms. Version conflicts always use fresh progress.
export function matcherPreview(garden: Garden, result: ReturnType<Garden['matcher']>) {
  const previews: Partial<Record<'keep' | 'learned' | 'not_now', ReturnType<Garden['matcher']>>> =
    {};
  const card = result.card;
  if (card && card.sentence_id !== null) {
    for (const action of ['keep', 'learned', 'not_now'] as const) {
      if (action === 'keep' && result.bag.length >= 20) continue;
      const preview = new Garden(garden.catalog, structuredClone(garden.state), garden.now);
      previews[action] = preview.swipe(card.word_id, action, card.activity_id, card.sentence_id);
    }
  }
  return { ...result, previews };
}
