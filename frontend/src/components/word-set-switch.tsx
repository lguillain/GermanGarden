import { useReviewMode } from '../hooks/use-review-mode';
import { useScope } from '../hooks/use-scope';
import { PlantIcon, SeedIcon } from './garden-artwork';
import { SegmentedLinks } from './segmented-links';

export function WordSetSwitch({ counts }: { counts?: { plants: number; seeds: number } }) {
  const { scope, topic } = useScope();
  const { articles, mode } = useReviewMode();
  const destination = articles ? '/articles' : '/review';
  const link = (params: Record<string, string>) => `${destination}?${new URLSearchParams(params)}`;
  return (
    <SegmentedLinks
      label="Word set"
      links={[
        {
          key: 'plants',
          to: link({ scope: topic ? 'topic' : 'all', topic, mode }),
          active: scope !== 'bag',
          children: (
            <>
              <span aria-hidden="true">
                <PlantIcon />
              </span>
              Plants
            </>
          ),
          count: counts?.plants,
        },
        {
          key: 'seeds',
          to: link({ scope: 'bag', topic, mode: articles ? 'article' : 'recognition' }),
          active: scope === 'bag',
          children: (
            <>
              <span aria-hidden="true">
                <SeedIcon />
              </span>
              Seeds
            </>
          ),
          count: counts?.seeds,
        },
      ]}
    />
  );
}
