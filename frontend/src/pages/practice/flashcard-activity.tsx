import type { ReactNode } from 'react';
import type { Word } from '../../api';
import { WordCard } from '../../components/word-card';
import { PracticeActivityCard } from './practice-activity-card';

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
}) {
  return (
    <PracticeActivityCard
      flashcards
      title={
        <span>
          Card {index + 1} of {count}
        </span>
      }
      controls={
        <label className="practice-direction">
          <span className="sr-only">Flashcard direction</span>
          <select
            value={direction}
            onChange={(event) => onDirection(event.target.value as Direction)}
          >
            <option value="recognition">DE → EN</option>
            <option value="production">EN → DE</option>
          </select>
        </label>
      }
      action={action}
      footer={
        <div className="card-actions">
          <button disabled={index === 0} onClick={onPrevious}>
            Previous
          </button>
          <button className="primary" onClick={onNext}>
            {nextLabel}
          </button>
        </div>
      }
    >
      <WordCard
        key={`${word.id}:${direction}`}
        forms="practice"
        word={word}
        direction={direction}
        revealed={revealed}
        onReveal={onReveal}
      />
    </PracticeActivityCard>
  );
}
