import { Link, useOutletContext } from 'react-router-dom';
import type { Session, Topic } from '../../api';
import { TopicProgress } from '../../components/topic-progress';

export function TopicList({ topics }: { topics: Topic[] }) {
  const { user } = useOutletContext<Session>();
  return (
    <div className="topic-list">
      {topics.map((t) => (
        <Link
          className="topic-row topic-overview-row"
          key={t.id}
          to={`/topics/${encodeURIComponent(t.id)}`}
        >
          <span className="topic-name">
            {t.name}
            <span className="topic-total small muted">
              {Object.values(t.overview).reduce((sum, count) => sum + count, 0)} {user.level} words
            </span>
          </span>
          <TopicProgress counts={t.overview} />
          <span className="topic-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </div>
  );
}
