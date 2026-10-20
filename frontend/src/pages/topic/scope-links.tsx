import { Link } from 'react-router-dom';

export function ScopeLinks({
  scope = 'all',
  topic = '',
  disabled = false,
}: {
  scope?: string;
  topic?: string;
  disabled?: boolean;
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
        Review
      </Link>
    </div>
  );
}
