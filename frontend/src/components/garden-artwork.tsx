import { useId, useState } from 'react';
import { useGardenTime } from '../hooks/use-garden-time';
import type { GardenPlot, Word } from '../api';
import { GardenGnomes } from './garden-gnomes';
import { gardenGnomeCount } from './garden-gnome-count';

const growthNames = ['Just planted', 'Sprout', 'Seedling', 'Sapling', 'Blooming', 'Fully grown'];
const LAND =
  'M0 -82 Q7 -82 14 -78 L142 -8 Q156 0 142 8 L14 78 Q0 86 -14 78 L-142 8 Q-156 0 -142 -8 L-14 -78 Q-7 -82 0 -82Z';
const hash = (value: string) =>
  [...value].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 0);
export const wordName = (word: Word) => [word.article, word.lemma].filter(Boolean).join(' ');
const isWilted = (word: Word) => Boolean(word.review_due && !word.learned);
export const plantLabel = (word: Word) =>
  `${growthNames[word.learned ? 5 : word.growth || 0]}${word.production_unlocked ? ` · Production ${word.production_growth || 0}/5` : ' · Production locked'}${isWilted(word) ? ' · Needs review' : ''}`;

function Paints({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-grass`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#b4d77e" />
        <stop offset=".5" stopColor="#91bc67" />
        <stop offset="1" stopColor="#6e9f50" />
      </linearGradient>
      <linearGradient id={`${id}-soil`} x1="0" x2="0" y1="0" y2="1">
        <stop stopColor="#8d6e4c" />
        <stop offset="1" stopColor="#635139" />
      </linearGradient>
      <linearGradient id={`${id}-bed`} x1="0" x2="1" y1="0" y2="1">
        <stop stopColor="#977957" />
        <stop offset="1" stopColor="#ba9467" />
      </linearGradient>
      <linearGradient id={`${id}-trunk`}>
        <stop stopColor="#a7834f" />
        <stop offset=".4" stopColor="#bd9b61" />
        <stop offset="1" stopColor="#795a38" />
      </linearGradient>
      <radialGradient id={`${id}-leaf`} cx=".3" cy=".2" r=".85">
        <stop stopColor="#b1d77b" />
        <stop offset=".4" stopColor="#6ea45b" />
        <stop offset="1" stopColor="#376e49" />
      </radialGradient>
      <radialGradient id={`${id}-leaf2`} cx=".25" cy=".15" r=".9">
        <stop stopColor="#9fcf8e" />
        <stop offset=".45" stopColor="#5b9d76" />
        <stop offset="1" stopColor="#326453" />
      </radialGradient>
      <radialGradient id={`${id}-leaf3`} cx=".3" cy=".18" r=".9">
        <stop stopColor="#d0db87" />
        <stop offset=".45" stopColor="#8db65f" />
        <stop offset="1" stopColor="#4a7e48" />
      </radialGradient>
      <radialGradient id={`${id}-flower`} cx=".3" cy=".25">
        <stop stopColor="#f7c0b8" />
        <stop offset="1" stopColor="#d68087" />
      </radialGradient>
      <radialGradient id={`${id}-petal`} cx=".35" cy=".2">
        <stop stopColor="#ffe68b" />
        <stop offset=".65" stopColor="#edbd43" />
        <stop offset="1" stopColor="#cf932d" />
      </radialGradient>
      <radialGradient id={`${id}-sunflower-center`} cx=".35" cy=".25">
        <stop stopColor="#997044" />
        <stop offset="1" stopColor="#654329" />
      </radialGradient>
      <radialGradient id={`${id}-ground`}>
        <stop stopColor="#b5cf9d" />
        <stop offset="1" stopColor="#94b994" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-shadow`} x="-50%" y="-100%" width="200%" height="300%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>
  );
}

/** Rounded volume, highlights and cast shadows give a fixed isometric 3D appearance. */
function Plant({ word, id }: { word: Word; id: string }) {
  return (
    <g
      className={isWilted(word) ? 'plant-wilted' : undefined}
      transform={isWilted(word) ? 'skewX(-22) scale(1 .72)' : undefined}
    >
      <PlantArtwork word={word} id={id} />
    </g>
  );
}

function PlantArtwork({ word, id }: { word: Word; id: string }) {
  const stage = Math.max(0, Math.min(5, word.growth || 0));
  const variant = hash(word.id) % 3;
  const paint = `url(#${id}-${['leaf', 'leaf2', 'leaf3'][variant]})`;
  if (word.production_unlocked && !word.learned && stage !== 5) {
    const opening = Math.min(4, word.production_growth || 0) / 4;
    return (
      <g className="production-flower" data-production-growth={word.production_growth || 0}>
        <ellipse cy="2" rx="16" ry="5" fill="#42603b" opacity=".18" />
        <path d="M0 0 Q-3 -22 0 -49" fill="none" stroke="#608148" strokeWidth="3" />
        <path
          d="M0 -15 Q-22 -14 -19 -31 Q-4 -32 0 -15 M0 -28 Q21 -25 19 -42 Q4 -41 0 -28"
          fill={paint}
        />
        <g transform="translate(0 -53)">
          {[-1, 0, 1].map((side) => (
            <ellipse
              key={side}
              cy="-5"
              rx={5 + opening * 2}
              ry="12"
              transform={`rotate(${side * (12 + opening * 46)})`}
              fill={`url(#${id}-petal)`}
              stroke="#d7a33a"
              strokeWidth=".6"
            />
          ))}
          <path d="M-8 0 Q0 9 8 0 L4 7 L-4 7Z" fill={paint} />
        </g>
      </g>
    );
  }
  if (word.learned || stage === 5)
    return (
      <g className="sunflower-plant" transform="scale(.78)">
        <ellipse cx="7" cy="3" rx="18" ry="6" fill="#42603b" opacity=".18" />
        <path
          d="M0 0 Q-4 -23 1 -50"
          fill="none"
          stroke="#568447"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M-1 -19 Q-24 -20 -22 -34 Q-3 -35 -1 -19" fill={`url(#${id}-leaf)`} />
        <path d="M0 -30 Q21 -27 22 -42 Q5 -44 0 -30" fill={`url(#${id}-leaf)`} />
        <path d="M-2 -20 L-17 -30 M1 -31 L17 -39" stroke="#7da45b" strokeWidth="1.3" fill="none" />
        <g transform="translate(1 -56) rotate(-8) scale(1 .9)">
          {Array.from({ length: 12 }, (_, index) => (
            <ellipse
              key={index}
              cy="-17"
              rx="6.5"
              ry="12"
              transform={`rotate(${index * 30})`}
              fill={`url(#${id}-petal)`}
              stroke="#d7a33a"
              strokeWidth=".5"
            />
          ))}
          <circle r="13" fill={`url(#${id}-sunflower-center)`} stroke="#bb8b3e" strokeWidth="2" />
          {[
            [-5, -5],
            [2, -6],
            [7, -1],
            [-7, 2],
            [-1, 0],
            [0, 7],
            [6, 5],
          ].map(([x, y], index) => (
            <circle key={index} cx={x} cy={y} r="1.4" fill="#d4aa63" opacity=".65" />
          ))}
        </g>
      </g>
    );
  if (stage < 2)
    return (
      <g>
        <ellipse cy="2" rx="11" ry="4" fill="#4b5534" opacity=".2" />
        <ellipse cy="0" rx="7" ry="3.2" fill="#765c3f" />
        <path
          d={`M0 0 Q-2 -7 0 ${stage ? -20 : -11}`}
          fill="none"
          stroke="#608148"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <ellipse
          cx="-5"
          cy={stage ? -13 : -7}
          rx={stage ? 8 : 5.5}
          ry={stage ? 4.5 : 3.3}
          transform={`rotate(30 -5 ${stage ? -13 : -7})`}
          fill={paint}
        />
        <ellipse
          cx="5"
          cy={stage ? -19 : -11}
          rx={stage ? 8 : 5.5}
          ry={stage ? 4.5 : 3.3}
          transform={`rotate(-30 5 ${stage ? -19 : -11})`}
          fill={paint}
        />
      </g>
    );
  if (stage === 2 || stage === 3)
    return (
      <g>
        <ellipse cx="3" cy="2" rx="15" ry="4.5" fill="#42603b" opacity=".18" />
        <path
          d={stage === 2 ? 'M0 0 Q-2 -10 0 -19 Q2 -26 0 -33' : 'M0 0 Q-3 -18 0 -31 Q2 -40 0 -47'}
          fill="none"
          stroke="#608148"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <g transform={stage === 2 ? 'translate(0 14)' : undefined}>
          <g fill={paint}>
            {stage === 2 && <path d="M0 -23 Q-13 -19 -17 -31 Q-5 -34 0 -23Z" />}
            {stage === 3 && (
              <>
                <path d="M-1 -12 Q-19 -10 -21 -25 Q-6 -27 -1 -12Z" />
                <path d="M-1 -22 Q17 -18 21 -34 Q5 -36 -1 -22Z" />
              </>
            )}
            <path d="M1 -33 Q-14 -31 -16 -44 Q-3 -46 1 -33Z" />
            <path d="M1 -39 Q14 -35 17 -47 Q6 -49 1 -39Z" />
          </g>
          <g fill="none" stroke="#b1d77b" strokeWidth="1" strokeLinecap="round" opacity=".65">
            <path d="M0 -35 L-11 -41 M2 -40 L12 -44" />
            {stage === 2 && <path d="M-1 -24 L-12 -29" />}
            {stage === 3 && <path d="M-2 -14 L-15 -22 M1 -24 L15 -31" />}
          </g>
        </g>
      </g>
    );
  const size = [0.0, 0.0, 0.6, 0.78, 0.92, 1.1][stage];
  return (
    <g transform={`scale(${size})`}>
      <ellipse cx="10" cy="4" rx="22" ry="8" fill="#334e36" opacity=".18" />
      <path d="M-4 1 L-3 -35 Q0 -41 3 -35 L5 1 Q0 4 -4 1" fill={`url(#${id}-trunk)`} />
      <path
        d="M0 -17 L-10 -31 M1 -24 L11 -39"
        stroke="#927140"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="-12" cy="-34" rx="16" ry="17" fill={paint} />
      <ellipse cx="13" cy="-38" rx="16" ry="18" fill={paint} />
      <ellipse
        cx="0"
        cy="-51"
        rx={variant === 1 ? 18 : 22}
        ry={variant === 1 ? 29 : 24}
        fill={paint}
      />
      <ellipse cx="-8" cy="-58" rx="8" ry="9" fill="#dbefaa" opacity=".15" />
      {stage >= 4 &&
        (variant === 1 ? (
          <g fill="#e5b467">
            <circle cx="-15" cy="-36" r="3" />
            <circle cx="12" cy="-45" r="3.5" />
            <circle cx="-3" cy="-58" r="3" />
          </g>
        ) : (
          <g fill={`url(#${id}-flower)`}>
            <circle cx="-16" cy="-37" r="4" />
            <circle cx="12" cy="-50" r="4.5" />
            <circle cx="-4" cy="-63" r="4" />
          </g>
        ))}
    </g>
  );
}

export function SeedIcon() {
  return (
    <svg className="plant-stage-icon" viewBox="0 0 32 32" role="img" aria-label="Seed">
      <title>Seed</title>
      <ellipse cx="17" cy="26" rx="9" ry="3" fill="#775034" opacity=".14" />
      <path
        d="M23 5 C24 12 27 18 22 24 C18 29 10 27 8 22 C4 15 13 8 23 5Z"
        fill="#a87543"
        stroke="#80552f"
        strokeWidth="1"
      />
      <path d="M21 8 C14 12 9 18 12 23 C8 21 8 16 12 12 Q16 9 21 8Z" fill="#d9b27b" />
      <path
        d="M21 9 Q13 17 13 24"
        fill="none"
        stroke="#80552f"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlantIcon({
  word = { id: 'plant', lemma: '', english: '', pos: '', level: '', growth: 1 },
}: {
  word?: Word;
}) {
  const id = `plant-icon-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stage = word.learned ? 5 : Math.max(0, Math.min(5, word.growth || 0));
  const viewBox = stage < 2 && !word.production_unlocked ? '-19 -30 38 38' : '-38 -80 76 88';
  return (
    <svg className="plant-stage-icon" viewBox={viewBox} role="img" aria-label={plantLabel(word)}>
      <title>{plantLabel(word)}</title>
      <Paints id={id} />
      <Plant word={word} id={id} />
    </svg>
  );
}

function Land({ id, empty }: { id: string; empty: boolean }) {
  return (
    <g>
      <ellipse
        cy="38"
        rx="134"
        ry="54"
        fill="#385e45"
        opacity=".17"
        filter={`url(#${id}-shadow)`}
      />
      <path d={LAND} transform="translate(0 22)" fill={`url(#${id}-soil)`} />
      <path d="M-148 0 L0 82 L148 0 L148 22 L0 104 L-148 22Z" fill={`url(#${id}-soil)`} />
      <path d="M0 82 L148 0 L148 22 L0 104Z" fill="#4b4e33" opacity=".16" />
      <path d={LAND} fill={`url(#${id}-grass)`} stroke="#b7d987" strokeWidth="1" />
      <path
        d="M0 -62 L114 0 L0 62 L-114 0Z"
        fill={`url(#${id}-bed)`}
        stroke="#739554"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {[-2, -1, 0, 1, 2].map((n) => (
        <path
          key={n}
          d={`M${-86 + n * 9} ${-n * 5} L${n * 9} ${47 - n * 5}`}
          stroke="#694c32"
          strokeWidth="1"
          opacity=".12"
        />
      ))}
      <g fill="#d4dfb3" opacity=".6">
        <ellipse cx="-114" cy="-9" rx="5" ry="2.5" />
        <ellipse cx="-124" cy="-4" rx="3" ry="1.5" />
        <ellipse cx="76" cy="35" rx="4" ry="2" />
      </g>
      <g stroke="#69964c" strokeWidth="2" strokeLinecap="round">
        <path d="M-69 43 l-2 -5 m2 5 l3 -5 M89 -28 l-2 -5 m2 5 l3 -3 M-45 -53 l-2 -5 m2 5 l3 -3" />
      </g>
      {empty && (
        <g transform="translate(57 2)">
          <ellipse cy="8" rx="12" ry="4" fill="#605f40" opacity=".22" />
          <path d="M-8 -10 L8 -10 L6 7 Q0 11 -7 7Z" fill="#6c9192" />
          <ellipse cy="-10" rx="8" ry="3" fill="#9eb8ad" />
          <path d="M8 -6 Q22 -10 18 -1 L8 4" fill="none" stroke="#628483" strokeWidth="3" />
          <path d="M-7 -3 L-19 -12 L-22 -8 L-8 3Z" fill="#789c96" />
        </g>
      )}
    </g>
  );
}

function Patch({
  plot,
  id,
  focused,
  onPickWord,
  onPickPlot,
  selectedWord,
  now,
}: {
  plot: GardenPlot;
  now: number;
  id: string;
  focused: boolean;
  onPickWord: (id: string) => void;
  onPickPlot: () => void;
  selectedWord: string | null;
}) {
  // Assign grown plants to the backmost isometric slots, with stable IDs
  // keeping placement consistent within each group.
  const grown = (word: Word) => Boolean(word.learned) || (word.growth || 0) >= 5;
  const words = [...plot.words].sort(
    (a, b) => Number(grown(b)) - Number(grown(a)) || a.id.localeCompare(b.id),
  );
  const columns = Math.max(3, Math.ceil(Math.sqrt(words.length)));
  const cell = 96 / columns;
  const scale = Math.min(0.85, cell / 38);
  const slots = words
    .map((_, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = (col + 0.5) * cell - 48;
      const z = (row + 0.5) * cell - 48;
      return { x: (x - z) * 1.05, y: (x + z) * 0.57 };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const plants = words.map((word, index) => ({ word, ...slots[index] }));
  return (
    <g>
      <g
        className={focused ? '' : 'land-target'}
        role={focused ? undefined : 'button'}
        tabIndex={focused ? undefined : 0}
        aria-label={focused ? undefined : `Open ${plot.name}, ${words.length} planted words`}
        onClick={focused ? undefined : onPickPlot}
        onKeyDown={
          focused
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPickPlot();
                }
              }
        }
      >
        <title>{`${plot.name} · ${words.length} planted words`}</title>
        {!focused ? (
          <path d="M0 -82 L148 0 L0 82 L-148 0Z" fill="transparent" />
        ) : (
          <Land id={id} empty={!words.length} />
        )}
        {plants.map(({ word, x, y }) => (
          <g
            key={word.id}
            transform={`translate(${x} ${y})`}
            className={focused ? 'plant-target' : ''}
            role={focused ? 'button' : undefined}
            tabIndex={focused ? 0 : undefined}
            aria-label={focused ? `${wordName(word)}, ${plantLabel(word)}` : undefined}
            aria-pressed={focused ? selectedWord === word.id : undefined}
            onClick={focused ? () => onPickWord(word.id) : undefined}
            onKeyDown={
              focused
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPickWord(word.id);
                    }
                  }
                : undefined
            }
          >
            <title>{`${wordName(word)} · ${plantLabel(word)}`}</title>
            {focused && (
              <ellipse
                className="plant-selection"
                cy="0"
                rx={Math.max(7, cell * 0.4)}
                ry={Math.max(4, cell * 0.23)}
                fill={selectedWord === word.id ? '#d6ebad' : 'transparent'}
                stroke={selectedWord === word.id ? '#edf7d9' : 'transparent'}
                strokeWidth="1.2"
              />
            )}
            <g transform={`scale(${scale})`}>
              <Plant word={word} id={id} />
            </g>
            {focused && (
              <ellipse cx="0" cy="-8" rx={Math.max(8, cell * 0.35)} ry="13" fill="transparent" />
            )}
          </g>
        ))}
        <GardenGnomes count={gardenGnomeCount(words, now)} plotId={plot.id} />
      </g>
    </g>
  );
}

/** Cancel shared tile edges, then round only the continuous outer boundary. */
function islandOutline(cells: { x: number; y: number }[]) {
  type Point = [number, number];
  const key = (p: Point) => p.join(',');
  const edges = new Map<string, [Point, Point]>();
  for (const { x, y } of cells) {
    const points: Point[] = [
      [x, y - 82],
      [x + 148, y],
      [x, y + 82],
      [x - 148, y],
    ];
    points.forEach((a, i) => {
      const b = points[(i + 1) % 4];
      const reverse = `${key(b)}:${key(a)}`;
      if (edges.has(reverse)) edges.delete(reverse);
      else edges.set(`${key(a)}:${key(b)}`, [a, b]);
    });
  }
  if (!edges.size) return '';
  const next = new Map([...edges.values()].map(([a, b]) => [key(a), b]));
  const first = [...edges.values()][0][0];
  const points: Point[] = [first];
  let point = next.get(key(first));
  while (point && key(point) !== key(first) && points.length <= edges.size) {
    points.push(point);
    point = next.get(key(point));
  }
  const towards = (a: Point, b: Point): Point => {
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const fraction = Math.min(16 / distance, 0.25);
    return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  };
  const corners = points.map((p, i) => ({
    p,
    before: towards(p, points[(i + points.length - 1) % points.length]),
    after: towards(p, points[(i + 1) % points.length]),
  }));
  return `M${corners[0].before.join(' ')} ${corners
    .map(
      ({ p, before, after }, i) =>
        `${i ? `L${before.join(' ')} ` : ''}Q${p.join(' ')} ${after.join(' ')}`,
    )
    .join(' ')}Z`;
}

export function GardenArtwork({
  plots,
  focused,
  selectedWord,
  onPickWord,
  onPickPlot,
  id,
  bagCount = 0,
  onPickBag,
  bagOpen = false,
  now: previewNow,
}: {
  plots: GardenPlot[];
  focused: boolean;
  selectedWord: string | null;
  onPickWord: (id: string) => void;
  onPickPlot: (id: string) => void;
  id: string;
  bagCount?: number;
  onPickBag?: () => void;
  bagOpen?: boolean;
  now?: number;
}) {
  const currentTime = useGardenTime(previewNow);
  const [hovered, setHovered] = useState<string | null>(null);
  // Edge-sharing diamonds form a single parcel; fit every topic into the world.
  const columns = Math.max(1, Math.ceil(Math.sqrt(plots.length)));
  const cells = plots
    .map((plot, index) => {
      const col = index % columns,
        row = Math.floor(index / columns);
      return { plot, x: (col - row) * 148, y: (col + row) * 82 };
    })
    .sort((a, b) => a.y - b.y);
  const minX = Math.min(0, ...cells.map((cell) => cell.x - 148));
  const maxX = Math.max(0, ...cells.map((cell) => cell.x + 148));
  const minY = -82;
  const maxY = Math.max(82, ...cells.map((cell) => cell.y + 104));
  const scale = Math.min(1.85, 720 / (maxX - minX), 350 / (maxY - minY));
  const offsetX = 560 - ((minX + maxX) / 2) * scale;
  const offsetY = 290 - ((minY + maxY) / 2) * scale;
  const outline = islandOutline(cells);
  const hoveredCell = cells.find((cell) => cell.plot.id === hovered);
  return (
    <svg
      viewBox="0 0 1000 560"
      className="garden-artwork"
      aria-label={
        focused
          ? 'Your topic plot. Select a plant to see its word.'
          : 'Your garden. Select a topic plot to look closer.'
      }
      role="group"
    >
      <Paints id={id} />
      {focused ? (
        <ellipse cx="550" cy="320" rx="400" ry="205" fill={`url(#${id}-ground)`} opacity=".5" />
      ) : (
        <g className="garden-water" pointerEvents="none">
          <defs>
            <radialGradient id={`${id}-water`} cx=".45" cy=".35" r=".7">
              <stop stopColor="#b9e0dd" />
              <stop offset=".7" stopColor="#8dc7cc" />
              <stop offset="1" stopColor="#76b7c2" />
            </radialGradient>
          </defs>
          <path
            d="M175 300 C182 194 345 112 529 102 C706 90 932 198 950 309 C971 410 802 508 612 524 C405 542 162 432 175 300Z"
            fill={`url(#${id}-water)`}
          />
          <path
            d="M195 320 C190 402 400 511 600 505 M740 154 Q862 200 902 254 M774 460 Q868 423 903 381"
            fill="none"
            stroke="#d7efdf"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".65"
          />
          <path
            d="M220 285 q18 -6 36 0 M802 411 q23 -7 46 0 M362 451 q15 -5 30 0"
            fill="none"
            stroke="#e6f5e9"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".8"
          />
        </g>
      )}
      <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
        {!focused && !!cells.length && (
          <g>
            <defs>
              <clipPath id={`${id}-island-clip`}>
                <path d={outline} />
              </clipPath>
            </defs>
            <path
              d={outline}
              transform="translate(0 30)"
              fill="#407c83"
              opacity=".2"
              stroke="#407c83"
              strokeWidth="12"
              strokeLinejoin="round"
            />
            {Array.from({ length: 20 }, (_, i) => (
              <path
                key={i}
                d={outline}
                transform={`translate(0 ${20 - i})`}
                fill={`url(#${id}-soil)`}
              />
            ))}
            <path d={outline} fill={`url(#${id}-grass)`} stroke="#b7d987" strokeWidth="1.5" />
            <g clipPath={`url(#${id}-island-clip)`}>
              {cells.map(({ plot, x, y }) => (
                <path
                  key={plot.id}
                  transform={`translate(${x} ${y})`}
                  d="M0 -65 L118 0 L0 65 L-118 0Z"
                  fill={`url(#${id}-bed)`}
                  opacity=".8"
                />
              ))}
            </g>
          </g>
        )}
        {cells.map(({ plot, x, y }) => (
          <g
            key={plot.id}
            transform={`translate(${x} ${y})`}
            onMouseEnter={() => setHovered(plot.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(plot.id)}
            onBlur={() => setHovered(null)}
          >
            <Patch
              plot={plot}
              now={currentTime}
              id={id}
              focused={focused}
              selectedWord={selectedWord}
              onPickWord={onPickWord}
              onPickPlot={() => onPickPlot(plot.id)}
            />
          </g>
        ))}
      </g>
      {!plots.length && (
        <g transform="translate(560 285) scale(1.85)">
          <Land id={id} empty />
        </g>
      )}
      {!focused && hoveredCell && (
        <g
          className="plot-tooltip"
          pointerEvents="none"
          transform={`translate(${Math.max(230, Math.min(800, offsetX + hoveredCell.x * scale))} ${Math.max(40, offsetY + (hoveredCell.y - 82) * scale - 36)})`}
        >
          <rect x="-180" y="-23" width="360" height="48" rx="16" fill="#244b39" />
          <text textAnchor="middle" y="6" fill="#f1f7ed" fontSize="15">
            {hoveredCell.plot.name}
          </text>
        </g>
      )}
      {onPickBag && (
        <g
          transform="translate(90 440)"
          className="seed-bag-target"
          role="button"
          tabIndex={0}
          aria-label={`Seed bag, ${bagCount} of 20 words`}
          aria-expanded={bagOpen}
          aria-controls="world-seed-bag"
          onClick={onPickBag}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPickBag();
            }
          }}
        >
          <title>Open your seed bag</title>
          <SeedBagArtwork id={id} />
          <text y="43" textAnchor="middle" fill="#244f3c" fontSize="16" fontWeight="600">
            Seed bag
          </text>
          <text y="63" textAnchor="middle" fill="#426b50" fontSize="13">
            {bagCount} / 20
          </text>
        </g>
      )}
    </svg>
  );
}

function SeedBagArtwork({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-sack`} cx=".3" cy=".25" r=".8">
          <stop stopColor="#e7c591" />
          <stop offset=".45" stopColor="#c39b65" />
          <stop offset=".8" stopColor="#9c7146" />
          <stop offset="1" stopColor="#775335" />
        </radialGradient>
        <linearGradient id={`${id}-sack-rim`} x1="0" y1="0" x2=".3" y2="1">
          <stop stopColor="#ecd0a1" />
          <stop offset=".5" stopColor="#c6a071" />
          <stop offset="1" stopColor="#92683f" />
        </linearGradient>
        <linearGradient id={`${id}-sack-opening`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#563d2a" />
          <stop offset="1" stopColor="#967149" />
        </linearGradient>
      </defs>
      <ellipse cx="7" cy="20" rx="40" ry="12" fill="#554b32" opacity=".18" />
      <ellipse cx="3" cy="18" rx="27" ry="7" fill="#654e32" opacity=".22" />
      <path
        d="M-18 -43 Q-37 -27 -39 -4 C-43 23 -14 30 13 25 C40 22 44 7 35 -15 Q30 -32 18 -43Z"
        fill={`url(#${id}-sack)`}
      />
      <path
        d="M18 -39 Q25 -17 24 4 Q24 17 12 23 C38 19 39 8 33 -12 Q27 -31 18 -39Z"
        fill="#795133"
        opacity=".23"
      />
      <path
        d="M-15 -35 Q-29 -21 -30 -5"
        fill="none"
        stroke="#f4dbad"
        strokeWidth="5"
        strokeLinecap="round"
        opacity=".3"
      />
      <path
        d="M-10 -40 Q-18 -26 -17 -14 M8 -39 Q14 -28 12 -22 M-30 8 Q-24 17 -12 20"
        fill="none"
        stroke="#936d44"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".28"
      />
      <path
        d="M-20 -42 L-26 -61 Q-5 -69 23 -60 L18 -42 Q0 -34 -20 -42Z"
        fill={`url(#${id}-sack-rim)`}
      />
      <ellipse
        cx="-1"
        cy="-61"
        rx="25"
        ry="8"
        fill={`url(#${id}-sack-opening)`}
        stroke="#ddba85"
        strokeWidth="3"
      />
      <path d="M-24 -59 Q-5 -48 22 -58 L18 -47 Q-2 -39 -21 -48Z" fill={`url(#${id}-sack-rim)`} />
      <path
        d="M-20 -47 Q0 -39 19 -46"
        fill="none"
        stroke="#795936"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M-20 -49 Q0 -41 19 -48"
        fill="none"
        stroke="#dbc18a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M18 -46 Q35 -57 33 -44 Q31 -37 18 -46 Q19 -30 29 -25 M18 -46 Q17 -32 13 -27"
        fill="none"
        stroke="#80633c"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="18" cy="-46" r="3.6" fill="#cfb17a" />
      <g transform="translate(-4 -4) rotate(-7)">
        <ellipse rx="15" ry="17" fill="#795636" opacity=".24" transform="translate(1 2)" />
        <ellipse rx="15" ry="17" fill="#e5d0a1" />
        <ellipse
          rx="12"
          ry="14"
          fill="none"
          stroke="#b59869"
          strokeWidth=".8"
          strokeDasharray="2 2"
        />
        <path
          d="M0 9 L0 -7 M0 1 Q-12 -9 -10 -1 Q-6 5 0 1 M0 -4 Q11 -14 9 -6 Q6 0 0 -4"
          fill="#64844b"
          stroke="#64844b"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    </>
  );
}

export function SeedBagIcon() {
  const id = `seed-bag-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      className="seed-bag-icon"
      viewBox="-48 -73 100 110"
      width="28"
      height="30"
      aria-hidden="true"
      focusable="false"
    >
      <SeedBagArtwork id={id} />
    </svg>
  );
}
