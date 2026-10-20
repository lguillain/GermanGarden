import { Link } from 'react-router-dom';
import type { Word } from '../api';
import { WordTitle } from './word-card';

export function SeedBag({ words }: { words: Word[] }) {
  return (
    <aside className="panel bag" aria-label="Seed bag">
      <div className="section-heading">
        <h2>Seed bag</h2>
        <span className="badge">{words.length} / 20</span>
      </div>
      {words.length ? (
        <>
          <ul className="bag-words">
            {words.map((w) => (
              <li key={w.id}>
                <WordTitle word={w} />
              </li>
            ))}
          </ul>
          <div className="actions">
            <Link className="button" to="/practice?scope=bag">
              Practice
            </Link>
            <Link className="button primary" to="/review?scope=bag">
              Plant
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="muted">Your seed bag is empty.</p>
          <Link className="button primary" to="/matcher">
            Find words
          </Link>
        </>
      )}
    </aside>
  );
}
