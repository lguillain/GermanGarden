import { useId } from 'react';

export function GnomeReviewIcon() {
  const id = `kick-gnome-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <span className="gnome-review-icon" title="Let’s kick the gnomes out">
      <svg
        viewBox="0 0 128 128"
        width="36"
        height="36"
        role="img"
        aria-label="Let’s kick the gnomes out"
      >
        <defs>
          <linearGradient id={`${id}-leather`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#dfb775" />
            <stop offset=".45" stopColor="#b78549" />
            <stop offset="1" stopColor="#79502e" />
          </linearGradient>
          <linearGradient id={`${id}-sole`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#66503a" />
            <stop offset="1" stopColor="#352c24" />
          </linearGradient>
          <radialGradient id={`${id}-hat`} cx=".25" cy=".25" r=".9">
            <stop stopColor="#e58b6a" />
            <stop offset=".5" stopColor="#b95c46" />
            <stop offset="1" stopColor="#7e3934" />
          </radialGradient>
          <radialGradient id={`${id}-face`} cx=".3" cy=".2" r=".85">
            <stop stopColor="#f2cfa5" />
            <stop offset="1" stopColor="#c48b66" />
          </radialGradient>
          <linearGradient id={`${id}-beard`} x1="0" y1="0" x2="1" y2=".6">
            <stop stopColor="#fff4d9" />
            <stop offset=".6" stopColor="#e5d8ba" />
            <stop offset="1" stopColor="#b8aa8b" />
          </linearGradient>
          <linearGradient id={`${id}-coat`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#97a56f" />
            <stop offset=".5" stopColor="#667a50" />
            <stop offset="1" stopColor="#3c553e" />
          </linearGradient>
        </defs>
        <ellipse cx="43" cy="114" rx="34" ry="6" fill="#453c2b" opacity=".16" />
        <ellipse cx="103" cy="108" rx="16" ry="3.5" fill="#453c2b" opacity=".10" />
        {/* Lifted heel, curved toe, stitched leather and a layered tread. */}
        <g transform="rotate(-16 43 91)" strokeLinejoin="round">
          <path
            d="M17 56 L43 55 L47 82 Q60 79 70 80 Q82 81 84 91 L82 101 Q49 114 14 104 L13 94Z"
            fill={`url(#${id}-leather)`}
            stroke="#805b36"
            strokeWidth="1.5"
          />
          <path d="M15 56 Q29 50 43 55 L44 64 Q29 60 15 65Z" fill="#735137" />
          <path
            d="M17 55 Q30 51 42 55"
            fill="none"
            stroke="#e9c88d"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M18 66 L18 90 Q17 97 25 99"
            fill="none"
            stroke="#f3d6a0"
            strokeWidth="4"
            opacity=".5"
            strokeLinecap="round"
          />
          <path
            d="M44 83 Q51 89 50 100 M57 85 Q73 81 79 91"
            fill="none"
            stroke="#efcc8f"
            strokeWidth="2"
            opacity=".65"
          />
          <path d="M16 100 Q47 109 82 96 L83 102 Q49 116 14 106Z" fill={`url(#${id}-sole)`} />
          <path d="M16 100 Q49 109 82 96" fill="none" stroke="#c4a675" strokeWidth="2" />
          <path
            d="M19 108 L19 111 M27 109 L27 113 M35 111 L35 114 M59 109 L61 112 M69 106 L71 109 M77 103 L79 106"
            stroke="#352c24"
            strokeWidth="3"
          />
          <path
            d="M31 64 L35 83 L47 93"
            fill="none"
            stroke="#795735"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />
          <g stroke="#eddbb7" strokeWidth="2.5" strokeLinecap="round">
            <path d="M29 67 L40 69 M30 74 L41 76 M33 81 L44 83" />
          </g>
          <path
            d="M35 85 Q27 82 28 88 Q30 93 37 87 Q43 83 45 88 Q45 94 37 88 L40 97"
            fill="none"
            stroke="#e8d0a3"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
        {/* The familiar gnome, tipped forward with flying boots and raised arms. */}
        <g transform="translate(89 49) rotate(28)">
          <path
            d="M-12 24 L-17 35 Q-26 34-25 41 Q-16 45-7 40 L-3 27 M6 26 L12 37 Q21 33 24 39 Q22 45 12 46 L2 33"
            fill={`url(#${id}-sole)`}
          />
          <path d="M-13 3 Q-23 12-18 29 Q-1 38 18 27 Q22 10 12 3Z" fill={`url(#${id}-coat)`} />
          <path
            d="M-18 12 L-27 3 M17 11 L25-1"
            stroke="#667a50"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <circle cx="-28" cy="1" r="5" fill={`url(#${id}-face)`} />
          <circle cx="26" cy="-3" r="5" fill={`url(#${id}-face)`} />
          <path d="M-17 23 Q0 30 17 22" fill="none" stroke="#4d4231" strokeWidth="4" />
          <rect x="-2" y="23" width="6" height="5" rx="1" fill="#d1ad58" />
          <path
            d="M-15-4 Q-23 9-13 18 L-9 14 Q-5 28 4 25 L3 19 Q19 17 16-5Z"
            fill={`url(#${id}-beard)`}
          />
          <path
            d="M-12 6 Q-13 13-9 16 M-3 9 Q-5 17 0 21 M8 6 Q12 11 8 16"
            fill="none"
            stroke="#b8aa8b"
            strokeWidth="1"
            opacity=".6"
          />
          <ellipse cy="-5" rx="15" ry="13" fill={`url(#${id}-face)`} />
          <path d="M-19-13 Q-11-30 0-43 Q4-34 12-29 L18-13Z" fill={`url(#${id}-hat)`} />
          <path
            d="M-14-17 Q-9-29-2-35"
            fill="none"
            stroke="#f1ae84"
            strokeWidth="3"
            opacity=".5"
            strokeLinecap="round"
          />
          <path
            d="M-18-13 Q0-19 18-13"
            fill="none"
            stroke="#773c32"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M-18-15 Q0-21 18-15"
            fill="none"
            stroke="#d9805d"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M-11-8 L-5-6 M5-6 L10-10"
            stroke="#4a3a2f"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <ellipse cx="-7" cy="-2" rx="2" ry="2.8" fill="#382f29" />
          <ellipse cx="8" cy="-3" rx="2" ry="2.8" fill="#382f29" />
          <ellipse cx="1" cy="2" rx="6" ry="4.5" fill="#c88d68" />
          <ellipse cy=".5" rx="3.5" ry="1.5" fill="#edbd92" />
          <ellipse cx="2" cy="10" rx="3" ry="3.5" fill="#725140" />
        </g>
        <g fill="none" strokeLinecap="round">
          <path
            d="M43 44 Q51 38 57 37 M49 53 L61 47"
            stroke="currentColor"
            strokeWidth="2.4"
            opacity=".65"
          />
          <path d="M78 81 L81 75 M85 83 L89 79" stroke="#d2a254" strokeWidth="2.5" />
        </g>
      </svg>
    </span>
  );
}
