import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { gardenQuery } from '../../queries/garden-query';
import { ErrorNotice, Heading, Loading } from '../../components/feedback';
import GardenScene from './garden-scene';
import { SeedBag } from '../../components/seed-bag';

export function HomePage() {
  const result = useQuery(gardenQuery());
  const garden = result.data;
  const summary = garden?.summary;
  const active = !summary || summary.planted_total > 0;
  return (
    <div className="garden-home">
      <div className="garden-intro">
        <Heading title="Your garden" />
        <div className="garden-actions">
          {active && (
            <Link className="button primary" to="/review">
              Review words
              {summary && summary.due_now > 0 && (
                <span className="action-count">{summary.due_now} due</span>
              )}
            </Link>
          )}
          <Link className={`button${active ? '' : ' primary'}`} to="/matcher">
            Find new words
          </Link>
        </div>
      </div>
      <ErrorNotice error={result.error} />
      {result.isPending && <Loading />}
      {garden && summary && (
        <>
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
            </dl>
          </section>
          <GardenScene
            plots={garden.plots}
            bagCount={garden.bag.length}
            bagContent={<SeedBag words={garden.bag} />}
          />
        </>
      )}
    </div>
  );
}
