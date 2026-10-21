import { PracticeActivityCard } from './practice-activity-card';
import type { ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { Session } from '../../api';
import { useScope } from '../../hooks/use-scope';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
export function AiPracticeLayout({
  title,
  result,
  wordCount,
  children,
}: {
  title: string;
  result: { isPending: boolean; error: unknown };
  wordCount: number;
  children: ReactNode;
}) {
  const { scope, query, label } = useScope();
  const aiAvailable = useOutletContext<Session | undefined>()?.ai_available;
  return (
    <>
      <Link className="back" to={`/practice${query}`}>
        ← Practice
      </Link>
      <Heading title={title}>{scope === 'all' ? undefined : label}</Heading>
      {aiAvailable === false ? (
        <Empty>AI practice is not configured yet. Ask the garden owner to enable it.</Empty>
      ) : aiAvailable === undefined || result.isPending ? (
        <Loading />
      ) : result.error ? (
        <ErrorNotice error={result.error} />
      ) : !wordCount ? (
        <Empty>
          No words in this practice set yet. <Link to="/matcher">Find words</Link>.
        </Empty>
      ) : (
        <PracticeActivityCard title={<h2>{title}</h2>}>{children}</PracticeActivityCard>
      )}
    </>
  );
}
