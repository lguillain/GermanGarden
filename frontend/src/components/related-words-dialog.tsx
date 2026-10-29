import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import type { Word } from '../api';
import { api } from '../api';
import { closeOnBackdropClick } from './dialog-backdrop';
import { ErrorNotice, Loading } from './feedback';
import { WordTitle } from './word-card';
import { statusLabel } from './word-status';

interface RelatedWords {
  word: Word;
  family: Word[];
  together: Word[];
}

// Experimental: browse connected words one word at a time, without changing progress.
export function RelatedWordsDialog({ word, onClose }: { word: Word | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [trail, setTrail] = useState<Word[]>([]);
  const current = trail.at(-1);
  const result = useQuery({
    queryKey: ['related-words', current?.id],
    enabled: Boolean(current),
    queryFn: () => api<RelatedWords>(`/words/${encodeURIComponent(current!.id)}/related`),
  });
  useEffect(() => {
    if (!word) return;
    setTrail([word]);
    if (!dialog.current?.open) dialog.current?.showModal();
  }, [word]);
  const groups = [
    ['Same family', result.data?.family],
    ['Used together', result.data?.together],
  ] as const;
  return (
    <dialog
      ref={dialog}
      className="upcoming-reviews related-words-dialog"
      aria-labelledby={title}
      onClick={closeOnBackdropClick}
      onClose={onClose}
    >
      <div className="upcoming-reviews-header">
        <h2 id={title}>
          Related words <span className="badge related-words-experimental">Experimental</span>
        </h2>
        <button onClick={() => dialog.current?.close()} autoFocus>
          Close
        </button>
      </div>
      {current && (
        <div className="related-words-current">
          <strong>
            <WordTitle word={current} />
          </strong>
          <span>{current.english}</span>
          {trail.length > 1 && (
            <button className="related-words-back" onClick={() => setTrail(trail.slice(0, -1))}>
              ← {trail.at(-2)!.lemma}
            </button>
          )}
        </div>
      )}
      <ErrorNotice error={result.error} />
      {result.isPending && current ? (
        <Loading />
      ) : result.data && !result.data.family.length && !result.data.together.length ? (
        <p>No related words found yet.</p>
      ) : (
        groups.map(
          ([label, words]) =>
            Boolean(words?.length) && (
              <section key={label} className="related-words-group">
                <h3>{label}</h3>
                <ul>
                  {words!.map((related) => (
                    <li key={related.id}>
                      <button
                        className="related-word"
                        onClick={() => setTrail([...trail, related])}
                      >
                        <span className="related-word-lemma">
                          <WordTitle word={related} />
                        </span>
                        <span className="related-word-meaning">{related.english}</span>
                        <span
                          className={`badge status-chip stage-${related.visual_stage || 'unseen'}`}
                        >
                          {statusLabel(related)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )
      )}
    </dialog>
  );
}
