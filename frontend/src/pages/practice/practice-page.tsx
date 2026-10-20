import { Link, useOutletContext } from 'react-router-dom';
import type { Session } from '../../api';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { WordSetSwitch } from '../../components/word-set-switch';
import { usePracticeSummary } from './use-practice-summary';
import { useScope } from '../../hooks/use-scope';

export function PracticePage() {
  const { scope, query, label } = useScope();
  const { ai_available } = useOutletContext<Session>();
  const result = usePracticeSummary(query);
  const modes = [
    ['flashcards', 'Flashcards', 'Browse your words and reveal their translations.'],
    ['chat', 'Conversation', 'Practise your words in a short German conversation.'],
    ['read', 'Reading', 'Read a short passage written around your vocabulary.'],
    ['grammar', 'Grammar playground', 'Explore word forms and get feedback on your own sentences.'],
  ];
  return (
    <>
      <div className="practice-heading-row">
        <Heading title="Practice">{scope === 'topic' ? label : undefined}</Heading>
        <WordSetSwitch page="/practice" counts={result.data?.counts} />
      </div>
      {result.isPending ? (
        <Loading />
      ) : result.error ? (
        <ErrorNotice error={result.error} />
      ) : !result.data?.word_count ? (
        <Empty>
          No words in this set yet. <Link to="/matcher">Find new words</Link> or practise your{' '}
          <Link to="/practice?scope=bag">seed bag</Link>.
        </Empty>
      ) : (
        <div className="practice-grid">
          {modes.map(([path, title, description]) => (
            <article className="panel" key={path}>
              <h2>{title}</h2>
              <p className="muted">{description}</p>
              {path === 'flashcards' || ai_available ? (
                <Link className="button" to={`/practice/${path}${query}`}>
                  Start {title.toLowerCase()} →
                </Link>
              ) : (
                <p className="muted small">Needs ANTHROPIC_API_KEY in your local .env file.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
