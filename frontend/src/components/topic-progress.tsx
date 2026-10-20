import type { Topic } from '../api';

export const topicStages = [
  ['unseen', 'Unseen / Not now'],
  ['seeds', 'Seeds'],
  ['planted', 'Planted'],
  ['due', 'Review due'],
  ['grown', 'Grown / Learned'],
] as const;

export function TopicProgress({ counts }: { counts: Topic['overview'] }) {
  const description = topicStages
    .map(([key, label]) => `${label}: ${counts[key]} words`)
    .join(', ');
  return (
    <span className="topic-distribution" role="img" aria-label={description}>
      <span className="topic-bar" aria-hidden="true">
        {topicStages.map(([key, label]) => (
          <span
            key={key}
            className={`stage-${key}`}
            style={{ flexGrow: counts[key] }}
            title={`${label}: ${counts[key]} words`}
          />
        ))}
      </span>
      <span className="topic-counts" aria-hidden="true">
        {topicStages.map(([key, label]) => (
          <span key={key} title={`${label}: ${counts[key]} words`}>
            <i className={`stage-${key}`} />
            {counts[key]}
          </span>
        ))}
      </span>
    </span>
  );
}
