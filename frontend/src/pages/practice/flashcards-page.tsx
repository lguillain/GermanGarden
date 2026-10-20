import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Word } from '../../api';
import { api } from '../../api';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { WordCard } from '../../components/word-card';
import { useScope } from '../../hooks/use-scope';

export function FlashcardsPage() {
  const { query, label } = useScope();
  const result = useQuery({
    queryKey: ['flashcards', query],
    queryFn: () => api<{ cards: Word[] }>(`/flashcards${query}`),
    staleTime: Infinity,
    refetchOnMount: 'always',
  });
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
      <Link className="back" to={`/practice${query}`}>
        ← Practice
      </Link>
      <Heading title="Flashcards">
        {label}
        {cards.length && index < cards.length ? ` · ${index + 1} / ${cards.length}` : ''}
      </Heading>
      <div className="study">
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorNotice error={result.error} />
        ) : !cards.length ? (
          <Empty>No words in this deck yet.</Empty>
        ) : index < cards.length ? (
          <>
            <WordCard word={cards[index]} revealed={revealed} onReveal={() => setRevealed(true)} />
            <div className="card-actions">
              <button disabled={index === 0} onClick={() => move(index - 1)}>
                Previous
              </button>
              <button className="primary" onClick={() => move(index + 1)}>
                {index === cards.length - 1 ? 'Finish deck' : 'Next'}
              </button>
            </div>
          </>
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
