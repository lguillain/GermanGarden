import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { gardenQuery } from '../../queries/garden-query';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { TopicList } from './topic-list';
import { topicStages } from '../../components/topic-progress';

export function ExplorePage() {
  const [filter, setFilter] = useState('');
  const result = useQuery(gardenQuery());
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorNotice error={result.error} />;
  const topics = result.data!.topics;
  const matching = topics.filter((topic) =>
    topic.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  return (
    <>
      <Heading title="Explore more topics" />
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
      {matching.length ? (
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
