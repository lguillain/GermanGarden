import { type ReactNode, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GardenPlot } from '../api';
import { GardenArtwork } from './garden-artwork';

export default function GardenScene({
  plots,
  bagCount = 0,
  bagContent,
  showBag = true,
  topicHref = (topic) => `/topics/${encodeURIComponent(topic)}`,
  instruction,
}: {
  topicHref?: (topic: string) => string;
  instruction?: string;
  plots: GardenPlot[];
  bagCount?: number;
  bagContent?: ReactNode;
  showBag?: boolean;
}) {
  const id = `garden-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const navigate = useNavigate();
  const [bagOpen, setBagOpen] = useState(false);
  return (
    <section className="garden-world" aria-label="Growing garden">
      {!!plots.length && instruction && (
        <div className="world-bottom">
          <span>{instruction}</span>
        </div>
      )}
      <GardenArtwork
        plots={plots}
        focused={false}
        selectedWord={null}
        onPickWord={() => {}}
        onPickPlot={(topic) => navigate(topicHref(topic))}
        id={id}
        bagCount={bagCount}
        bagOpen={bagOpen}
        onPickBag={showBag ? () => setBagOpen((open) => !open) : undefined}
      />
      {!!plots.length && (
        <nav className="mobile-garden-topics" aria-label="Garden topics">
          {plots.map((plot) => (
            <Link className="button" key={plot.id} to={topicHref(plot.id)}>
              {plot.name}
            </Link>
          ))}
        </nav>
      )}
      {showBag && (
        <button
          className="mobile-bag-button"
          aria-expanded={bagOpen}
          onClick={() => setBagOpen((open) => !open)}
        >
          {bagOpen ? 'Close seed bag' : `Open seed bag (${bagCount} / 20)`}
        </button>
      )}
      {!plots.length && (
        <div className="world-empty">
          <h2>A little land. A fresh start.</h2>
          <p>Review a seed to start growing.</p>
        </div>
      )}
      {showBag && bagOpen && (
        <div id="world-seed-bag" className="plot-inspector world-seed-bag">
          <button
            className="bag-close"
            aria-label="Close seed bag"
            onClick={() => setBagOpen(false)}
          >
            ×
          </button>
          {bagContent}
        </div>
      )}
    </section>
  );
}
