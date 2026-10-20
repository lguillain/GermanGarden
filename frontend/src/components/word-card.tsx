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
}: {
  word: Word;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <article className="panel word-card">
      <div className="word-meta">
        {word.level} <span>·</span> {word.pos}
      </div>
      <h2>
        <WordTitle word={word} showArticle={revealed} />
      </h2>
      {word.plural && (
        <p className="muted" lang="de">
          Plural: {word.plural}
        </p>
      )}
      {word.de && (
        <p className="sentence" lang="de">
          {word.de}
        </p>
      )}
      {revealed ? (
        <div className="translation">
          <strong>{word.english}</strong>
          {word.en && <p>{word.en}</p>}
        </div>
      ) : (
        <button className="button" onClick={onReveal}>
          Show translation
        </button>
      )}
    </article>
  );
}
