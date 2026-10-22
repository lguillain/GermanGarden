import { useId, useState } from 'react';
import type { GardenPlot } from '../../api';
import { GardenArtwork, plantLabel, wordName } from '../../components/garden-artwork';

const demoNow = Date.parse('2026-10-22T12:00:00Z');

const demoPlot: GardenPlot = {
  id: 'gnome-demo-everyday',
  name: 'Everyday life',
  words: [
    {
      id: 'demo-1',
      lemma: 'Baum',
      article: 'der',
      english: 'tree',
      pos: 'noun',
      level: 'A1',
      growth: 5,
      learned: true,
      production_unlocked: true,
      production_growth: 5,
    },
    {
      id: 'demo-2',
      lemma: 'Blume',
      article: 'die',
      english: 'flower',
      pos: 'noun',
      level: 'A1',
      growth: 4,
      production_unlocked: true,
      production_growth: 3,
    },
    {
      id: 'demo-3',
      lemma: 'Garten',
      article: 'der',
      english: 'garden',
      pos: 'noun',
      level: 'A1',
      growth: 3,
      production_unlocked: true,
      production_growth: 0,
    },
    {
      id: 'demo-4',
      lemma: 'Wasser',
      article: 'das',
      english: 'water',
      pos: 'noun',
      level: 'A1',
      growth: 2,
    },
    {
      id: 'demo-5',
      lemma: 'Haus',
      article: 'das',
      english: 'house',
      pos: 'noun',
      level: 'A1',
      growth: 1,
    },
    { id: 'demo-6', lemma: 'wachsen', english: 'to grow', pos: 'verb', level: 'A2', growth: 0 },
    {
      id: 'demo-7',
      lemma: 'Sonne',
      article: 'die',
      english: 'sun',
      pos: 'noun',
      level: 'A1',
      growth: 5,
      production_unlocked: true,
      production_growth: 5,
    },
  ],
};

const stages = [
  {
    label: 'Just due',
    count: 0,
    title: 'A little tending',
    copy: 'The plants are ready for review. No gnomes yet.',
  },
  {
    label: '12 hours overdue',
    count: 1,
    title: 'An uninvited guest',
    copy: 'Twelve hours later, the first gnome has found a quiet corner.',
  },
  ...[1, 2, 3, 4, 5, 7].map((days) => ({
    label: `${days} ${days === 1 ? 'day' : 'days'} overdue`,
    count: 1 + Math.min(days, 5),
    title: days < 5 ? 'Word is getting around' : 'They’ve made themselves at home',
    copy:
      days < 5
        ? `${1 + days} gnomes have gathered. Another arrives each day through day five.`
        : 'Six gnomes have settled in. The crowd stops growing after day five.',
  })),
];

export function GnomeConcept() {
  const id = `gnome-demo-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [stage, setStage] = useState(7);
  const [cast, setCast] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const current = stages[stage];
  const count = reviewed ? 0 : current.count;
  const plot: GardenPlot = {
    ...demoPlot,
    id: `${demoPlot.id}-${cast}`,
    words: demoPlot.words.map((word) => ({
      ...word,
      review_due: !reviewed && !word.learned,
      overdue_since:
        reviewed || word.learned
          ? null
          : new Date(
              demoNow -
                (stage === 0 ? 0 : stage === 1 ? 12 : [24, 48, 72, 96, 120, 168][stage - 2]) *
                  3_600_000,
            ).toISOString(),
    })),
  };
  const selected = plot.words.find((word) => word.id === selectedWord);
  return (
    <div className="gnome-concept">
      <div className="gnome-controls" role="group" aria-label="Preview review age">
        {stages.map(({ label }, index) => (
          <button
            key={label}
            aria-pressed={!reviewed && stage === index}
            onClick={() => {
              setStage(index);
              setReviewed(false);
            }}
          >
            {label}
          </button>
        ))}
        <button onClick={() => setCast((value) => value + 1)}>Shuffle gnomes</button>
      </div>
      <div className="gnome-scene">
        <GardenArtwork
          plots={[plot]}
          now={demoNow}
          focused
          selectedWord={selectedWord}
          onPickWord={setSelectedWord}
          onPickPlot={() => {}}
          id={id}
        />
        {count > 0 && (
          <p className="gnome-whisper">
            {count === 1 ? '“Nobody tending this bit? Excellent.”' : '“We live here now.”'}
          </p>
        )}
      </div>
      <p className="small muted" aria-live="polite">
        {selected
          ? `${wordName(selected)} · ${selected.english} · ${plantLabel(selected)}${selected.learned ? ' · Learned' : ''}`
          : 'Everyday life · Select a plant to explore the sample words.'}
      </p>
      <div className="gnome-caption">
        <div aria-live="polite">
          <h3>{reviewed ? 'The gnomes have moved along' : current.title}</h3>
          <p>
            {reviewed
              ? 'With these reviews no longer overdue, the patch is quiet again.'
              : current.copy}
          </p>
        </div>
        <button className="secondary" disabled={reviewed} onClick={() => setReviewed(true)}>
          {reviewed ? 'After-review preview' : 'Preview after review'}
        </button>
      </div>
      <p className="small muted">
        Design exploration · One gnome after 12 hours, then one more each day through day five (six
        maximum). Gnomes reflect how long reviews have been overdue, not difficult words or practice
        activity. They never remove words or reduce growth. Learned words never attract them.
      </p>
    </div>
  );
}
