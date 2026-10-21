import { Link } from 'react-router-dom';

export type PracticeMode = 'flashcards' | 'chat' | 'read';
const modes: { mode: PracticeMode; title: string; description: string }[] = [
  { mode: 'flashcards', title: 'Flashcards', description: 'Flip cards and explore word forms.' },
  { mode: 'chat', title: 'Conversation', description: 'Use your words in a German conversation.' },
  { mode: 'read', title: 'Reading', description: 'Read a short passage using your words.' },
];

type Props = { aiAvailable?: boolean; includeFlashcards?: boolean } & (
  { query: string; onSelect?: never } | { query?: never; onSelect: (mode: PracticeMode) => void }
);

export function PracticeModeCards({
  aiAvailable,
  query,
  onSelect,
  includeFlashcards = true,
}: Props) {
  return (
    <section
      className={`practice-grid${includeFlashcards ? '' : ' practice-grid-activities'}`}
      aria-label="Practice modes"
    >
      {modes
        .filter(({ mode }) => includeFlashcards || mode !== 'flashcards')
        .map(({ mode, title, description }) => (
          <article className="panel" key={mode}>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
            {onSelect ? (
              <button
                disabled={mode !== 'flashcards' && aiAvailable !== true}
                onClick={() => onSelect(mode)}
              >
                {title}
              </button>
            ) : mode === 'flashcards' || aiAvailable !== false ? (
              <Link className="button" to={`/practice/${mode}${query}`}>
                {title}
              </Link>
            ) : (
              <button disabled>{title}</button>
            )}
          </article>
        ))}
    </section>
  );
}
