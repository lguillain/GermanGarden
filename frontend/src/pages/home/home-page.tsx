import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { gardenQuery } from '../../queries/garden-query';
import { ErrorNotice, Heading, Loading } from '../../components/feedback';
import GardenScene from './garden-scene';
import { UpcomingReviews } from './upcoming-reviews';
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
      </div>
      <ErrorNotice error={result.error} />
      {result.isPending && <Loading />}
      <section className="garden-dashboard" aria-label="Learning progress">
        <div className="panel garden-total">
          <dl>
            <div>
              <dt>Total words planted</dt>
              <dd>{summary?.planted_total ?? '—'}</dd>
            </div>
          </dl>
        </div>
        <div className="panel garden-review-card">
          <div className="garden-review-stats">
            <dl className="garden-due-today">
              <div>
                <dt>Reviews due today</dt>
                <dd>{summary?.due_today ?? '—'}</dd>
              </div>
            </dl>
            <div className="garden-review-action">
              {summary && summary.due_now > 0 ? (
                <Link className="button primary" to="/review">
                  Review words <span className="action-count">{summary.due_now} due</span>
                </Link>
              ) : (
                <dl>
                  <div>
                    <dt>Words due</dt>
                    <dd>{summary ? 0 : '—'}</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
          <div className="garden-card-action">
            {summary && <UpcomingReviews summary={summary} />}
          </div>
        </div>
        <div className="panel garden-discovery-card">
          <dl className="garden-found-today">
            <div>
              <dt>Words found today</dt>
              <dd>{summary?.found_today ?? '—'}</dd>
            </div>
          </dl>
          <div className="garden-card-action">
            <Link className={`button${active ? '' : ' primary'}`} to="/matcher">
              Find new words
            </Link>
          </div>
        </div>
      </section>
      {garden && summary && (
        <div className="garden-scene-layout">
          <GardenScene
            plots={garden.plots}
            bagCount={garden.bag.length}
            bagContent={<SeedBag words={garden.bag} />}
          />
        </div>
      )}
    </div>
  );
}
