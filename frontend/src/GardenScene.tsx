import { type ReactNode, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GardenPlot, Word } from './api';

const growthNames = ['Just planted', 'Sprout', 'Seedling', 'Sapling', 'Blooming', 'Fully grown'];
const LAND = 'M0 -82 Q7 -82 14 -78 L142 -8 Q156 0 142 8 L14 78 Q0 86 -14 78 L-142 8 Q-156 0 -142 -8 L-14 -78 Q-7 -82 0 -82Z';
const hash = (value: string) => [...value].reduce((n, char) => ((n * 31 + char.charCodeAt(0)) >>> 0), 0);
const wordName = (word: Word) => [word.article, word.lemma].filter(Boolean).join(' ');

function Paints({ id }: { id: string }) {
  return <defs>
    <linearGradient id={`${id}-grass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b4d77e" /><stop offset=".5" stopColor="#91bc67" /><stop offset="1" stopColor="#6e9f50" /></linearGradient>
    <linearGradient id={`${id}-soil`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#8d6e4c" /><stop offset="1" stopColor="#635139" /></linearGradient>
    <linearGradient id={`${id}-bed`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#977957" /><stop offset="1" stopColor="#ba9467" /></linearGradient>
    <linearGradient id={`${id}-trunk`}><stop stopColor="#a7834f" /><stop offset=".4" stopColor="#bd9b61" /><stop offset="1" stopColor="#795a38" /></linearGradient>
    <radialGradient id={`${id}-leaf`} cx=".3" cy=".2" r=".85"><stop stopColor="#b1d77b" /><stop offset=".4" stopColor="#6ea45b" /><stop offset="1" stopColor="#376e49" /></radialGradient>
    <radialGradient id={`${id}-leaf2`} cx=".25" cy=".15" r=".9"><stop stopColor="#9fcf8e" /><stop offset=".45" stopColor="#5b9d76" /><stop offset="1" stopColor="#326453" /></radialGradient>
    <radialGradient id={`${id}-leaf3`} cx=".3" cy=".18" r=".9"><stop stopColor="#d0db87" /><stop offset=".45" stopColor="#8db65f" /><stop offset="1" stopColor="#4a7e48" /></radialGradient>
    <radialGradient id={`${id}-flower`} cx=".3" cy=".25"><stop stopColor="#f7c0b8" /><stop offset="1" stopColor="#d68087" /></radialGradient>
    <radialGradient id={`${id}-ground`}><stop stopColor="#b5cf9d" /><stop offset="1" stopColor="#94b994" /></radialGradient>
    <filter id={`${id}-shadow`} x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="5" /></filter>
  </defs>;
}

/** Rounded volume, highlights and cast shadows give a fixed isometric 3D appearance. */
function Plant({ word, id }: { word: Word; id: string }) {
  const stage = Math.max(0, Math.min(5, word.growth || 0));
  const variant = hash(word.id) % 3;
  const paint = `url(#${id}-${['leaf', 'leaf2', 'leaf3'][variant]})`;
  if (stage < 2) return <g>
    <ellipse cy="2" rx="11" ry="4" fill="#4b5534" opacity=".2" />
    <ellipse cy="0" rx="7" ry="3.2" fill="#765c3f" />
    <path d={`M0 0 Q-2 -7 0 ${stage ? -20 : -11}`} fill="none" stroke="#608148" strokeWidth="2.8" strokeLinecap="round" />
    <ellipse cx="-5" cy={stage ? -13 : -7} rx={stage ? 8 : 5.5} ry={stage ? 4.5 : 3.3} transform={`rotate(30 -5 ${stage ? -13 : -7})`} fill={paint} />
    <ellipse cx="5" cy={stage ? -19 : -11} rx={stage ? 8 : 5.5} ry={stage ? 4.5 : 3.3} transform={`rotate(-30 5 ${stage ? -19 : -11})`} fill={paint} />
  </g>;
  const size = [.0, .0, .60, .78, .92, 1.1][stage];
  return <g transform={`scale(${size})`}>
    <ellipse cx="10" cy="4" rx="22" ry="8" fill="#334e36" opacity=".18" />
    <path d="M-4 1 L-3 -35 Q0 -41 3 -35 L5 1 Q0 4 -4 1" fill={`url(#${id}-trunk)`} />
    <path d="M0 -17 L-10 -31 M1 -24 L11 -39" stroke="#927140" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="-12" cy="-34" rx="16" ry="17" fill={paint} />
    <ellipse cx="13" cy="-38" rx="16" ry="18" fill={paint} />
    <ellipse cx="0" cy="-51" rx={variant === 1 ? 18 : 22} ry={variant === 1 ? 29 : 24} fill={paint} />
    <ellipse cx="-8" cy="-58" rx="8" ry="9" fill="#dbefaa" opacity=".15" />
    {stage >= 4 && (variant === 1 ? <g fill="#e5b467"><circle cx="-15" cy="-36" r="3" /><circle cx="12" cy="-45" r="3.5" /><circle cx="-3" cy="-58" r="3" /></g> : <g fill={`url(#${id}-flower)`}><circle cx="-16" cy="-37" r="4" /><circle cx="12" cy="-50" r="4.5" /><circle cx="-4" cy="-63" r="4" />{stage === 5 && <><circle cx="15" cy="-31" r="3.5" /><circle cx="-9" cy="-48" r="3" /></>}</g>)}
  </g>;
}

function Land({ id, empty }: { id: string; empty: boolean }) {
  return <g>
    <ellipse cy="38" rx="134" ry="54" fill="#385e45" opacity=".17" filter={`url(#${id}-shadow)`} />
    <path d={LAND} transform="translate(0 22)" fill={`url(#${id}-soil)`} />
    <path d="M-148 0 L0 82 L148 0 L148 22 L0 104 L-148 22Z" fill={`url(#${id}-soil)`} />
    <path d="M0 82 L148 0 L148 22 L0 104Z" fill="#4b4e33" opacity=".16" />
    <path d={LAND} fill={`url(#${id}-grass)`} stroke="#b7d987" strokeWidth="1" />
    <path d="M0 -62 L114 0 L0 62 L-114 0Z" fill={`url(#${id}-bed)`} stroke="#739554" strokeWidth="4" strokeLinejoin="round" />
    {[-2, -1, 0, 1, 2].map(n => <path key={n} d={`M${-86 + n * 9} ${-n * 5} L${n * 9} ${47 - n * 5}`} stroke="#694c32" strokeWidth="1" opacity=".12" />)}
    <g fill="#d4dfb3" opacity=".6"><ellipse cx="-114" cy="-9" rx="5" ry="2.5" /><ellipse cx="-124" cy="-4" rx="3" ry="1.5" /><ellipse cx="76" cy="35" rx="4" ry="2" /></g>
    <g stroke="#69964c" strokeWidth="2" strokeLinecap="round"><path d="M-69 43 l-2 -5 m2 5 l3 -5 M89 -28 l-2 -5 m2 5 l3 -3 M-45 -53 l-2 -5 m2 5 l3 -3" /></g>
    {empty && <g transform="translate(57 2)"><ellipse cy="8" rx="12" ry="4" fill="#605f40" opacity=".22" /><path d="M-8 -10 L8 -10 L6 7 Q0 11 -7 7Z" fill="#6c9192" /><ellipse cy="-10" rx="8" ry="3" fill="#9eb8ad" /><path d="M8 -6 Q22 -10 18 -1 L8 4" fill="none" stroke="#628483" strokeWidth="3" /><path d="M-7 -3 L-19 -12 L-22 -8 L-8 3Z" fill="#789c96" /></g>}
  </g>;
}

function Patch({ plot, id, focused, onPickWord, onPickPlot, selectedWord, connected = false }: {
  plot: GardenPlot; id: string; focused: boolean;
  onPickWord: (id: string) => void; onPickPlot: () => void; selectedWord: string | null; connected?: boolean;
}) {
  // Stable alphabetical slots prevent plants jumping whenever review order changes.
  const words = [...plot.words].sort((a, b) => a.id.localeCompare(b.id));
  const columns = Math.max(3, Math.ceil(Math.sqrt(words.length)));
  const cell = 96 / columns;
  const scale = Math.min(.85, cell / 38);
  const plants = words.map((word, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = (col + .5) * cell - 48;
    const z = (row + .5) * cell - 48;
    return { word, x: (x - z) * 1.05, y: (x + z) * .57 };
  }).sort((a, b) => a.y - b.y);
  return <g>
    <g className={focused ? '' : 'land-target'} role={focused ? undefined : 'button'} tabIndex={focused ? undefined : 0}
      aria-label={focused ? undefined : `Open ${plot.name}, ${words.length} planted words`}
      onClick={focused ? undefined : onPickPlot}
      onKeyDown={focused ? undefined : e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickPlot(); } }}>
      <title>{`${plot.name} · ${words.length} planted words`}</title>
      {connected ? <path d="M0 -82 L148 0 L0 82 L-148 0Z" fill="transparent" /> : <Land id={id} empty={!words.length} />}
      {plants.map(({ word, x, y }) => <g key={word.id} transform={`translate(${x} ${y})`} className={focused ? 'plant-target' : ''}
        role={focused ? 'button' : undefined} tabIndex={focused ? 0 : undefined}
        aria-label={focused ? `${wordName(word)}, ${growthNames[word.growth || 0]}` : undefined}
        aria-pressed={focused ? selectedWord === word.id : undefined}
        onClick={focused ? () => onPickWord(word.id) : undefined}
        onKeyDown={focused ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickWord(word.id); } } : undefined}>
        <title>{`${wordName(word)} · ${growthNames[word.growth || 0]}`}</title>
        {focused && <ellipse className="plant-selection" cy="0" rx={Math.max(7, cell * .4)} ry={Math.max(4, cell * .23)} fill={selectedWord === word.id ? '#d6ebad' : 'transparent'} stroke={selectedWord === word.id ? '#edf7d9' : 'transparent'} strokeWidth="1.2" />}
        <g transform={`scale(${scale})`}><Plant word={word} id={id} /></g>
        {focused && <ellipse cx="0" cy="-8" rx={Math.max(8, cell * .35)} ry="13" fill="transparent" />}
      </g>)}
    </g>

  </g>;
}

export function GardenArtwork({ plots, focused, selectedWord, onPickWord, onPickPlot, id, bagCount = 0, onPickBag, bagOpen = false }: {
  plots: GardenPlot[]; focused: boolean; selectedWord: string | null;
  onPickWord: (id: string) => void; onPickPlot: (id: string) => void; id: string; bagCount?: number; onPickBag?: () => void; bagOpen?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  // Edge-sharing diamonds form a single parcel; fit every topic into the world.
  const columns = Math.max(1, Math.ceil(Math.sqrt(plots.length)));
  const cells = plots.map((plot, index) => {
    const col = index % columns, row = Math.floor(index / columns);
    return { plot, x: (col - row) * 148, y: (col + row) * 82 };
  }).sort((a, b) => a.y - b.y);
  const minX = Math.min(0, ...cells.map(cell => cell.x - 148));
  const maxX = Math.max(0, ...cells.map(cell => cell.x + 148));
  const minY = -82;
  const maxY = Math.max(82, ...cells.map(cell => cell.y + 104));
  const scale = Math.min(1.85, 720 / (maxX - minX), 350 / (maxY - minY));
  const offsetX = 560 - (minX + maxX) / 2 * scale;
  const offsetY = 290 - (minY + maxY) / 2 * scale;
  const hoveredCell = cells.find(cell => cell.plot.id === hovered);
  return <svg viewBox="0 0 1000 560" className="garden-artwork" aria-label={focused ? 'Your topic plot. Select a plant to see its word.' : 'Your garden. Select a topic plot to look closer.'} role="group">
    <Paints id={id} />
    <ellipse cx="550" cy="320" rx="400" ry="205" fill={`url(#${id}-ground)`} opacity=".5" />
    <g transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}>
      {!focused && cells.map(({ plot, x, y }) => <g key={plot.id} transform={`translate(${x} ${y})`}>
        <path d="M-148 0 L0 82 L148 0 L148 20 L0 102 L-148 20Z" fill={`url(#${id}-soil)`} />
        <path d="M0 -82 L148 0 L0 82 L-148 0Z" fill={`url(#${id}-grass)`} stroke="#9fc377" strokeWidth="1" />
        <path d="M0 -65 L118 0 L0 65 L-118 0Z" fill={`url(#${id}-bed)`} opacity=".8" />
      </g>)}
      {cells.map(({ plot, x, y }) => <g key={plot.id} transform={`translate(${x} ${y})`}
        onMouseEnter={() => setHovered(plot.id)} onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(plot.id)} onBlur={() => setHovered(null)}>
        <Patch plot={plot} id={id} focused={focused} connected={!focused} selectedWord={selectedWord} onPickWord={onPickWord} onPickPlot={() => onPickPlot(plot.id)} />
      </g>)}
    </g>
    {!plots.length && <g transform="translate(560 285) scale(1.85)"><Land id={id} empty /></g>}
    {!focused && hoveredCell && <g className="plot-tooltip" pointerEvents="none"
      transform={`translate(${Math.max(230, Math.min(800, offsetX + hoveredCell.x * scale))} ${Math.max(40, offsetY + (hoveredCell.y - 82) * scale - 36)})`}>
      <rect x="-180" y="-23" width="360" height="48" rx="16" fill="#244b39" />
      <text textAnchor="middle" y="6" fill="#f1f7ed" fontSize="15">{hoveredCell.plot.name}</text>
    </g>}
    {onPickBag && <g transform="translate(90 440)" className="seed-bag-target" role="button" tabIndex={0}
      aria-label={`Seed bag, ${bagCount} of 20 words`} aria-expanded={bagOpen} aria-controls="world-seed-bag"
      onClick={onPickBag} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickBag(); } }}>
      <title>Open your seed bag</title>
      <ellipse cy="13" rx="43" ry="14" fill="#42674a" opacity=".22" />
      <path d="M-17 -42 L-25 -61 Q0 -51 24 -61 L17 -42 Q48 -13 34 9 Q0 29 -34 9 Q-48 -13 -17 -42Z" fill="#af8860" stroke="#846744" strokeWidth="2" />
      <path d="M-13 -39 Q-34 -9 -22 10 Q-10 18 1 17 Q-16 -5 -4 -39" fill="#cfad79" opacity=".65" />
      <path d="M-20 -42 Q0 -36 21 -42 M15 -40 Q35 -42 29 -30 Q21 -24 16 -40 L27 -20" fill="none" stroke="#655d3b" strokeWidth="4" strokeLinecap="round" />
      <ellipse cy="-10" rx="13" ry="15" fill="#e0c694" />
      <path d="M0 0 L0 -17 M0 -9 Q-14 -20 -10 -11 Q-6 -6 0 -9 M0 -14 Q13 -24 10 -15 Q7 -10 0 -14" fill="#628652" stroke="#628652" strokeWidth="2" />
      <text y="43" textAnchor="middle" fill="#244f3c" fontSize="16" fontWeight="600">Seed bag</text>
      <text y="63" textAnchor="middle" fill="#426b50" fontSize="13">{bagCount} / 20</text>
    </g>}

  </svg>;
}

export function TopicScene({ plot }: { plot: GardenPlot }) {
  const id = `topic-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [wordId, setWordId] = useState<string | null>(null);
  const word = plot.words.find(item => item.id === wordId);
  return <section className="topic-scene" aria-label={`${plot.name} garden plot`}>
    <GardenArtwork plots={[plot]} focused selectedWord={wordId} onPickWord={setWordId} onPickPlot={() => {}} id={id} />
    <div className="topic-plant-caption" aria-live="polite">{word ? <><strong lang="de">{wordName(word)}</strong><span>{word.english} · {growthNames[word.growth || 0]}</span></> : <span>{plot.words.length ? 'Select a plant to see its word' : 'No words planted in this topic yet'}</span>}</div>
  </section>;
}

export default function GardenScene({ plots, bagCount = 0, bagContent }: { plots: GardenPlot[]; bagCount?: number; bagContent?: ReactNode }) {
  const id = `garden-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const navigate = useNavigate();
  const [bagOpen, setBagOpen] = useState(false);
  return <section className="garden-world" aria-label="Growing garden">
    {!!plots.length && <div className="world-bottom"><span>Hover to see a topic · Select a field to look closer</span></div>}
    <GardenArtwork plots={plots} focused={false} selectedWord={null} onPickWord={() => {}} onPickPlot={topic => navigate(`/topics/${encodeURIComponent(topic)}`)} id={id} bagCount={bagCount} bagOpen={bagOpen} onPickBag={() => setBagOpen(open => !open)} />
    {!plots.length && <div className="world-empty"><h2>A little land. A fresh start.</h2><p>Plant your seed bag to start growing.</p></div>}
    {bagOpen && <div id="world-seed-bag" className="plot-inspector world-seed-bag"><button className="bag-close" aria-label="Close seed bag" onClick={() => setBagOpen(false)}>×</button>{bagContent}</div>}
  </section>;
}
