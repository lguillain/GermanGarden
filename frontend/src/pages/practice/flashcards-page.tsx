import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Word } from '../../api';
import { api } from '../../api';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { FlashcardActivity } from './flashcard-activity';
import { useScope } from '../../hooks/use-scope';

export function FlashcardsPage() {
  const { query, label } = useScope();
  const result = useQuery({
    queryKey: ['flashcards', query],
    queryFn: () => api<{ cards: Word[] }>(`/flashcards${query}`),
    staleTime: Infinity,
    refetchOnMount: 'always',
  });
  const [direction, setDirection] = useState<'recognition' | 'production'>('recognition');
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setIndex(0);
    setRevealed(false);
  }, [result.data, query]);
  const cards = result.data?.cards || [];
  const move = (next: number) => {
    setIndex(next);
    setRevealed(false);
  };
  return (
    <>
      <Heading title="Flashcards" navigation={[{ to: `/practice${query}`, label: '← Practice' }]}>
        {label}
        {cards.length && index < cards.length ? ` · ${index + 1} / ${cards.length}` : ''}
      </Heading>
      <div>
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorNotice error={result.error} />
        ) : !cards.length ? (
          <Empty>No words in this deck yet.</Empty>
        ) : index < cards.length ? (
          <FlashcardActivity
            word={cards[index]}
            index={index}
            count={cards.length}
            direction={direction}
            revealed={revealed}
            onDirection={(value) => {
              setDirection(value);
              setRevealed(false);
            }}
            onReveal={() => setRevealed(true)}
            onPrevious={() => move(index - 1)}
            onNext={() => move(index + 1)}
            nextLabel={index === cards.length - 1 ? 'Finish deck' : 'Next'}
          />
        ) : (
          <Empty>
            <h2>Deck complete</h2>
            <div className="actions">
              <button onClick={() => move(0)}>Go through again</button>
              <Link className="button" to={`/practice${query}`}>
                Back to practice
              </Link>
            </div>
          </Empty>
        )}
      </div>
    </>
  );
}
