import { PlantIcon } from './garden-artwork';
import { FormsButton } from './forms-button';
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
  forms,
}: {
  word: Word;
  revealed: boolean;
  onReveal: () => void;
  direction?: 'recognition' | 'production';
  forms?: 'practice' | 'review';
}) {
  const production = (direction || word.track) === 'production';
  return (
    <article className={`panel word-card${forms ? ' study-word-card' : ''}`}>
      <div className="word-card-header">
        <div className="word-card-context">
          {forms && <PlantIcon word={word} />}
          <div className="word-meta">
            {word.level} <span>·</span> {word.pos}
          </div>
        </div>
        {(direction || word.track) && (
          <span className="review-direction">{production ? 'EN → DE' : 'DE → EN'}</span>
        )}
      </div>
      <h2>
        {production && !revealed ? word.english : <WordTitle word={word} showArticle={revealed} />}
      </h2>
      {production && !revealed && word.en && (
        <p className="sentence" lang="en">
          {word.en}
        </p>
      )}
      {production && !revealed && word.pos === 'noun' && (
        <p className="word-detail muted">Include the article</p>
      )}
      {(!production || revealed) && word.plural && (
        <p className="word-detail muted" lang="de">
          Plural: {word.plural}
        </p>
      )}
      {(!production || revealed) && word.de && (
        <p className="sentence" lang="de">
          {word.de}
        </p>
      )}
      {revealed && (
        <div className="translation answer-context" lang="en">
          <strong>{word.english}</strong>
          {word.en && <p>{word.en}</p>}
        </div>
      )}
      <div className="word-card-footer">
        {!revealed && (
          <div className="actions">
            <button className="button" onClick={onReveal}>
              {production ? 'Show answer' : 'Show translation'}
            </button>
            {production && <ProductionHint key={word.id} lemma={word.lemma} />}
          </div>
        )}
        {(forms === 'practice' || (forms === 'review' && revealed)) && (
          <FormsButton key={word.id} word={word} />
        )}
      </div>
    </article>
  );
}
