import { useOutletContext } from 'react-router-dom';

import { useSearchParams } from 'react-router-dom';

import type { Session } from '../api';

export function useScope() {
  const [params] = useSearchParams();
  const scope = params.get('scope') || 'all';
  const topic = params.get('topic') || '';
  const { activities } = useOutletContext<Session>();
  const label =
    scope === 'bag'
      ? 'Seed bag'
      : scope === 'topic'
        ? activities.find((a) => a.id === topic)?.name || 'Topic'
        : 'Your garden';
  return { scope, topic, label, query: `?${new URLSearchParams({ scope, topic })}` };
}
