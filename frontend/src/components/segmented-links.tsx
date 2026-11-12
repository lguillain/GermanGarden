import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface SegmentedLink {
  key: string;
  to: string;
  active: boolean;
  children: ReactNode;
  count?: number;
}

// Compact page-level switch for Heading actions; each option is a scoped link.
export function SegmentedLinks({
  label,
  links,
  current = 'true',
}: {
  label: string;
  links: SegmentedLink[];
  current?: 'true' | 'page';
}) {
  return (
    <div className="word-set-switch" role="group" aria-label={label}>
      {links.map(({ key, to, active, children, count }) => (
        <Link
          key={key}
          className={`button${active ? ' primary' : ''}`}
          aria-current={active ? current : undefined}
          to={to}
        >
          {children}
          {count !== undefined && <span className="word-set-count">{count}</span>}
        </Link>
      ))}
    </div>
  );
}
