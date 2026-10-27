import { topicWordList, statuses, statusLabel, type TopicWordSort } from './topic-word-list';
import { invalidateProgress } from '../../queries/invalidate-progress';
import { TopicScene } from './topic-scene';
import { gardenGnomeCount } from '../../components/garden-gnome-count';
import { useGardenTime } from '../../hooks/use-garden-time';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useOutletContext } from 'react-router-dom';
import type { Activity, Session, Word } from '../../api';
import { api } from '../../api';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { PlantIcon, SeedIcon } from '../../components/garden-artwork';
import { ScopeLinks } from './scope-links';
import { TopicProgress } from '../../components/topic-progress';
import { WordTitle } from '../../components/word-card';

export function TopicPage() {
  const now = useGardenTime();
  const user = useOutletContext<Session | undefined>()?.user;
  const { topic = '' } = useParams<{ topic: string }>();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showOtherLevels, setShowOtherLevels] = useState(false);
  const [sort, setSort] = useState<TopicWordSort | null>(null);
  const [notice, setNotice] = useState('');
  const result = useQuery({
    queryKey: ['topic', topic],
    refetchInterval: 60_000,
    queryFn: () =>
      api<{ activity: Activity; words: Word[] }>(`/topics/${encodeURIComponent(topic)}`),
  });
  const add = useMutation({
    mutationFn: (word: Word) =>
      api<{ added: boolean; word: Word }>(
        `/topics/${encodeURIComponent(topic)}/words/${encodeURIComponent(word.id)}/keep`,
        {},
      ),
    onMutate: () => cache.cancelQueries({ queryKey: ['topic'] }),
    onSuccess: (data, word) => {
      setNotice(
        data.added
          ? `${word.lemma} added to your seed bag.`
          : 'This word is already in your bag or garden.',
      );
      cache.setQueriesData<{ activity: Activity; words: Word[] }>(
        { queryKey: ['topic'] },
        (previous) =>
          previous && {
            ...previous,
            words: previous.words.map((item) => (item.id === data.word.id ? data.word : item)),
          },
      );
      // The confirmed word is already visible. Other screens refresh when opened;
      // profile, topic names and timers do not depend on seed-bag changes.
      invalidateProgress(cache, 'topic-addition');
    },
  });
  const activity = result.data?.activity;
  const words = result.data?.words ?? [];
  const wordsReady = Boolean(result.data && (user || showOtherLevels));
  const overview = words
    .filter((word) => word.level === user?.level)
    .reduce(
      (counts, word) => {
        counts[word.visual_stage || 'unseen']++;
        return counts;
      },
      { unseen: 0, seeds: 0, planted: 0, due: 0, grown: 0 },
    );
  const { visibleWords, matching } = topicWordList(words, {
    level: user?.level,
    showOtherLevels,
    filter,
    search,
    sort,
  });
  const columns = [
    ['lemma', 'Word'],
    ['english', 'Meaning'],
    ['level', 'Level'],
    ['status', 'Status'],
  ] as const;
  return (
    <>
      <Heading
        title={activity?.name ?? 'Topic'}
        navigation={[{ to: '/explore', label: '← Explore topics' }]}
        actions={
          <ScopeLinks
            gnomeCount={gardenGnomeCount(words, now)}
            scope="topic"
            topic={topic}
            disabled={
              Boolean(result.data) && !words.some((w) => w.status === 'planted' || w.learned)
            }
          />
        }
      />
      {result.data && user && (
        <section className="topic-progress-summary" aria-label="Topic progress">
          <span className="level-progress-label">{user?.level} progress</span>
          <TopicProgress counts={overview} />
        </section>
      )}
      {activity && (
        <TopicScene
          key={topic}
          plot={{
            id: activity.id,
            name: activity.name,
            words: words.filter((w) => w.status === 'planted' || w.learned),
          }}
        />
      )}
      <h2 className="topic-list-heading">Words</h2>
      <div className="topic-word-controls">
        <label>
          <span className="sr-only">Search words</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search German or English…"
          />
        </label>
        <label>
          <span className="sr-only">Word status</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses{wordsReady ? ` (${visibleWords.length})` : ''}</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="other-levels-toggle">
          <input
            type="checkbox"
            checked={showOtherLevels}
            onChange={(e) => setShowOtherLevels(e.target.checked)}
          />
          Show other levels
        </label>
      </div>
      {notice && (
        <p role="status" className="small">
          {notice}
        </p>
      )}
      <ErrorNotice error={add.error} />
      <ErrorNotice error={result.error} />
      {result.isPending ? (
        <Loading />
      ) : !result.data ? null : !wordsReady ? (
        <p className="muted">Waiting for your level to filter words.</p>
      ) : matching.length ? (
        <div className="panel table-wrap">
          <table className="topic-words">
            <thead>
              <tr>
                {columns.map(([key, label]) => (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={
                      sort?.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'
                    }
                  >
                    <button
                      className="table-sort"
                      onClick={() =>
                        setSort((current) => ({
                          key,
                          descending: current?.key === key ? !current.descending : false,
                        }))
                      }
                    >
                      {label}
                      <span aria-hidden="true">
                        {sort?.key === key ? (sort.descending ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th>
                  <span className="sr-only">Seed bag</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {matching.map((w) => (
                <tr
                  key={w.id}
                  className={
                    w.status === 'new' && user?.level && w.level !== user?.level
                      ? 'word-outside-level'
                      : undefined
                  }
                >
                  <td>
                    <WordTitle word={w} />
                  </td>
                  <td>{w.english}</td>
                  <td>{w.level}</td>
                  <td>
                    <span className={`badge status-chip stage-${w.visual_stage || 'unseen'}`}>
                      {w.status === 'bag' ? (
                        <SeedIcon />
                      ) : w.status === 'planted' || Boolean(w.learned) ? (
                        <PlantIcon word={w} />
                      ) : null}
                      {statusLabel(w)}
                    </span>
                  </td>
                  <td>
                    {w.review_due && (
                      <Link
                        className="button review-word-link"
                        to={`/review?scope=topic&topic=${encodeURIComponent(topic)}`}
                      >
                        Review
                      </Link>
                    )}
                    {!w.learned &&
                      w.status !== 'learned' &&
                      w.status !== 'bag' &&
                      w.status !== 'planted' && (
                        <button
                          disabled={add.isPending}
                          aria-label={`Add ${w.lemma} to seed bag`}
                          onClick={() => add.mutate(w)}
                        >
                          {add.isPending && add.variables?.id === w.id ? 'Adding…' : 'Add to bag'}
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No words match this view.</Empty>
      )}
    </>
  );
}
