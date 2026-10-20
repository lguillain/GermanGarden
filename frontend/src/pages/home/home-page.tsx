import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { Garden } from '../../api';
import { api } from '../../api';
import { ErrorNotice, Heading, Loading } from '../../components/feedback';
import GardenScene from './garden-scene';
import { SeedBag } from '../../components/seed-bag';

const duration = (seconds: number) =>
  seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    : seconds >= 60
      ? `${Math.floor(seconds / 60)}m`
      : `${seconds}s`;

export function HomePage() {
  const result = useQuery({ queryKey: ['garden'], queryFn: () => api<Garden>('/garden') });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorNotice error={result.error} />;
  const { summary, bag, plots } = result.data!;
  const active = summary.planted_total > 0;
  return (
    <div className="garden-home">
      <div className="garden-intro">
        <Heading title="Your garden" />
        <div className="garden-actions">
          {active && (
            <Link className="button primary" to="/review">
              Review words
              {summary.due_now > 0 && <span className="action-count">{summary.due_now} due</span>}
            </Link>
          )}
          <Link className={`button${active ? '' : ' primary'}`} to="/matcher">
            Find new words
          </Link>
        </div>
      </div>
      <section className="panel garden-progress" aria-label="Learning progress">
        <dl className="progress-totals">
          <div>
            <dt>Words planted</dt>
            <dd>{summary.planted_total}</dd>
          </div>
          <div>
            <dt>Reviews due</dt>
            <dd>{summary.due_now}</dd>
          </div>
          <div>
            <dt>Time today</dt>
            <dd>{duration(summary.time.today_seconds)}</dd>
          </div>
          <div>
            <dt>Total time</dt>
            <dd>{duration(summary.time.total_seconds)}</dd>
          </div>
        </dl>
      </section>
      <GardenScene plots={plots} bagCount={bag.length} bagContent={<SeedBag words={bag} />} />
    </div>
  );
}
