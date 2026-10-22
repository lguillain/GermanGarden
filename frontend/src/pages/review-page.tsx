import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Card, Word, Session } from '../api';
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

interface ReviewResult {
  card: Card | null;
  remaining: number;
  counts: { plants: number; seeds: number };
  graduated?: Word | null;
}
export function ReviewPage() {
  const { query } = useScope();
  const cache = useQueryClient();
  const user =
    cache.getQueryData<{ id: string }>(['auth'])?.id ||
    cache.getQueryData<Session>(['session'])?.user.name ||
    'local';
  return <ReviewSession key={`${user}:${query}`} storageKey={`garden-review:${user}:${query}`} />;
}
function ReviewSession({ storageKey }: { storageKey: string }) {
  const { scope, topic, query, label } = useScope();
  const cache = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState<{ reviewed: string[]; graduated: Word | null }>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved && Array.isArray(saved.reviewed)) return saved;
    } catch {
      /* Start a fresh session if browser storage is unavailable. */
    }
    return { reviewed: [], graduated: null };
  });
  const saveSession = (next: typeof session) => {
    setSession(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Memory remains usable. */
    }
  };
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(session));
    } catch {
      /* Storage is optional. */
    }
    return () => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Storage is optional. */
      }
    };
  }, [storageKey, session]);
  const reviewed = new Set(session.reviewed);
  const key = ['review', storageKey];
  const result = useQuery({
    queryKey: key,
    queryFn: () => {
      const params = new URLSearchParams(query);
      session.reviewed.forEach((id) => params.append('exclude', id));
      return api<ReviewResult>(`/review?${params}`);
    },
    staleTime: Infinity,
    refetchOnMount: 'always',
  });
  const refreshGarden = () => {
    for (const name of ['garden', 'topic', 'matcher', 'practice', 'flashcards'])
      cache.invalidateQueries({ queryKey: [name] });
  };
  const learn = useMutation({
    mutationFn: () => api<Word>('/review/learned', { word_id: session.graduated!.id }),
    onSuccess: () => {
      saveSession({ ...session, graduated: null });
      refreshGarden();
    },
  });
  const grade = useMutation({
    mutationFn: (value: number) =>
      api<ReviewResult>('/review', {
        word_id: result.data!.card!.word_id,
        grade: value,
        scope,
        topic,
        track: result.data!.card!.track || 'recognition',
        excluded: session.reviewed,
      }),
    onSuccess: (data) => {
      const reviewedId = result.data!.card!.word_id;
      cache.setQueryData(key, data);
      cache.invalidateQueries({ queryKey: ['review'], refetchType: 'none' });
      refreshGarden();
      setRevealed(false);
      saveSession({
        reviewed: [...session.reviewed, reviewedId],
        graduated: data.graduated || null,
      });
    },
  });
  const card = result.data?.card;
  const expectedArticle = card?.article?.trim().toLowerCase();
  const checkArticle =
    card?.pos === 'noun' && ['der', 'die', 'das'].includes(expectedArticle || '');
  const chooseArticle = () => {
    if (grade.isPending || revealed) return;
    setRevealed(true);
  };
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
        {session.graduated ? (
          <div className="panel">
            <h2>Fully grown: {session.graduated.lemma}</h2>
            <p>
              Both review tracks have reached a 60-day interval. Mark this word as Learned to stop
              reviews permanently, or keep reviewing it.
            </p>
            <div className="actions">
              <button className="primary" disabled={learn.isPending} onClick={() => learn.mutate()}>
                Mark as Learned
              </button>
              <button
                disabled={learn.isPending}
                onClick={() => saveSession({ ...session, graduated: null })}
              >
                Keep reviewing
              </button>
            </div>
            <ErrorNotice error={learn.error} />
          </div>
        ) : result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorNotice error={result.error} />
        ) : card ? (
          <>
            <WordCard
              forms="review"
              key={card.word_id}
              word={card}
              revealed={revealed}
              onReveal={() => setRevealed(true)}
              hintsEnabled={!checkArticle}
              articlePrompt={checkArticle}
              revealControls={checkArticle ? false : undefined}
              promptControls={
                checkArticle ? (
                  <fieldset className="review-article-choice">
                    <legend>Choose the correct article</legend>
                    <div className="actions">
                      {['der', 'die', 'das'].map((article) => (
                        <button
                          key={article}
                          disabled={grade.isPending || revealed}
                          onClick={chooseArticle}
                        >
                          {article}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : undefined
              }
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
                : reviewed.size
                  ? 'Session complete. Each word is reviewed once per session.'
                  : 'All caught up! No words are due for review.'}{' '}
            <Link to="/matcher">Find new words</Link>.
          </Empty>
        )}
        <ErrorNotice error={grade.error} />
        {grade.error && (
          <button
            onClick={() => {
              grade.reset();
              setRevealed(false);
              result.refetch();
            }}
          >
            Refresh review
          </button>
        )}
      </div>
    </>
  );
}
