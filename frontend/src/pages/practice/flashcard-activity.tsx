import { useState, type ReactNode } from 'react';
import type { Word } from '../../api';
import { WordCard } from '../../components/word-card';
import { RelatedWordsDialog } from '../../components/related-words-dialog';

type Direction = 'recognition' | 'production';

export function FlashcardActivity({
  word,
  index,
  count,
  direction,
  revealed,
  onDirection,
  onReveal,
  onPrevious,
  onNext,
  nextLabel = 'Next',
  action,
  showDirection = true,
}: {
  word: Word;
  index: number;
  count: number;
  direction: Direction;
  revealed: boolean;
  onDirection: (direction: Direction) => void;
  onReveal: () => void;
  onPrevious: () => void;
  onNext: () => void;
  nextLabel?: string;
  action?: ReactNode;
  showDirection?: boolean;
}) {
  const [relatedTo, setRelatedTo] = useState<Word | null>(null);
  return (
    <div className="practice-flashcard-study">
      <div className="practice-flashcard-toolbar">
        <div className="review-progress">
          <div className="review-progress-counts">
            <span>
              Card {index + 1} of {count}
            </span>
          </div>
          <progress
            aria-label="Flashcard progress"
            aria-valuetext={`Card ${index + 1} of ${count}`}
            value={index + 1}
            max={Math.max(1, count)}
          />
        </div>
        {showDirection && <FlashcardDirection direction={direction} onDirection={onDirection} />}
        {action}
      </div>
      <WordCard
        key={`${word.id}:${direction}`}
        context="practice"
        showDirection={false}
        word={word}
        direction={direction}
        revealed={revealed}
        onReveal={onReveal}
        footerControls={
          revealed && (
            <button
              className="button"
              aria-haspopup="dialog"
              onClick={() => setRelatedTo({ ...word, id: word.word_id || word.id })}
            >
              Related words
            </button>
          )
        }
      />
      <RelatedWordsDialog word={relatedTo} onClose={() => setRelatedTo(null)} />
      <div className="card-actions practice-flashcard-navigation">
        <button disabled={index === 0} onClick={onPrevious}>
          Previous
        </button>
        <button className="primary" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

export function FlashcardDirection({
  direction,
  onDirection,
}: {
  direction: Direction;
  onDirection: (direction: Direction) => void;
}) {
  return (
    <label className="practice-direction">
      <span className="sr-only">Flashcard direction</span>
      <select value={direction} onChange={(event) => onDirection(event.target.value as Direction)}>
        <option value="recognition">DE → EN</option>
        <option value="production">EN → DE</option>
      </select>
    </label>
  );
}
