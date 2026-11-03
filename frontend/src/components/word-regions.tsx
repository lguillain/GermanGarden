import type { Word } from '../api';

const labels = { DE: 'Germany', AT: 'Austria', CH: 'Switzerland' };

export function WordRegions({ word }: { word: Word }) {
  const regions = word.regions?.filter((region) => region in labels);
  if (!regions?.length) return null;
  return (
    <span
      className="word-regions"
      aria-label={`Regional usage: ${regions.map((r) => labels[r]).join(', ')}`}
    >
      {regions.map((region) => (
        <span className="word-region" key={region} title={`Regional usage: ${labels[region]}`}>
          {labels[region]}
        </span>
      ))}
    </span>
  );
}
