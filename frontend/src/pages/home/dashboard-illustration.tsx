import { useId } from 'react';

export type DashboardIllustrationKind = 'sprouts' | 'watering' | 'seeds' | 'support';

/* Small three-quarter scenes: separate top, front and side planes establish depth. */
function Shoot({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 0 C-5 -18 5 -27 2 -44"
        fill="none"
        stroke="#42694b"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M-1 -6 C-1 -20 -25 -35 -29 -23 C-33 -9 -13 -4 -1 -6Z" fill="#54865a" />
      <path d="M-29 -23 C-23 -34 -4 -23 -1 -6 C-14 -17 -22 -22 -29 -23Z" fill="#a9c97c" />
      <path d="M1 -24 C-1 -43 24 -52 29 -39 C34 -24 14 -19 1 -24Z" fill="#47775a" />
      <path d="M1 -24 C4 -43 24 -52 29 -39 C16 -38 8 -32 1 -24Z" fill="#91b97a" />
      <path d="M2 -44 C-11 -47 -17 -66 -7 -68 C4 -70 9 -51 2 -44Z" fill="#729b61" />
      <path
        d="M-7 -68 C0 -66 4 -53 2 -44"
        fill="none"
        stroke="#c2d990"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function Pot({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-26 -5 L-20 30 Q0 44 20 30 L26 -5Z" fill="#bd7856" />
      <path d="M0 4 L0 37 Q12 37 20 30 L26 -5Z" fill="#9d5b43" />
      <path d="M-30 -8 L-29 3 Q0 19 29 3 L30 -8Z" fill="#cf8962" />
      <ellipse cy="-8" rx="30" ry="12" fill="#edba8e" />
      <ellipse cy="-8" rx="23" ry="8" fill="#654c38" />
      <path d="M-20 -8 Q0 -19 20 -8 Q0 -11 -20 -8Z" fill="#473c2f" />
      <path d="M-20 12 L-17 27" stroke="#e5a578" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

export function DashboardIllustration({ kind }: { kind: DashboardIllustrationKind }) {
  const id = useId();
  return (
    <svg
      className="garden-dashboard-art"
      viewBox="0 0 160 140"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-ground`}>
          <stop stopColor="#75634a" stopOpacity=".23" />
          <stop offset="1" stopColor="#75634a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="82" cy="117" rx="72" ry="17" fill={`url(#${id}-ground)`} />
      {kind === 'sprouts' && (
        <>
          <path d="M15 83 L81 59 L146 81 L80 108Z" fill="#e3b68b" />
          <path d="M15 83 L80 108 L80 132 L18 108Z" fill="#c38b64" />
          <path d="M80 108 L146 81 L143 107 L80 132Z" fill="#9c694e" />
          <path d="M25 83 L81 65 L135 82 L80 101Z" fill="#69513d" />
          <path d="M25 83 L81 65 L135 82 L128 85 L81 71 L32 86Z" fill="#493e30" />
          <Shoot x={89} y={79} scale={0.75} />
          <Shoot x={48} y={88} scale={0.58} />
          <Shoot x={107} y={94} scale={0.5} />
          <path d="M19 86 L78 109" stroke="#efc9a3" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="72" cy="95" rx="6" ry="3" fill="#c5b798" />
        </>
      )}
      {kind === 'watering' && (
        <>
          <Pot x={119} y={94} scale={0.72} />
          <Shoot x={119} y={89} scale={0.44} />
          <path d="M37 48 C2 22 1 87 33 78" fill="none" stroke="#466c60" strokeWidth="12" />
          <path d="M35 45 C7 28 7 75 24 75" fill="none" stroke="#9dbeaa" strokeWidth="4" />
          <path d="M28 46 L74 42 L80 94 C75 113 24 110 23 92Z" fill="#79a38c" />
          <path d="M58 48 L74 42 L80 94 Q76 105 58 107Z" fill="#4b7867" />
          <ellipse cx="51" cy="45" rx="24" ry="10" fill="#b4cfb6" />
          <ellipse cx="51" cy="44" rx="16" ry="6" fill="#385c50" />
          <path d="M74 70 L94 38 L108 41 L79 88Z" fill="#668f79" />
          <path d="M74 70 L94 38 L100 41 L77 80Z" fill="#b4cfb6" />
          <ellipse cx="103" cy="39" rx="13" ry="7" transform="rotate(25 103 39)" fill="#d9bc80" />
          <path
            d="M96 36 L97 37 M102 38 L103 39 M108 40 L109 41"
            stroke="#95784b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M34 59 L31 88" stroke="#bad3ba" strokeWidth="5" strokeLinecap="round" />
          <g className="garden-dashboard-water" fill="#83acbe">
            <path d="M110 51 Q102 64 110 64 Q118 64 110 51Z" />
            <path d="M124 62 Q118 73 124 73 Q130 73 124 62Z" />
          </g>
        </>
      )}
      {kind === 'seeds' && (
        <>
          <path d="M19 80 L77 61 L133 80 L74 102Z" fill="#edc98e" />
          <path d="M19 80 L74 102 L74 125 L19 103Z" fill="#c49a61" />
          <path d="M74 102 L133 80 L133 103 L74 125Z" fill="#a77d4d" />
          <path d="M28 80 L77 66 L123 81 L74 97Z" fill="#866441" />
          <path d="M42 74 L35 28 L70 17 L90 63Z" fill="#d4c5a0" />
          <path d="M35 28 L42 74 L76 63 L70 17Z" fill="#f4e5bc" />
          <path d="M35 28 L53 41 L70 17Z" fill="#fff3d4" />
          <path
            d="M46 50 L63 45 M48 56 L60 52"
            stroke="#a5b68a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[
            { x: 64, y: 83, r: -25 },
            { x: 87, y: 77, r: 35 },
            { x: 104, y: 86, r: 65 },
            { x: 139, y: 111, r: 25 },
          ].map(({ x, y, r }) => (
            <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
              <ellipse rx="6" ry="10" fill="#8f633d" />
              <ellipse cx="-1.5" cy="-2" rx="4" ry="7" fill="#d7b77c" />
              <path
                d="M-2 -7 Q-5 -2 -3 2"
                fill="none"
                stroke="#f0d59e"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          ))}
          <path d="M22 85 L72 105" stroke="#f1d5a7" strokeWidth="2" />
        </>
      )}
      {kind === 'support' && (
        <>
          <Pot x={79} y={88} />
          <path d="M59 84 L56 20 L61 14 L65 20 L66 86Z" fill="#b68c59" />
          <path d="M56 20 L61 14 L61 84 L59 84Z" fill="#e0c18c" />
          <Shoot x={83} y={81} scale={0.84} />
          <path
            d="M60 58 Q70 63 82 57 M61 61 Q72 66 82 60"
            fill="none"
            stroke="#e7d4a2"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M71 61 C55 47 59 71 71 61 C85 47 88 69 71 61 L67 72 M71 61 L79 70"
            fill="none"
            stroke="#f1dfb5"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <ellipse cx="113" cy="118" rx="7" ry="4" fill="#b9b69a" />
        </>
      )}
    </svg>
  );
}
