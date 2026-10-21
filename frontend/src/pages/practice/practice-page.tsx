import { PracticeModeCards } from './practice-mode-cards';
import { WeakPractice } from './weak-practice';
import { Link, useOutletContext } from 'react-router-dom';
import type { Session } from '../../api';
import { Empty, ErrorNotice, Heading, Loading } from '../../components/feedback';
import { usePracticeSummary } from './use-practice-summary';
import { useQuery } from '@tanstack/react-query';
import { gardenQuery } from '../../queries/garden-query';
import GardenScene from '../../components/garden-scene';
import { SeedBag } from '../../components/seed-bag';
import { useScope } from '../../hooks/use-scope';

export function PracticePage() {
  const { scope, topic, query, label } = useScope();
  const aiAvailable = useOutletContext<Session | undefined>()?.ai_available;
  const result = usePracticeSummary(query);
  const overview = (
    <>
      <div className="practice-heading-row">
        <Heading title="Practice">{scope !== 'all' ? label : undefined}</Heading>
      </div>
      {result.isPending && <Loading />}
      <ErrorNotice error={result.error} />
      {result.data?.word_count === 0 && (
        <Empty>
          No words in this set yet. <Link to="/matcher">Find new words</Link> or practise your{' '}
          <Link to="/practice?scope=bag">seed bag</Link>.
        </Empty>
      )}
    </>
  );
  return (
    <>
      {scope !== 'all' && overview}
      {scope === 'all' && (
        <WeakPractice scope={scope} topic={topic} query={query} overview={overview}>
          <TopicPracticeGarden />
        </WeakPractice>
      )}
      {scope === 'topic' && (
        <Link className="back" to="/practice">
          ← All practice
        </Link>
      )}
      {scope !== 'all' && (
        <>
          <PracticeModeCards query={query} aiAvailable={aiAvailable} />
          {aiAvailable === false && (
            <p className="muted small">Reading and conversation need AI practice enabled.</p>
          )}
        </>
      )}
    </>
  );
}

function TopicPracticeGarden() {
  const result = useQuery(gardenQuery());
  return (
    <section aria-label="Topic practice">
      <h2>Topic practice</h2>
      <ErrorNotice error={result.error} />
      {result.isPending && <Loading />}
      {result.data && (
        <GardenScene
          plots={result.data.plots}
          bagCount={result.data.bag.length}
          showBag={result.data.bag.length > 0}
          bagContent={<SeedBag words={result.data.bag} />}
          instruction="Choose a topic to practise"
          topicHref={(topic) => `/practice?${new URLSearchParams({ scope: 'topic', topic })}`}
        />
      )}
    </section>
  );
}
