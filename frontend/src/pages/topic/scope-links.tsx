import { Link } from 'react-router-dom';
import { GnomeReviewIcon } from '../../components/gnome-review-icon';

export function ScopeLinks({
  scope = 'all',
  topic = '',
  disabled = false,
  gnomeCount = 0,
}: {
  scope?: string;
  topic?: string;
  disabled?: boolean;
  gnomeCount?: number;
}) {
  const query = `?${new URLSearchParams({ scope, topic })}`;
  return disabled ? (
    <span className="muted">Plant words to practise and review</span>
  ) : (
    <div className="actions">
      <Link className="button" to={`/practice${query}`}>
        Practice
      </Link>
      <Link className="button" to={`/review${query}`}>
        {gnomeCount > 0 && <GnomeReviewIcon />}
        Review
      </Link>
    </div>
  );
}
