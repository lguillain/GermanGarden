import { PlantIcon } from './garden-artwork';
import { FormsButton } from './forms-button';
import { type ReactNode, useState } from 'react';
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
    <p lang="de" aria-label="Word hint">
      {Array.from(lemma)
        .map((letter, index) => (index === 0 || !/\p{L}/u.test(letter) ? letter : '_'))
        .join(' ')}
    </p>
  ) : (
    <button className="button" onClick={() => setVisible(true)}>
      Hint
    </button>
  );
}

interface WordCardProps {
  word: Word;
  revealed: boolean;
  onReveal: () => void;
  direction?: 'recognition' | 'production';
  showDirection?: boolean;
  forms?: 'practice' | 'review';
  revealControls?: ReactNode;
  articlePrompt?: boolean;
  promptControls?: ReactNode;
  hintsEnabled?: boolean;
}

export function WordCard(props: WordCardProps) {
  return (
    <WordCardContent
      key={`${props.word.id}:${props.direction || props.word.track || 'recognition'}`}
      {...props}
    />
  );
}

function WordCardContent({
  word,
  revealed,
  onReveal,
  direction,
  showDirection = true,
  forms,
  revealControls,
  articlePrompt = false,
  promptControls,
  hintsEnabled = true,
}: WordCardProps) {
  const [sentenceHint, setSentenceHint] = useState(false);
  const production = (direction || word.track) === 'production';
  return (
    <article className="panel word-card">
      <div className="word-card-header">
        <div className="word-card-context">
          {forms && <PlantIcon word={word} />}
          <div className="word-meta">
            {word.level} <span>·</span> {word.pos}
          </div>
        </div>
        {showDirection && (direction || word.track) && (
          <span className="review-direction">{production ? 'EN → DE' : 'DE → EN'}</span>
        )}
      </div>
      <div className="word-card-body">
        <div
          className={`word-card-face${revealed ? ' concealed' : ''}`}
          aria-hidden={revealed || undefined}
        >
          <h2>
            {production ? (
              word.english
            ) : (
              <>
                {articlePrompt && (
                  <span className="article-blank" aria-label="Missing article">
                    ___{' '}
                  </span>
                )}
                <WordTitle word={word} showArticle={false} />
              </>
            )}
          </h2>
          {promptControls && <div className="word-card-prompt-controls">{promptControls}</div>}
          <div className="word-card-detail">
            {production && word.pos === 'noun' && (
              <p className="word-detail muted">Include the article</p>
            )}
          </div>
          {production
            ? word.en && (
                <p className="sentence" lang="en">
                  {word.en}
                </p>
              )
            : word.de && (
                <p
                  className={`sentence${sentenceHint ? '' : ' concealed'}`}
                  lang="de"
                  aria-hidden={!sentenceHint || undefined}
                >
                  {word.de}
                </p>
              )}
        </div>
        <div
          className={`word-card-face${revealed ? '' : ' concealed'}`}
          aria-hidden={!revealed || undefined}
        >
          <h2>
            <WordTitle word={word} />
          </h2>
          <div className="word-card-detail">
            {word.plural && (
              <p className="word-detail muted" lang="de">
                Plural: {word.plural}
              </p>
            )}
          </div>
          {word.de && (
            <p className="sentence" lang="de">
              {word.de}
            </p>
          )}
          <div className="translation answer-context" lang="en">
            <strong>{word.english}</strong>
            {word.en && <p>{word.en}</p>}
          </div>
        </div>
      </div>
      <div className="word-card-footer">
        <div className="word-card-controls">
          <div
            className={`actions${revealed ? ' concealed' : ''}`}
            aria-hidden={revealed || undefined}
          >
            {revealControls ?? (
              <button className="button" onClick={onReveal}>
                {production ? 'Show answer' : 'Show translation'}
              </button>
            )}
            {hintsEnabled && !production && word.de && !sentenceHint && (
              <button className="button" onClick={() => setSentenceHint(true)}>
                Hint
              </button>
            )}
            {hintsEnabled && production && <ProductionHint key={word.id} lemma={word.lemma} />}
          </div>
        </div>
        {(forms === 'practice' || (forms === 'review' && revealed)) && (
          <FormsButton key={word.id} word={word} />
        )}
      </div>
    </article>
  );
}
