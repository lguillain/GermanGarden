import { useId } from 'react';
import { GnomePaints } from './gnome-paints';

export function OriginalGnome({
  x = 0,
  y = 0,
  scale = 1,
  hat = '#9e493f',
}: {
  x?: number;
  y?: number;
  scale?: number;
  hat?: string;
}) {
  const id = `original-gnome-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const paint = (material: string) => `url(#${id}-${material})`;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <GnomePaints id={id} hat={hat} coat="#7f9062" />
      <ellipse cy="5" rx="32" ry="9" fill="#40372a" opacity=".17" />
      <path d="M-24-8 Q-31-38-12-48 L12-48 Q31-38 24-8Z" fill={paint('coat')} />
      <path d="M-21-8 L-25 3 H-5 L-3-8 M4-8 L7 3 H27 L22-8" fill={paint('boots')} />
      <path d="M-20-51 Q-29-31 0-13 Q29-31 20-51" fill={paint('beard')} />
      <ellipse cy="-53" rx="22" ry="18" fill={paint('skin')} />
      <path d="M-26-60 Q-16-88 8-111 Q2-88 23-62Z" fill={paint('hat')} />
      <path
        d="M-26-60 Q0-68 25-60"
        fill="none"
        stroke={hat}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M-26-60 Q0-68 25-60"
        fill="none"
        stroke="#000"
        opacity=".22"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M-15-56 L-6-53 M6-53 L15-56"
        stroke="#44392f"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="-10" cy="-50" r="2" fill="#332f29" />
      <circle cx="10" cy="-50" r="2" fill="#332f29" />
      <ellipse cy="-45" rx="8" ry="6" fill={paint('nose')} />
      <path
        d="M-5-34 Q3-29 10-37"
        fill="none"
        stroke="#685144"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M-25-34 L-33-23 M25-34 L33-23"
        stroke={paint('skin')}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-17-68 Q-9-87 3-99" stroke="#fff1d0" opacity=".28" strokeWidth="3.5" />
        <path d="M10-80 Q15-69 16-67" stroke="#3d2e2d" opacity=".22" strokeWidth="2" />
        <path
          d="M-18-37 Q-15-27-9-25 M-7-28 L0-19 M14-36 Q13-29 7-25"
          stroke="#b4a48a"
          strokeWidth="1.3"
        />
        <path d="M-23-18 Q-4-9 23-18" stroke="#493f30" strokeWidth="4" />
        <rect
          x="-3"
          y="-18"
          width="8"
          height="5"
          rx="1"
          fill={paint('gold')}
          stroke="#a48643"
          strokeWidth=".5"
        />
        <path d="M-21-28 L-22-23 M21-27 L23-22" stroke="#c4d49d" opacity=".55" strokeWidth="2" />
        <path
          d="M-19-9 L-7-8 M10-8 L20-9"
          stroke="#b5c393"
          opacity=".45"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <path d="M-22 0 H-8 M10 0 H22" stroke="#b39b7b" opacity=".65" strokeWidth="1.4" />
        <path d="M-17-5 L-11-4 M13-5 L18-4" stroke="#d4be98" opacity=".5" strokeWidth="1" />
        <path d="M-35-24 L-31-22 M31-22 L34-24" stroke="#b9805f" strokeWidth="1" />
      </g>
    </g>
  );
}
