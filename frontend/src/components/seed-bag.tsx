import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { Word } from '../api';
import { ErrorNotice, Loading } from './feedback';
import { WordTitle } from './word-card';

export function SeedBag({
  words,
  error,
  collapsible = false,
}: {
  words?: Word[];
  error?: unknown;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <aside
      className={`panel bag${collapsible ? ' collapsible-bag' : ''}${open ? ' bag-open' : ''}`}
      aria-label="Seed bag"
    >
      {collapsible && (
        <button
          className="mobile-bag-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          Seed bag · {words ? words.length : '…'} / 20 · {open ? 'Close' : 'Open'}
        </button>
      )}
      <div className="section-heading">
        <h2>Seed bag</h2>
        <span className="badge">{words ? words.length : '…'} / 20</span>
      </div>
      {words?.length !== 0 ? (
        <>
          {words ? (
            <ul className="bag-words">
              {words.map((w) => (
                <li key={w.id}>
                  <WordTitle word={w} />
                </li>
              ))}
            </ul>
          ) : error ? (
            <ErrorNotice error={error} />
          ) : (
            <Loading />
          )}
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
