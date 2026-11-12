import { ARTICLES } from '../components/review-terms';

export function ArticleChoices({
  article,
  choice,
  answered,
  busy,
  onChoose,
}: {
  article?: string;
  choice?: string;
  answered: boolean;
  busy: boolean;
  onChoose: (choice: string) => void;
}) {
  return (
    <div className="article-review-options" role="group" aria-label="Choose the correct article">
      {ARTICLES.map((value) => {
        const right = answered && value === article;
        const wrong = answered && value === choice && !right;
        return (
          <button
            key={value}
            disabled={busy || answered}
            className={right ? 'article-correct' : wrong ? 'article-incorrect' : ''}
            aria-label={`${value}${right ? ', correct' : wrong ? ', incorrect' : ''}`}
            onClick={() => onChoose(value)}
          >
            {value}
            <span aria-hidden="true">{right ? ' ✓' : wrong ? ' ×' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
