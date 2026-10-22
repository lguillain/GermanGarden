import { useId } from 'react';
import { GnomePaints } from './gnome-paints';

export function GnomeVariant({ variant, hat }: { variant: number; hat: string }) {
  const id = `gnome-variant-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const paint = (material: string) => `url(#${id}-${material})`;
  const skin = paint('skin');
  const beard = paint('beard');
  const coat = ['#748463', '#96735a', '#89915c', '#807a91', '#bd925c'][variant];
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <GnomePaints id={id} hat={hat} coat={coat} />
      <ellipse cx="90" cy="179" rx="59" ry="10" fill="#40372a" opacity=".13" />
      {variant === 0 && (
        <>
          <path
            d="M45 172 V65 M38 65 Q45 51 52 65Z"
            fill="none"
            stroke={paint('wood')}
            strokeWidth="6"
          />
          <path
            d="M34 151 H56 V169 L45 183 L34 169Z"
            fill={paint('metal')}
            stroke="#53634c"
            strokeWidth="2"
          />
          <path d="M67 119 H117 L126 167 H58Z" fill={paint('coat')} />
          <path d="M65 165 L57 178 H84 V164 M100 164 V178 H129 L117 165" fill={paint('boots')} />
          <path d="M63 123 L45 131 M117 123 L127 145" stroke={skin} strokeWidth="12" />
          <path d="M67 143 H119" stroke="#453d32" strokeWidth="9" />
          <rect x="85" y="138" width="14" height="11" rx="2" fill={paint('gold')} />
          <path d="M67 94 H116 V119 L103 136 H80 L67 119Z" fill={beard} />
          <ellipse cx="91" cy="94" rx="25" ry="22" fill={skin} />
          <path d="M62 84 L78 29 L103 45 L121 84Z" fill={paint('hat')} />
          <path d="M64 84 H119" stroke={hat} strokeWidth="7" />
          <path d="M75 92 L84 95 M99 95 L108 91" stroke="#44392f" strokeWidth="4" />
          <circle cx="81" cy="100" r="2.4" />
          <circle cx="103" cy="100" r="2.4" />
          <ellipse cx="92" cy="107" rx="9" ry="7" fill={paint('nose')} />
          <path d="M82 120 H103" stroke="#685144" strokeWidth="3" />
        </>
      )}
      {variant === 1 && (
        <>
          <path d="M114 119 Q139 103 154 130 L160 165 Q139 185 111 168Z" fill={paint('sack')} />
          <path
            d="M127 116 L125 102 L139 105 L145 119"
            fill={paint('sack')}
            stroke="#8e7147"
            strokeWidth="3"
          />
          <path d="M128 119 L143 123 M146 146 L148 157" stroke="#7c663f" strokeWidth="3" />
          <path d="M65 119 Q94 110 111 129 L116 166 L63 166Z" fill={paint('coat')} />
          <path
            d="M68 162 L52 174 Q50 181 79 176 L86 162 M96 163 L100 177 H124 L112 163"
            fill={paint('boots')}
          />
          <path
            d="M68 128 L57 144 L72 148 M108 130 L127 120"
            fill="none"
            stroke={skin}
            strokeWidth="10"
          />
          <path d="M67 96 L111 102 Q110 131 80 146 L86 124 Q66 122 67 96" fill={beard} />
          <ellipse cx="87" cy="95" rx="24" ry="21" fill={skin} />
          <path
            d="M59 84 Q68 44 102 43 Q127 41 125 66 L109 60 Q92 55 115 91Z"
            fill={paint('hat')}
          />
          <path d="M60 85 L112 91" stroke={hat} strokeWidth="6" />
          <path d="M70 94 L80 97 M93 96 L104 92" stroke="#44392f" strokeWidth="3" />
          <circle cx="77" cy="101" r="2.3" />
          <circle cx="99" cy="101" r="2.3" />
          <ellipse cx="90" cy="108" rx="9" ry="6" fill={paint('nose')} />
          <path d="M84 119 Q96 127 105 114" fill="none" stroke="#685144" strokeWidth="2.5" />
        </>
      )}
      {variant === 2 && (
        <>
          <ellipse cx="90" cy="143" rx="43" ry="32" fill={paint('coat')} />
          <path
            d="M60 164 L42 174 Q45 183 77 177 L79 165 M104 165 L107 178 Q138 182 141 174 L122 165"
            fill={paint('boots')}
          />
          <path
            d="M53 132 Q69 147 90 143 Q112 147 127 131"
            fill="none"
            stroke={skin}
            strokeWidth="12"
          />
          <path d="M66 104 Q52 128 78 134 L91 142 L105 134 Q130 127 115 104" fill={beard} />
          <ellipse cx="91" cy="101" rx="29" ry="23" fill={skin} />
          <path
            d="M48 92 Q59 69 79 64 Q95 35 116 63 L128 81 L143 96 Q95 107 48 92Z"
            fill={paint('hat')}
          />
          <path d="M50 93 Q94 106 141 96" stroke={hat} strokeWidth="6" fill="none" />
          <path d="M69 107 L80 108 M102 108 L113 105" stroke="#44392f" strokeWidth="3" />
          <ellipse cx="92" cy="116" rx="11" ry="8" fill={paint('nose')} />
          <path d="M90 130 Q99 133 105 127" fill="none" stroke="#685144" strokeWidth="2.5" />
        </>
      )}
      {variant === 3 && (
        <>
          <path
            d="M136 177 L129 85 L141 69 L133 59 L122 70"
            fill="none"
            stroke={paint('wood')}
            strokeWidth="6"
          />
          <path d="M70 111 H108 L122 175 H54Z" fill={paint('coat')} />
          <path d="M60 175 H81 M98 175 H121" stroke="#3c3933" strokeWidth="9" />
          <path d="M70 120 L50 137 M108 122 L132 119" stroke={skin} strokeWidth="9" />
          <path d="M66 93 H111 Q117 125 96 161 L89 143 L76 169 Q78 134 66 93" fill={beard} />
          <ellipse cx="89" cy="91" rx="21" ry="19" fill={skin} />
          <path d="M62 80 Q78 47 85 13 L99 32 L99 48 L115 82Z" fill={paint('hat')} />
          <path d="M63 80 L113 82" stroke={hat} strokeWidth="6" />
          <path
            d="M87 43 L90 48 L96 48 L91 52 L93 58 L87 54 L82 57 L83 51 L79 47 L85 47Z"
            fill={paint('gold')}
          />
          <path d="M73 91 L82 94 M96 94 L105 89" stroke="#44392f" strokeWidth="3" />
          <circle cx="79" cy="99" r="2" />
          <circle cx="100" cy="98" r="2" />
          <ellipse cx="89" cy="106" rx="8" ry="7" fill={paint('nose')} />
          <path d="M83 120 Q91 116 98 120" fill="none" stroke="#685144" strokeWidth="2" />
        </>
      )}
      {variant === 4 && (
        <>
          <path d="M65 116 H109 L116 164 H57Z" fill={paint('coat')} />
          <path
            d="M62 163 L52 176 H80 L82 163 M96 163 L100 178 H126 L112 163"
            fill={paint('boots')}
          />
          <path d="M63 124 L49 144 M109 125 L124 139" stroke={skin} strokeWidth="11" />
          <path d="M71 116 L74 143 H103 L105 116" fill="none" stroke="#586652" strokeWidth="7" />
          <ellipse cx="88" cy="95" rx="25" ry="25" fill={skin} />
          <path d="M59 83 Q64 51 95 49 Q118 47 140 70 L117 68 L113 88Z" fill={paint('hat')} />
          <path d="M61 84 L113 88" stroke={hat} strokeWidth="7" />
          <path d="M71 94 L80 96 M96 96 L106 92" stroke="#44392f" strokeWidth="3" />
          <circle cx="77" cy="101" r="2" />
          <circle cx="102" cy="100" r="2" />
          <path
            d="M87 110 Q71 102 66 114 Q67 124 81 118 M89 110 Q106 103 113 112 Q116 123 99 119"
            fill="#6c5747"
          />
          <ellipse cx="89" cy="106" rx="9" ry="7" fill={paint('nose')} />
          <path d="M83 126 Q91 130 99 123" fill="none" stroke="#685144" strokeWidth="2" />
          <path
            d="M119 148 Q106 126 123 125 Q139 124 137 146"
            fill="none"
            stroke="#647c75"
            strokeWidth="5"
          />
          <path
            d="M111 145 H140 V173 H111Z M140 156 L157 143 L163 147 L142 170"
            fill={paint('metal')}
            stroke="#56746b"
            strokeWidth="2"
          />
          <ellipse cx="162" cy="144" rx="5" ry="8" transform="rotate(40 162 144)" fill="#56746b" />
        </>
      )}
      <g fill="none">
        {variant === 0 && (
          <>
            <path d="M70 76 L80 40 L96 49" stroke="#fff1d0" opacity=".28" strokeWidth="3" />
            <path d="M68 87 H115" stroke="#4b3030" opacity=".35" strokeWidth="2" />
            <path
              d="M73 117 L78 126 M84 123 L87 131 M101 123 L98 130 M110 116 L105 125"
              stroke="#b4a48a"
              strokeWidth="1.3"
            />
            <path
              d="M65 150 L63 162 M114 150 L120 163"
              stroke="#c4cf9f"
              opacity=".5"
              strokeWidth="2"
            />
            <path
              d="M68 154 H112"
              stroke="#c4cf9f"
              opacity=".5"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <rect x="89" y="141" width="6" height="5" rx=".5" fill="#594c35" />
            <path d="M38 155 H45 V176 M43 76 V140" stroke="#dbe5ce" opacity=".55" strokeWidth="2" />
            <path d="M47 155 V169 L51 165" stroke="#435e51" opacity=".5" />
            <path d="M62 174 H80 M104 174 H120" stroke="#b39b7b" opacity=".6" strokeWidth="1.5" />
          </>
        )}
        {variant === 1 && (
          <>
            <path
              d="M67 78 Q74 50 102 49 Q115 48 119 55"
              stroke="#fff1d0"
              opacity=".28"
              strokeWidth="3"
            />
            <path d="M63 88 L109 93" stroke="#3c3429" opacity=".35" strokeWidth="2" />
            <path
              d="M73 119 Q78 124 82 125 M99 124 Q95 132 86 138"
              stroke="#b4a48a"
              strokeWidth="1.4"
            />
            <path
              d="M71 150 L69 160 M107 142 L110 162"
              stroke="#dabd8e"
              opacity=".45"
              strokeWidth="2"
            />
            <path d="M75 153 L101 158" stroke="#433b30" strokeWidth="4" />
            <path
              d="M120 129 Q115 145 119 160 M128 130 Q123 139 126 148"
              stroke="#f6dfb3"
              opacity=".5"
              strokeWidth="2.5"
            />
            <path
              d="M145 131 Q154 150 150 166"
              stroke="#735334"
              opacity=".5"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <path
              d="M128 119 Q146 126 146 116 Q144 110 137 120 Q129 128 143 134"
              stroke="#7c603b"
              strokeWidth="2"
            />
            <ellipse
              cx="139"
              cy="151"
              rx="9"
              ry="11"
              fill="#e6cc97"
              stroke="#947549"
              strokeDasharray="2 2"
            />
            <path
              d="M139 157 V146 M139 151 Q129 144 134 145 M139 149 Q147 140 145 147"
              stroke="#6d8152"
              strokeWidth="1.5"
            />
            <path
              d="M58 174 L75 171 M105 173 H118"
              stroke="#b39b7b"
              opacity=".6"
              strokeWidth="1.5"
            />
          </>
        )}
        {variant === 2 && (
          <>
            <path
              d="M62 87 Q75 78 83 69 Q97 46 111 65"
              stroke="#fff1d0"
              opacity=".3"
              strokeWidth="4"
            />
            <path d="M56 97 Q96 107 135 100" stroke="#4b392a" opacity=".35" strokeWidth="2" />
            <path
              d="M113 73 L122 87 M73 90 L67 92"
              stroke="#59432d"
              opacity=".25"
              strokeWidth="2"
            />
            <path
              d="M69 125 Q71 131 77 131 M83 133 L90 137 M107 125 L102 133"
              stroke="#b4a48a"
              strokeWidth="1.3"
            />
            <path d="M61 151 Q89 170 121 151" stroke="#c4cf9f" opacity=".45" strokeWidth="2" />
            <path d="M73 165 Q91 172 110 164" stroke="#46563c" opacity=".6" strokeWidth="2" />
            <circle cx="91" cy="155" r="2.5" fill={paint('gold')} />
            <path
              d="M51 174 L72 173 M112 174 L132 174"
              stroke="#b39b7b"
              opacity=".65"
              strokeWidth="2"
            />
          </>
        )}
        {variant === 3 && (
          <>
            <path d="M71 73 Q82 47 85 25 L93 36" stroke="#fff1d0" opacity=".28" strokeWidth="3" />
            <path d="M66 83 L110 85" stroke="#3b2d43" opacity=".4" strokeWidth="2" />
            <path
              d="M77 117 Q84 130 80 152 M88 126 L95 146 M103 116 Q104 128 99 136"
              stroke="#b4a48a"
              strokeWidth="1.4"
            />
            <path
              d="M67 147 L63 168 M109 142 L115 167"
              stroke="#bfb2cc"
              opacity=".45"
              strokeWidth="2"
            />
            <path
              d="M59 170 H116"
              stroke="#d3bd79"
              opacity=".65"
              strokeWidth="1.5"
              strokeDasharray="2 4"
            />
            <path d="M133 168 L128 86 L138 70" stroke="#e3c58d" opacity=".55" strokeWidth="1.5" />
            <path
              d="M127 110 L133 109 M128 114 L134 113 M128 118 L134 117"
              stroke="#c8ab79"
              strokeWidth="2"
            />
            <path d="M64 173 H78 M101 173 H115" stroke="#b39b7b" opacity=".6" strokeWidth="1.5" />
          </>
        )}
        {variant === 4 && (
          <>
            <path
              d="M68 78 Q72 56 98 55 Q113 54 125 62"
              stroke="#fff1d0"
              opacity=".28"
              strokeWidth="3"
            />
            <path d="M65 87 L109 91" stroke="#2d3947" opacity=".4" strokeWidth="2" />
            <path
              d="M72 113 Q76 110 82 113 M98 112 Q105 108 110 114"
              stroke="#bea584"
              opacity=".65"
              strokeWidth="1.5"
            />
            <path
              d="M66 150 L64 159 M108 149 L111 160"
              stroke="#f2d2a0"
              opacity=".5"
              strokeWidth="2"
            />
            <path d="M79 147 H98 V159 H79Z" stroke="#4b5f45" strokeWidth="1.5" />
            <path d="M81 150 H96" stroke="#e6c894" opacity=".6" strokeDasharray="2 2" />
            <path d="M115 149 V169 M120 150 V166" stroke="#d8e4ca" opacity=".55" strokeWidth="2" />
            <ellipse
              cx="125.5"
              cy="145"
              rx="14"
              ry="3"
              fill={paint('metal')}
              stroke="#d0dbc3"
              strokeWidth="1"
            />
            <path
              d="M113 171 H138 M144 157 L156 147"
              stroke="#3e6052"
              opacity=".55"
              strokeWidth="1.5"
            />
            <path d="M118 134 Q121 128 127 130" stroke="#c4d4bd" opacity=".65" strokeWidth="1.5" />
            <path d="M58 173 H75 M105 175 H120" stroke="#b39b7b" opacity=".6" strokeWidth="1.5" />
          </>
        )}
      </g>
    </g>
  );
}
