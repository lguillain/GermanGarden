import { useState } from 'react';
import { GnomeReviewIcon } from '../../components/gnome-review-icon';
import { OriginalGnome } from '../../components/gnome-original';
import { GnomeVariant } from '../../components/gnome-variant';

const designs = [
  {
    name: 'The Original',
    detail: 'A pointed cap, a silver beard, and the familiar self-satisfied grin.',
    quote: '“Miss me?”',
    color: '#9e493f',
    probability: 60,
    variant: -1,
  },
  {
    name: 'The Foreman',
    probability: 14,
    variant: 0,
    detail: 'Square shoulders, a clipped beard, and a shovel he has no intention of using.',
    quote: '“This patch is under new management.”',
    color: '#9e493f',
  },
  {
    name: 'The Seed Thief',
    probability: 10,
    variant: 1,
    detail: 'A crooked cap, a pointed beard, and a suspiciously full sack.',
    quote: '“These? Definitely my seeds.”',
    color: '#53714d',
  },
  {
    name: 'The Squatter',
    probability: 8,
    variant: 2,
    detail: 'Round belly, a floppy hat, and boots planted firmly in your soil.',
    quote: '“I was here first.”',
    color: '#aa793e',
  },
  {
    name: 'The Hexer',
    probability: 5,
    variant: 3,
    detail: 'A towering hat, a forked beard, and a tiny crooked staff.',
    quote: '“May all your nouns be irregular.”',
    color: '#71617d',
  },
  {
    name: 'The Saboteur',
    probability: 3,
    variant: 4,
    detail: 'A backwards cap, a curled moustache, and a purloined watering can.',
    quote: '“Water? I thought you said vinegar.”',
    color: '#526c88',
  },
];

export function GnomeDesigns() {
  const [uniformHat, setUniformHat] = useState(false);
  return (
    <div className="gnome-designs">
      <div className="gnome-caption">
        <div>
          <h3>Six uninvited guests</h3>
          <p>Distinct silhouettes for the same mischievous little world.</p>
        </div>
        <button aria-pressed={uniformHat} onClick={() => setUniformHat(!uniformHat)}>
          Compare in one hat color
        </button>
      </div>
      <div className="gnome-design-grid">
        {designs.map((design) => (
          <article className="gnome-design-card" key={design.name}>
            <svg viewBox="0 0 180 200" role="img" aria-label={`${design.name}: ${design.detail}`}>
              {design.variant === -1 ? (
                <OriginalGnome
                  x={90}
                  y={176}
                  scale={1.35}
                  hat={uniformHat ? '#9e493f' : design.color}
                />
              ) : (
                <GnomeVariant
                  variant={design.variant}
                  hat={uniformHat ? '#9e493f' : design.color}
                />
              )}
            </svg>
            <h3>{design.name}</h3>
            <span className="small muted">{design.probability}% probability</span>
            <p className="small muted">{design.detail}</p>
            <p className="small gnome-design-quote">{design.quote}</p>
          </article>
        ))}
      </div>
      <div className="gnome-review-specimen">
        <div className="gnome-review-enlarged">
          <GnomeReviewIcon />
        </div>
        <div>
          <h3>Let’s kick the gnomes out</h3>
          <p className="small muted">The review icon, enlarged and at its actual button size.</p>
          <span className="button primary">
            <GnomeReviewIcon />
            Review 12 words
          </span>
        </div>
      </div>
      <p className="small muted">
        Garden mix · Original gnome: 60%. Foreman: 14%, Seed Thief: 10%, Squatter: 8%, Hexer: 5%,
        Saboteur: 3%. Props are decorative. All six designs appear throughout the garden.
      </p>
    </div>
  );
}
