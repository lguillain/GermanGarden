import { Link } from 'react-router-dom';
import { useScope } from '../hooks/use-scope';
import { PlantIcon, SeedIcon } from './garden-artwork';

export function WordSetSwitch({
  page,
  counts,
}: {
  page: '/practice' | '/review';
  counts?: { plants: number; seeds: number };
}) {
  const { scope, topic } = useScope();
  return (
    <div className="word-set-switch" role="group" aria-label="Word set">
      <Link
        className={`button${scope !== 'bag' ? ' primary' : ''}`}
        aria-current={scope !== 'bag' ? 'true' : undefined}
        to={`${page}?${new URLSearchParams({ scope: topic ? 'topic' : 'all', topic })}`}
      >
        <span aria-hidden="true">
          <PlantIcon />
        </span>
        Plants{counts && <span className="word-set-count">{counts.plants}</span>}
      </Link>
      <Link
        className={`button${scope === 'bag' ? ' primary' : ''}`}
        aria-current={scope === 'bag' ? 'true' : undefined}
        to={`${page}?${new URLSearchParams({ scope: 'bag', topic })}`}
      >
        <span aria-hidden="true">
          <SeedIcon />
        </span>
        Seeds{counts && <span className="word-set-count">{counts.seeds}</span>}
      </Link>
    </div>
  );
}
