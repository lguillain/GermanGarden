import type { ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { Session } from '../../api';
import { useScope } from '../../hooks/use-scope';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
export function AiPracticeLayout({
  title,
  result,
  wordCount,
  grammar,
  children,
}: {
  title: string;
  result: { isPending: boolean; error: unknown };
  wordCount: number;
  grammar: boolean;
  children: ReactNode;
}) {
  const { scope, query, label } = useScope();
  const { ai_available } = useOutletContext<Session>();
  return (
    <>
      <Link className="back" to={`/practice${query}`}>
        ← Practice
      </Link>
      <Heading title={title}>{scope === 'all' ? undefined : label}</Heading>
      {!ai_available ? (
        <Empty>AI practice is not configured yet. Ask the garden owner to enable it.</Empty>
      ) : result.isPending ? (
        <Loading />
      ) : result.error ? (
        <ErrorNotice error={result.error} />
      ) : !wordCount ? (
        <Empty>
          No words in this practice set yet. <Link to="/matcher">Find words</Link>.
        </Empty>
      ) : (
        <div className={`study wide${grammar ? ' grammar-study' : ' ai-study'}`}>{children}</div>
      )}
    </>
  );
}
