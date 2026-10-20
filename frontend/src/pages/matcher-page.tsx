import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import type { Matcher, Session } from '../api';
import { api } from '../api';
import { Empty, ErrorNotice, Heading, Loading } from '../components/feedback';
import { SeedBag } from '../components/seed-bag';
import { WordCard } from '../components/word-card';

export function MatcherPage() {
  const { activities, ai_available } = useOutletContext<Session>();
  const [params] = useSearchParams();
  const initialTopic = params.get('topic') || '';
  const [topic, setTopic] = useState(initialTopic);
  const [guidance, setGuidance] = useState('');
  const [revealed, setRevealed] = useState(false);
  const cache = useQueryClient();
  const key = ['matcher', initialTopic];
  const result = useQuery({
    queryKey: key,
    queryFn: () => api<Matcher>(`/matcher?topic=${encodeURIComponent(initialTopic)}`),
    staleTime: Infinity,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });
  const update = (data: Matcher) => {
    cache.setQueryData(key, data);
    cache.invalidateQueries({ queryKey: ['garden'] });
    setRevealed(false);
  };
  const guide = useMutation({
    mutationFn: (selection: { topic: string; guidance?: string }) =>
      api<Matcher>('/guide', selection),
    onSuccess: update,
  });
  const swipe = useMutation({
    onMutate: () => {
      setRevealed(false);
    },
    mutationFn: (action: string) => {
      const c = result.data!.card!;
      return api<Matcher>('/matcher', {
        action,
        word_id: c.word_id,
        activity_id: c.activity_id,
        sentence_id: c.sentence_id,
      });
    },
    onSuccess: update,
  });
  const loading = result.isPending || result.isFetching;
  const busy = loading || guide.isPending || swipe.isPending;
  const preview = swipe.isPending ? result.data?.previews?.[swipe.variables] : undefined;
  const card = preview?.card === undefined ? result.data?.card : preview.card;
  useEffect(() => {
    setRevealed(false);
    setTopic(initialTopic);
  }, [initialTopic]);
  return (
    <>
      <Heading title="Find new words" />
      <div className="matcher-layout">
        <section className="panel matcher-selection" aria-label="Word selection">
          <label htmlFor="matcher-topic">Topic</label>
          <select
            id="matcher-topic"
            value={topic}
            disabled={busy}
            onChange={(e) => {
              setTopic(e.target.value);
              guide.mutate({ topic: e.target.value });
            }}
          >
            <option value="">Choose for me</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {ai_available && (
            <details className="disclosure matcher-guidance">
              <summary>Help me choose a topic</summary>
              <form
                className="disclosure-body"
                onSubmit={(e) => {
                  e.preventDefault();
                  setTopic('');
                  guide.mutate({ topic: '', guidance });
                }}
              >
                <label htmlFor="matcher-guidance">Where will you use German?</label>
                <p id="matcher-guidance-help" className="muted small">
                  We’ll match your description to a topic and show related words.
                </p>
                <textarea
                  id="matcher-guidance"
                  aria-describedby="matcher-guidance-help"
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  placeholder="A wine evening with friends"
                  maxLength={3000}
                  disabled={busy}
                  required
                />
                <button disabled={busy || !guidance.trim()}>
                  {guide.isPending ? 'Matching…' : 'Match a topic'}
                </button>
              </form>
            </details>
          )}
          {guide.isPending && (
            <p className="muted small" role="status">
              Finding words…
            </p>
          )}
          <ErrorNotice error={guide.error} />
        </section>
        <section className="matcher-study" aria-label="Current word" aria-busy={busy}>
          {loading ? (
            <Loading />
          ) : result.error ? (
            <ErrorNotice error={result.error} />
          ) : card ? (
            <>
              <div className="panel matcher-card">
                <p className="eyebrow">{card.activity_name || 'Core vocabulary'}</p>
                <WordCard
                  key={card.word_id}
                  word={card}
                  revealed={revealed}
                  onReveal={() => setRevealed(true)}
                />
                <div className="card-actions">
                  <button disabled={busy} onClick={() => swipe.mutate('not_now')}>
                    Not now
                  </button>
                  <button disabled={busy} onClick={() => swipe.mutate('learned')}>
                    Already learned
                  </button>
                  <button className="primary" disabled={busy} onClick={() => swipe.mutate('keep')}>
                    Keep word
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Empty>
              <h2>No more words in this selection</h2>
              <p>Choose another topic.</p>
            </Empty>
          )}
          {swipe.isPending && (
            <p className="muted small" role="status">
              Saving your choice…
            </p>
          )}
          <ErrorNotice error={swipe.error} />
          {swipe.error && <button onClick={() => result.refetch()}>Refresh card</button>}
        </section>
        <SeedBag words={result.data?.bag || []} />
      </div>
    </>
  );
}
