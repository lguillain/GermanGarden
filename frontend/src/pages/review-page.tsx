import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Card } from '../api';
import { api } from '../api';
import { Empty, ErrorNotice, Heading, Loading } from '../components/feedback';
import { WordCard } from '../components/word-card';
import { WordSetSwitch } from '../components/word-set-switch';
import { useScope } from '../hooks/use-scope';

function reviewDelay(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr`;
  const days = Math.round((seconds / 86400) * 10) / 10;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function ReviewPage() {
  const { scope, topic, query, label } = useScope();
  const cache = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const key = ['review', scope, topic];
  const result = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ card: Card | null; remaining: number; counts: { plants: number; seeds: number } }>(
        `/review${query}`,
      ),
    staleTime: Infinity,
    refetchOnMount: 'always',
  });
  const grade = useMutation({
    mutationFn: (value: number) =>
      api<{ card: Card | null; remaining: number; counts: { plants: number; seeds: number } }>(
        '/review',
        { word_id: result.data!.card!.word_id, grade: value, scope, topic },
      ),
    onSuccess: (data) => {
      const reviewedId = result.data!.card!.word_id;
      cache.setQueryData(key, data);
      cache.invalidateQueries({ queryKey: ['review'], refetchType: 'none' });
      cache.invalidateQueries({ queryKey: ['garden'] });
      cache.invalidateQueries({ queryKey: ['topic'] });
      cache.invalidateQueries({ queryKey: ['matcher'] });
      cache.invalidateQueries({ queryKey: ['practice'] });
      cache.invalidateQueries({ queryKey: ['flashcards'] });
      setRevealed(false);
      setReviewed((previous) => new Set([...previous, reviewedId]));
    },
  });
  const card = result.data?.card;
  useEffect(() => {
    setRevealed(false);
    setReviewed(new Set());
  }, [query]);
  return (
    <>
      <div className="practice-heading-row">
        <Heading title="Review">{scope === 'topic' ? label : undefined}</Heading>
        <WordSetSwitch page="/review" counts={result.data?.counts} />
      </div>
      <div className="study">
        {result.data && (
          <div className="review-progress">
            <div className="review-progress-counts">
              <span>{reviewed.size} reviewed</span>
              <span>{result.data.remaining} to review</span>
            </div>
            <progress
              aria-label="Review progress"
              aria-valuetext={`${reviewed.size} words reviewed this visit, ${result.data.remaining} words to review`}
              value={reviewed.size}
              max={Math.max(1, reviewed.size + result.data.remaining)}
            />
          </div>
        )}
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorNotice error={result.error} />
        ) : card ? (
          <>
            <WordCard
              key={card.word_id}
              word={card}
              revealed={revealed}
              onReveal={() => setRevealed(true)}
            />
            {revealed && (
              <div className="grade-actions">
                {card.rating_options?.map((option) => (
                  <button
                    key={option.grade}
                    disabled={grade.isPending}
                    className={option.grade === 3 ? 'primary' : ''}
                    onClick={() => grade.mutate(option.grade)}
                  >
                    <strong>{['Again', 'Hard', 'Good', 'Easy'][option.grade - 1]}</strong>
                    <span className="rating-delay">
                      In {reviewDelay(option.next_review_seconds)}
                    </span>
                    <span className="rating-growth">
                      {scope === 'bag'
                        ? 'Plants seed'
                        : option.grade === 1
                          ? 'Needs more care'
                          : option.growth > (card.growth ?? 0)
                            ? 'Plant grows'
                            : 'Waters plant'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Empty>
            {scope === 'bag' && reviewed.size > 0
              ? 'Your seeds are planted.'
              : scope === 'bag'
                ? 'No seeds to review.'
                : 'All caught up! No words are due for review.'}{' '}
            <Link to="/matcher">Find new words</Link>.
          </Empty>
        )}
        <ErrorNotice error={grade.error} />
      </div>
    </>
  );
}
