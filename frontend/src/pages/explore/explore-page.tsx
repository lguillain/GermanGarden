import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { gardenQuery } from '../../queries/garden-query';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { TopicList } from './topic-list';
import { TopicProgress, topicStages } from '../../components/topic-progress';

export function ExplorePage() {
  const [filter, setFilter] = useState('');
  const result = useQuery(gardenQuery());
  const topics = result.data?.topics ?? [];
  const progress = result.data?.level_progress;
  const total = progress
    ? Object.values(progress.overview).reduce((sum, count) => sum + count, 0)
    : 0;
  const matching = topics.filter((topic) =>
    topic.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  return (
    <>
      <Heading title="Explore more topics" />
      {progress && (
        <section className="panel explore-level-progress" aria-label="Overall level progress">
          <h2>{progress.level ? `${progress.level} progress` : 'Overall progress'}</h2>
          <p className="small muted">
            {progress.overview.grown} of {total} words grown or learned
          </p>
          <TopicProgress counts={progress.overview} />
        </section>
      )}
      <div className="explore-controls">
        <label className="explore-search">
          <span className="sr-only">Find a topic to explore</span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a topic…"
          />
        </label>
        <div className="topic-legend">
          {topicStages.map(([key, label]) => (
            <span key={key}>
              <i className={`stage-${key}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <ErrorNotice error={result.error} />
      {result.isPending ? (
        <Loading />
      ) : !result.data ? null : matching.length ? (
        <TopicList topics={matching} />
      ) : (
        <Empty>
          {topics.length
            ? 'No topics match your search.'
            : 'Every topic has a place in your garden.'}
        </Empty>
      )}
    </>
  );
}
