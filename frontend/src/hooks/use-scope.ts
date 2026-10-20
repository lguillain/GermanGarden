import { useSearchParams } from 'react-router-dom';
import { useActivities } from './use-activities';

export function useScope() {
  const [params] = useSearchParams();
  const scope = params.get('scope') || 'all';
  const topic = params.get('topic') || '';
  const activities = useActivities(scope === 'topic');
  const label =
    scope === 'bag'
      ? 'Seed bag'
      : scope === 'topic'
        ? activities.data?.find((a) => a.id === topic)?.name || 'Topic'
        : 'Your garden';
  return { scope, topic, label, query: `?${new URLSearchParams({ scope, topic })}` };
}
