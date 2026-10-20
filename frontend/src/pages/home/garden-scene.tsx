import { type ReactNode, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GardenPlot } from '../../api';
import { GardenArtwork } from '../../components/garden-artwork';

export default function GardenScene({
  plots,
  bagCount = 0,
  bagContent,
}: {
  plots: GardenPlot[];
  bagCount?: number;
  bagContent?: ReactNode;
}) {
  const id = `garden-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const navigate = useNavigate();
  const [bagOpen, setBagOpen] = useState(false);
  return (
    <section className="garden-world" aria-label="Growing garden">
      {!!plots.length && (
        <div className="world-bottom">
          <span>Select a field to look closer</span>
        </div>
      )}
      <GardenArtwork
        plots={plots}
        focused={false}
        selectedWord={null}
        onPickWord={() => {}}
        onPickPlot={(topic) => navigate(`/topics/${encodeURIComponent(topic)}`)}
        id={id}
        bagCount={bagCount}
        bagOpen={bagOpen}
        onPickBag={() => setBagOpen((open) => !open)}
      />
      {!!plots.length && (
        <nav className="mobile-garden-topics" aria-label="Garden topics">
          {plots.map((plot) => (
            <Link className="button" key={plot.id} to={`/topics/${encodeURIComponent(plot.id)}`}>
              {plot.name}
            </Link>
          ))}
        </nav>
      )}
      <button
        className="mobile-bag-button"
        aria-expanded={bagOpen}
        onClick={() => setBagOpen((open) => !open)}
      >
        {bagOpen ? 'Close seed bag' : `Open seed bag (${bagCount} / 20)`}
      </button>
      {!plots.length && (
        <div className="world-empty">
          <h2>A little land. A fresh start.</h2>
          <p>Review a seed to start growing.</p>
        </div>
      )}
      {bagOpen && (
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
