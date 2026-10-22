import { OriginalGnome } from './gnome-original';
import { GnomeVariant } from './gnome-variant';

const positions = [
  { x: -32, y: 24, scale: 0.32 },
  { x: 57, y: 8, scale: 0.3 },
  { x: 19, y: 32, scale: 0.35 },
  { x: -68, y: 8, scale: 0.3 },
  { x: 16, y: -2, scale: 0.27 },
  { x: -5, y: 46, scale: 0.32 },
];

// Brick red, plum, ochre, slate blue, forest green, and rust.
const hatColors = ['#9e493f', '#71617d', '#aa793e', '#526c88', '#53714d', '#b16a45'];

function randomValue(key: string) {
  // Seed by plot and permanent slot so arrivals and refreshes never recolor a gnome.
  let seed = 2166136261;
  for (const char of key) {
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  }
  seed = Math.imul(seed ^ (seed >>> 16), 2246822507);
  seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
}

function hatColor(plotId: string, slot: number) {
  return hatColors[Math.floor(randomValue(`${plotId}:${slot}`) * hatColors.length)];
}

export function GardenGnomes({ count, plotId }: { count: number; plotId: string }) {
  if (!count) return null;
  return (
    <g
      role="img"
      aria-label={`${count} garden ${count === 1 ? 'gnome' : 'gnomes'} · Overdue reviews`}
      pointerEvents="none"
    >
      <title>
        {count} {count === 1 ? 'gnome' : 'gnomes'} have gathered. Review overdue words to send them
        away.
      </title>
      {positions
        .slice(0, count)
        .map((position, slot) => {
          const roll = randomValue(`${plotId}:${slot}:design`);
          return {
            ...position,
            hat: hatColor(plotId, slot),
            variant:
              roll >= 0.6
                ? roll < 0.74
                  ? 0
                  : roll < 0.84
                    ? 1
                    : roll < 0.92
                      ? 2
                      : roll < 0.97
                        ? 3
                        : 4
                : -1,
          };
        })
        .sort((a, b) => a.y - b.y)
        .map((position) =>
          position.variant < 0 ? (
            <OriginalGnome key={position.x} {...position} />
          ) : (
            <g
              key={position.x}
              transform={`translate(${position.x} ${position.y}) scale(${position.scale * 0.7}) translate(-90 -177)`}
            >
              <GnomeVariant variant={position.variant} hat={position.hat} />
            </g>
          ),
        )}
    </g>
  );
}
