import { useState } from 'react';
import { SeedBagButton } from '../home/seed-bag-dialog';
import { UpcomingReviewsButton } from '../home/upcoming-reviews';
import type { DashboardIllustrationKind } from '../home/dashboard-illustration';
import { DashboardCard, PlantedCount } from '../home/dashboard-card';

const cards: {
  kind: DashboardIllustrationKind;
  title: string;
  count: number;
  detail: string;
  action?: string;
}[] = [
  {
    kind: 'watering',
    title: 'A little tending',
    count: 2,
    detail: 'words due now',
    action: 'Review 2 words',
  },
  {
    kind: 'seeds',
    title: 'Fresh finds',
    count: 0,
    detail: 'found today',
    action: 'Find new words',
  },
  {
    kind: 'support',
    title: 'Extra care',
    count: 4,
    detail: 'words to practise',
    action: 'Practise these words',
  },
];

export function DashboardConcept() {
  const [notice, setNotice] = useState(
    'Sample counts · Compact SVG garden scenes, drawn in perspective.',
  );
  return (
    <>
      <header className="dashboard-concept-heading">
        <h3>Your garden</h3>
        <PlantedCount count={19} />
      </header>
      <div className="garden-dashboard">
        {cards.map(({ kind, title, count, detail, action }) => (
          <DashboardCard
            kind={kind}
            title={title}
            count={count}
            detail={detail}
            inlineDetail={kind === 'watering'}
            key={kind}
          >
            {action && (
              <>
                <button
                  className="primary"
                  onClick={() => setNotice(`${action} — preview only; your garden is unchanged.`)}
                >
                  {action}
                </button>
                {kind === 'seeds' && (
                  <SeedBagButton
                    count={3}
                    onClick={() =>
                      setNotice(
                        'Seed bag — opens your kept words with Practice and Plant actions. Preview only.',
                      )
                    }
                  />
                )}
                {kind === 'watering' && (
                  <div className="garden-dashboard-forecast">
                    <UpcomingReviewsButton
                      onClick={() =>
                        setNotice('Upcoming reviews — this concept uses sample counts only.')
                      }
                    />
                    <span className="garden-dashboard-note">13 more due today</span>
                  </div>
                )}
              </>
            )}
          </DashboardCard>
        ))}
      </div>
      <p className="small muted" role="status">
        {notice}
      </p>
    </>
  );
}
