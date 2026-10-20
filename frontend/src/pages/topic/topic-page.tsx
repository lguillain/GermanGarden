import { TopicScene } from './topic-scene';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import type { Activity, Session, Word } from '../../api';
import { api } from '../../api';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { PlantIcon, SeedIcon } from '../../components/garden-artwork';
import { ScopeLinks } from './scope-links';
import { TopicProgress } from '../../components/topic-progress';
import { WordTitle } from '../../components/word-card';

export function TopicPage() {
  const { user } = useOutletContext<Session>();
  const topic = decodeURIComponent(useLocation().pathname.split('/').pop() || '');
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showOtherLevels, setShowOtherLevels] = useState(false);
  const [sort, setSort] = useState<{
    key: 'lemma' | 'english' | 'level' | 'status';
    descending: boolean;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const result = useQuery({
    queryKey: ['topic', topic],
    queryFn: () =>
      api<{ activity: Activity; words: Word[] }>(`/topics/${encodeURIComponent(topic)}`),
  });
  const add = useMutation({
    mutationFn: (word: Word) =>
      api<{ added: boolean }>(
        `/topics/${encodeURIComponent(topic)}/words/${encodeURIComponent(word.id)}/keep`,
        {},
      ),
    onSuccess: async (data, word) => {
      setNotice(
        data.added
          ? `${word.lemma} added to your seed bag.`
          : 'This word is already in your bag or garden.',
      );
      await cache.invalidateQueries();
    },
  });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorNotice error={result.error} />;
  const { activity, words } = result.data!;
  const overview = words
    .filter((word) => word.level === user.level)
    .reduce(
      (counts, word) => {
        counts[word.visual_stage || 'unseen']++;
        return counts;
      },
      { unseen: 0, seeds: 0, planted: 0, due: 0, grown: 0 },
    );
  const statuses: Record<string, string> = {
    new: 'Unseen',
    not_now: 'Not now',
    learned: 'Learned',
    bag: 'In seed bag',
    planted: 'Planted',
    due: 'Review due',
    grown: 'Grown',
  };
  const visibleWords = words.filter(
    (w) =>
      showOtherLevels || w.level === user.level || (w.status !== 'new' && w.status !== 'not_now'),
  );
  const matching = visibleWords.filter(
    (w) =>
      (filter === 'all' ||
        (filter === 'due'
          ? w.review_due
          : filter === 'grown'
            ? w.visual_stage === 'grown'
            : filter === 'learned'
              ? w.learned
              : w.status === filter)) &&
      `${w.article || ''} ${w.lemma} ${w.english}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const statusLabel = (word: Word) => {
    const status = word.review_due
      ? 'Review due'
      : word.learned
        ? 'Learned'
        : statuses[word.status || 'new'];
    return status;
  };
  if (sort)
    matching.sort((a, b) => {
      const valueA = sort.key === 'status' ? statusLabel(a) : a[sort.key];
      const valueB = sort.key === 'status' ? statusLabel(b) : b[sort.key];
      const order = valueA.localeCompare(valueB, sort.key === 'lemma' ? 'de' : 'en', {
        numeric: true,
        sensitivity: 'base',
      });
      return (
        (sort.descending ? -order : order) ||
        a.lemma.localeCompare(b.lemma, 'de') ||
        a.id.localeCompare(b.id)
      );
    });
  const columns = [
    ['lemma', 'Word'],
    ['english', 'Meaning'],
    ['level', 'Level'],
    ['status', 'Status'],
  ] as const;
  return (
    <>
      <div className="topic-back-links">
        <Link className="back" to="/">
          ← Garden
        </Link>
        <Link className="back" to="/explore">
          Explore topics
        </Link>
      </div>
      <div className="topic-page-heading">
        <Heading title={activity.name} />
        <ScopeLinks
          scope="topic"
          topic={topic}
          disabled={!words.some((w) => w.status === 'planted')}
        />
      </div>
      <section className="topic-progress-summary" aria-label="Topic progress">
        <span className="level-progress-label">{user.level} progress</span>
        <TopicProgress counts={overview} />
      </section>
      <TopicScene
        key={topic}
        plot={{
          id: activity.id,
          name: activity.name,
          words: words.filter((w) => w.status === 'planted' || w.learned),
        }}
      />
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
            <option value="all">All statuses ({visibleWords.length})</option>
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
      {matching.length ? (
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
                    w.status === 'new' && user.level && w.level !== user.level
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
                    {w.status !== 'bag' && w.status !== 'planted' && (
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
