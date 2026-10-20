import { useState } from 'react';
import type { Word } from '../api';

export function WordTitle({ word, showArticle = true }: { word: Word; showArticle?: boolean }) {
  return (
    <span lang="de">
      {showArticle && word.article && <span className="article">{word.article} </span>}
      {word.lemma}
    </span>
  );
}

function ProductionHint({ lemma }: { lemma: string }) {
  const [visible, setVisible] = useState(false);
  return visible ? (
    <p>Hint: {Array.from(lemma)[0]}…</p>
  ) : (
    <button className="button" onClick={() => setVisible(true)}>
      Hint
    </button>
  );
}

export function WordCard({
  word,
  revealed,
  onReveal,
  direction,
}: {
  word: Word;
  revealed: boolean;
  onReveal: () => void;
  direction?: 'recognition' | 'production';
}) {
  const production = (direction || word.track) === 'production';
  return (
    <article className="panel word-card">
      {(direction || word.track) && (
        <p className="review-direction">{production ? 'EN → DE' : 'DE → EN'}</p>
      )}
      <div className="word-meta">
        {word.level} <span>·</span> {word.pos}
      </div>
      <h2>{production ? word.english : <WordTitle word={word} showArticle={revealed} />}</h2>
      {production && word.en && (
        <p className="sentence" lang="en">
          {word.en}
        </p>
      )}
      {production && !revealed && word.pos === 'noun' && (
        <p className="muted">Include the article</p>
      )}
      {(!production || revealed) && word.plural && (
        <p className="muted" lang="de">
          Plural: {word.plural}
        </p>
      )}
      {(!production || revealed) && word.de && (
        <p className="sentence" lang="de">
          {word.de}
        </p>
      )}
      {revealed ? (
        <div className="translation">
          <strong>{production ? <WordTitle word={word} /> : word.english}</strong>
          {!production && word.en && <p>{word.en}</p>}
        </div>
      ) : (
        <div className="actions">
          {production && <ProductionHint key={word.id} lemma={word.lemma} />}
          <button className="button" onClick={onReveal}>
            {production ? 'Show answer' : 'Show translation'}
          </button>
        </div>
      )}
    </article>
  );
}
