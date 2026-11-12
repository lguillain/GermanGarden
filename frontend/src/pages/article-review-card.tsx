import { ArticleChoices } from './article-choices';
import { useEffect } from 'react';
import type { Card } from '../api';

export function ArticleReviewCard({
  card,
  answered,
  correct,
  choice,
  busy,
  advanceFailed,
  onChoose,
  onNext,
}: {
  card: Card;
  answered: boolean;
  correct?: boolean;
  choice?: string;
  busy: boolean;
  advanceFailed: boolean;
  onChoose: (article: string) => void;
  onNext: () => void;
}) {
  useEffect(() => {
    if (!answered || busy || advanceFailed) return;
    const timer = window.setTimeout(onNext, correct ? 800 : 1400);
    return () => window.clearTimeout(timer);
  }, [answered, correct, busy, advanceFailed, onNext]);

  return (
    <>
      <article className="panel article-review-card">
        <h2 lang="de">
          {answered ? card.article : '___'} {card.lemma}
        </h2>
      </article>
      <div className="article-answer-controls">
        <ArticleChoices
          article={card.article}
          choice={choice}
          answered={answered}
          busy={busy}
          onChoose={onChoose}
        />
        <div className="article-review-feedback">
          {answered && advanceFailed && (
            <button autoFocus className="primary" disabled={busy} onClick={onNext}>
              Try again
            </button>
          )}
        </div>
      </div>
    </>
  );
}
