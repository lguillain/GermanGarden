import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { Link } from 'react-router-dom';
import { gardenQuery } from '../../queries/garden-query';
import { ErrorNotice, Heading, Loading } from '../../components/feedback';
import GardenScene from '../../components/garden-scene';
import { gardenGnomeCount } from '../../components/garden-gnome-count';
import { GnomeReviewIcon } from '../../components/gnome-review-icon';
import { useGardenTime } from '../../hooks/use-garden-time';
import { DashboardCard, PlantedCount } from './dashboard-card';
import { UpcomingReviews } from './upcoming-reviews';
import { SeedBagDialog } from './seed-bag-dialog';
import { weakWordsQuery } from '../../queries/weak-words-query';

export function HomePage() {
  const result = useQuery(gardenQuery());
  const cache = useQueryClient();
  const levelUp = useMutation({
    mutationFn: (currentLevel: string) => api('/level-up', { current_level: currentLevel }),
    onSuccess: () => cache.invalidateQueries(),
  });
  const hardWords = useQuery({
    ...weakWordsQuery(),
    refetchInterval: 60_000,
  });
  const hardWordCount = hardWords.data?.words.length;
  const garden = result.data;
  const now = useGardenTime();
  const gnomeCount =
    garden?.plots.reduce((total, plot) => total + gardenGnomeCount(plot.words, now), 0) ?? 0;
  const summary = garden?.summary;
  const highlightDiscovery = summary?.found_today === 0;
  return (
    <>
      <Heading
        title="Your garden"
        titleDetail={<PlantedCount count={summary?.planted_total} />}
        actions={
          garden?.level_up && (
            <section className="garden-level-up" aria-label="Level up">
              <div>
                <strong>Ready for {garden.level_up.next_level}?</strong>
                <p className="muted">
                  {garden.level_up.all_learned
                    ? `You've learned every ${garden.level_up.current_level} word!`
                    : `You've explored every ${garden.level_up.current_level} word in the seed bank.`}
                </p>
              </div>
              <button
                className="primary"
                disabled={levelUp.isPending}
                onClick={() => levelUp.mutate(garden.level_up!.current_level)}
              >
                {levelUp.isPending ? 'Moving up…' : `Level up to ${garden.level_up.next_level}`}
              </button>
              <ErrorNotice error={levelUp.error} />
            </section>
          )
        }
      />
      <div className="garden-home">
        <ErrorNotice error={result.error} />
        {result.isPending && <Loading />}
        <section className="garden-dashboard" aria-label="Learning progress">
          <DashboardCard
            title="A little tending"
            kind="watering"
            count={summary?.due_now}
            detail={summary?.due_now === 1 ? 'word due now' : 'words due now'}
            inlineDetail
          >
            {summary && summary.due_now > 0 && (
              <Link className="button primary" to="/review">
                {gnomeCount > 0 && <GnomeReviewIcon />}
                Review {summary.due_now} {summary.due_now === 1 ? 'word' : 'words'}
              </Link>
            )}
            <div className="garden-dashboard-forecast">
              {summary && <UpcomingReviews summary={summary} />}
              <span className="garden-dashboard-note">
                {summary?.due_today !== undefined
                  ? `${Math.max(0, summary.due_today - summary.due_now)} more due today`
                  : '— more due today'}
              </span>
            </div>
          </DashboardCard>
          <DashboardCard
            title="Fresh finds"
            kind="seeds"
            count={summary?.found_today}
            detail="found today"
          >
            <Link className={`button${highlightDiscovery ? ' primary' : ''}`} to="/matcher">
              Find new words
            </Link>
            <SeedBagDialog words={garden?.bag} />
          </DashboardCard>
          <DashboardCard
            title="Extra care"
            kind="support"
            count={hardWordCount}
            detail="words to practise"
          >
            {hardWordCount !== undefined && hardWordCount > 0 && (
              <Link className="button primary" to="/practice">
                Practice hard words
              </Link>
            )}
            <ErrorNotice error={hardWords.error} />
          </DashboardCard>
        </section>
        {garden && summary && (
          <div className="garden-scene-layout">
            <GardenScene plots={garden.plots} showBag={false} />
          </div>
        )}
      </div>
    </>
  );
}
