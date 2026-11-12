import { invalidateProgress } from '../queries/invalidate-progress';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import type { Card, Word } from '../api';
import { api } from '../api';
import { storageGet, storageRemove, storageSet } from '../browser-storage';
import { Empty, ErrorNotice, Heading, Loading } from '../components/feedback';
import { ProgressBar } from '../components/progress-bar';
import { useRelatedWords } from '../components/related-words-dialog';
import { DIRECTION_LABELS, RATING_LABELS, hasArticle } from '../components/review-terms';
import { SegmentedLinks } from '../components/segmented-links';
import { WordCard } from '../components/word-card';
import { WordSetSwitch } from '../components/word-set-switch';
import { useAccountId } from '../hooks/use-account-id';
import { reviewMode } from '../hooks/use-review-mode';
import { useScope } from '../hooks/use-scope';
import { plural } from '../plural';
import { ArticleChoices } from './article-choices';
import { ArticleReviewCard } from './article-review-card';

function reviewDelay(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr`;
  const days = Math.round((seconds / 86400) * 10) / 10;
  return `${days} ${plural(days, 'day')}`;
}
// The next card in this set, skipping words already reviewed this visit.
function reviewPath(query: string, mode: string, reviewed: string[]) {
  const params = new URLSearchParams(query);
  params.set('mode', mode);
  reviewed.forEach((id) => params.append('exclude', id));
  return `/review?${params}`;
}

interface ReviewResult {
  card: Card | null;
  mode_counts?: Record<string, number>;
  remaining: number;
  counts: { plants: number; seeds: number };
  graduated?: Word | null;
}
export function ReviewPage({ articles = false }: { articles?: boolean }) {
  const { query } = useScope();
  const [params] = useSearchParams();
  const mode = reviewMode(params, articles);
  const user = useAccountId() || 'pending';
  if (!articles && mode === 'article') return <Navigate to={`/articles${query}`} replace />;
  return (
    <ReviewSession
      key={`${user}:${query}:${mode}`}
      storageKey={`garden-review:v2:${user}:${query}:${mode}`}
      mode={mode}
    />
  );
}
function ReviewSession({ storageKey, mode }: { storageKey: string; mode: string }) {
  const { scope, topic, query, label } = useScope();
  const cache = useQueryClient();
  const [revealed, setRevealed] = useState(false);
  const related = useRelatedWords();
  const [session, saveSession] = useState<{
    reviewed: string[];
    graduated: Word | null;
    pending?: Card;
    articleCorrect?: boolean;
    articleChoice?: string;
  }>(() => {
    try {
      const saved = JSON.parse(storageGet('session', storageKey) || 'null');
      if (saved && Array.isArray(saved.reviewed)) return saved;
    } catch {
      /* Start a fresh session if the saved one is unreadable. */
    }
    return { reviewed: [], graduated: null };
  });
  // Session storage is optional; a lost save only restarts this visit's exclusions.
  useEffect(() => void storageSet('session', storageKey, session), [storageKey, session]);
  useEffect(() => () => void storageRemove('session', storageKey), [storageKey]);
  const reviewed = new Set(session.reviewed);
  const key = ['review', storageKey];
  const result = useQuery({
    queryKey: key,
    queryFn: () => api<ReviewResult>(reviewPath(query, mode, session.reviewed)),
    staleTime: Infinity,
    refetchOnMount: 'always',
  });
  const learn = useMutation({
    mutationFn: () => api<Word>('/review/learned', { word_id: session.graduated!.id }),
    onSuccess: () => {
      saveSession({ ...session, graduated: null });
      invalidateProgress(cache, 'review');
    },
  });
  const card = session.pending || result.data?.card;
  const grade = useMutation({
    mutationFn: (value: number | 'wrong-article') =>
      api<ReviewResult>('/review', {
        word_id: card!.word_id,
        grade: value === 'wrong-article' ? 3 : value,
        wrong_article: value === 'wrong-article',
        scope,
        topic,
        track: card!.track || 'recognition',
        excluded: session.reviewed,
        mode,
        continuation: !!session.pending,
      }),
    onSuccess: (data) => {
      const reviewedId = card!.word_id;
      cache.setQueryData(key, data);
      cache.invalidateQueries({ queryKey: ['review'], refetchType: 'none' });
      invalidateProgress(cache, 'review');
      setRevealed(false);
      saveSession({
        reviewed: [...session.reviewed, reviewedId],
        graduated: data.graduated || null,
      });
    },
  });

  const checkArticle = mode !== 'production' && hasArticle(card);
  const articleGrade = useMutation({
    mutationFn: (choice: string) =>
      api<{ card: Card; correct: boolean }>('/review/article', {
        word_id: card!.word_id,
        choice,
        expected_article_reviewed_at: card!.article_reviewed_at || null,
        scope,
        topic,
        mode,
        excluded: session.reviewed,
      }),
    onSuccess: (data, choice) => {
      saveSession({
        ...session,
        pending: data.card,
        articleCorrect: data.correct,
        articleChoice: choice,
      });
      void result.refetch();
      invalidateProgress(cache, 'review');
    },
  });
  const nextArticle = async () => {
    const reviewed = [...session.reviewed, card!.word_id];
    const data = await api<ReviewResult>(reviewPath(query, mode, reviewed));
    cache.setQueryData(key, data);
    saveSession({ reviewed, graduated: null });
  };
  const advance = useMutation({ mutationFn: nextArticle });
  const busy = grade.isPending || articleGrade.isPending || advance.isPending;
  const articleChoices = checkArticle ? (
    <ArticleChoices
      article={card?.article}
      choice={session.articleChoice}
      answered={!!session.pending}
      busy={busy}
      onChoose={articleGrade.mutate}
    />
  ) : undefined;
  return (
    <>
      <Heading
        title={mode === 'article' ? 'Articles' : 'Review'}
        actions={
          <>
            {mode !== 'article' && (
              <SegmentedLinks
                label="Review mode"
                current="page"
                links={(['production', 'recognition'] as const).map((value) => ({
                  key: value,
                  to: `/review${query}&mode=${value}`,
                  active: mode === value,
                  children: DIRECTION_LABELS[value],
                  count: result.data?.mode_counts?.[value],
                }))}
              />
            )}
            <WordSetSwitch counts={result.data?.counts} />
          </>
        }
      >
        {scope === 'topic' ? label : undefined}
      </Heading>
      <div className={`study${mode === 'article' ? ' article-study' : ''}`}>
        {result.data && (
          <ProgressBar
            counts={
              <>
                <span>{reviewed.size} reviewed</span>
                <span>{result.data.remaining} to review</span>
              </>
            }
            label="Review progress"
            valueText={`${reviewed.size} words reviewed this visit, ${result.data.remaining} words to review`}
            value={reviewed.size}
            max={reviewed.size + result.data.remaining}
          />
        )}
        {session.graduated ? (
          <div className="panel">
            <h2>Fully grown: {session.graduated.lemma}</h2>
            <p>
              Both review tracks have reached a 55-day interval. Mark this word as Learned to stop
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
        ) : card && mode === 'article' ? (
          <ArticleReviewCard
            card={card}
            answered={!!session.pending}
            correct={session.articleCorrect}
            choice={session.articleChoice}
            busy={busy}
            advanceFailed={advance.isError}
            onChoose={articleGrade.mutate}
            onNext={advance.mutate}
          />
        ) : card ? (
          <>
            <WordCard
              context="review"
              showDirection={false}
              key={card.word_id}
              word={card}
              revealed={revealed}
              onReveal={() => setRevealed(true)}
              footerControls={
                revealed && (
                  <button
                    className="button"
                    aria-haspopup="dialog"
                    disabled={busy}
                    onClick={() => related.show(card)}
                  >
                    Related words
                  </button>
                )
              }
              hintsEnabled={!checkArticle || !!session.pending}
              articlePrompt={checkArticle && !session.pending}
              articleAnswered={!!session.pending}
              revealEnabled={!checkArticle || !!session.pending}
            />
            {articleChoices && <div className="article-answer-controls">{articleChoices}</div>}
            {revealed && (
              <div className="grade-actions">
                {mode === 'production' && hasArticle(card) && (
                  <button disabled={busy} onClick={() => grade.mutate('wrong-article')}>
                    <strong>Wrong article</strong>
                  </button>
                )}
                {card.rating_options?.map((option) => (
                  <button
                    key={option.grade}
                    disabled={busy}
                    className={option.grade === 3 ? 'primary' : ''}
                    onClick={() => grade.mutate(option.grade)}
                  >
                    <strong>{RATING_LABELS[option.grade - 1]}</strong>
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
        <ErrorNotice error={grade.error || articleGrade.error || advance.error} />
        {grade.error && (
          <button
            onClick={() => {
              grade.reset();
              articleGrade.reset();
              saveSession({ ...session, pending: undefined });
              setRevealed(false);
              result.refetch();
            }}
          >
            Refresh review
          </button>
        )}
      </div>
      {related.dialog}
    </>
  );
}
