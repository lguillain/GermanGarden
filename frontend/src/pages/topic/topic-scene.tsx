import { useId, useState } from 'react';
import type { GardenPlot } from '../../api';
import { GardenArtwork, wordName, plantLabel } from '../../components/garden-artwork';

export function TopicScene({ plot }: { plot: GardenPlot }) {
  const id = `topic-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [wordId, setWordId] = useState<string | null>(null);
  const word = plot.words.find((item) => item.id === wordId);
  return (
    <section className="topic-scene" aria-label={`${plot.name} garden plot`}>
      <GardenArtwork
        plots={[plot]}
        focused
        selectedWord={wordId}
        onPickWord={setWordId}
        onPickPlot={() => {}}
        id={id}
      />
      <div className="topic-plant-caption" aria-live="polite">
        {word ? (
          <>
            <strong lang="de">{wordName(word)}</strong>
            <span>
              {word.english} · {plantLabel(word)}
            </span>
          </>
        ) : (
          <span>
            {plot.words.length
              ? 'Select a plant to see its word'
              : 'No planted or learned words in this topic yet'}
          </span>
        )}
      </div>
    </section>
  );
}
