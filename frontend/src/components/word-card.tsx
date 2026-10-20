import type { Word } from '../api';

export function WordTitle({ word, showArticle = true }: { word: Word; showArticle?: boolean }) {
  return (
    <span lang="de">
      {showArticle && word.article && <span className="article">{word.article} </span>}
      {word.lemma}
    </span>
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
      {production && !revealed && (
        <p>
          Hint: {Array.from(word.lemma)[0]}…{word.pos === 'noun' ? ' · Include the article' : ''}
        </p>
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
          {word.en && <p>{word.en}</p>}
        </div>
      ) : (
        <button className="button" onClick={onReveal}>
          {production ? 'Show answer' : 'Show translation'}
        </button>
      )}
    </article>
  );
}
