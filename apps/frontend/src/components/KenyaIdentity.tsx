export default function KenyaIdentity({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-48 h-48 md:w-64 md:h-64 ${className}`}>
      <svg
        viewBox="0 0 220 240"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <filter id="kenya-shadow" x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#000" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* 
          Kenya outline traced from actual geographic coordinates.
          Starting from the NW corner (South Sudan border), clockwise:
          - North: South Sudan → Ethiopia border (roughly straight)
          - NE: Ethiopia → Somalia tripoint
          - East: Somalia border angling SE
          - SE: Indian Ocean coastline (Lamu → Mombasa)
          - South: Tanzania border (straight west to Lake Victoria)
          - SW: Lake Victoria shoreline indent
          - West: Uganda border back north
        */}
        <path
          d={`
            M 42,58
            L 52,42
            L 58,32
            L 68,22
            L 82,16
            L 98,12
            L 112,14
            L 126,10
            L 140,16
            L 152,22
            L 158,28
            L 165,38
            L 170,48
            L 178,62
            L 184,78
            L 188,96
            L 190,112
            L 186,128
            L 180,142
            L 174,150
            L 168,156
            L 160,164
            L 154,170
            L 148,178
            L 138,186
            L 128,192
            L 118,198
            L 108,206
            L 96,212
            L 84,218
            L 72,222
            L 62,216
            L 54,208
            L 46,198
            L 40,188
            L 36,180
            L 30,172
            L 26,162
            L 22,150
            L 20,138
            L 22,126
            L 26,116
            L 30,108
            L 28,96
            L 30,84
            L 34,72
            L 38,64
            Z
          `}
          fill="#EAFBF0"
          stroke="#c6f0d4"
          strokeWidth="1.5"
          strokeLinejoin="round"
          filter="url(#kenya-shadow)"
        />

        {/* Subtle inner border for depth */}
        <path
          d={`
            M 42,58
            L 52,42
            L 58,32
            L 68,22
            L 82,16
            L 98,12
            L 112,14
            L 126,10
            L 140,16
            L 152,22
            L 158,28
            L 165,38
            L 170,48
            L 178,62
            L 184,78
            L 188,96
            L 190,112
            L 186,128
            L 180,142
            L 174,150
            L 168,156
            L 160,164
            L 154,170
            L 148,178
            L 138,186
            L 128,192
            L 118,198
            L 108,206
            L 96,212
            L 84,218
            L 72,222
            L 62,216
            L 54,208
            L 46,198
            L 40,188
            L 36,180
            L 30,172
            L 26,162
            L 22,150
            L 20,138
            L 22,126
            L 26,116
            L 30,108
            L 28,96
            L 30,84
            L 34,72
            L 38,64
            Z
          `}
          fill="none"
          stroke="#d4f5e0"
          strokeWidth="3"
          strokeLinejoin="round"
          opacity="0.5"
        />

        {/* Kenya Flag - drawn entirely in SVG */}
        <g transform="translate(75, 88)">
          {/* Flag background with rounded corners */}
          <rect x="0" y="0" width="70" height="46" rx="4" ry="4" fill="#fff" />
          
          {/* Black stripe */}
          <clipPath id="flag-clip">
            <rect x="0" y="0" width="70" height="46" rx="4" ry="4" />
          </clipPath>
          <g clipPath="url(#flag-clip)">
            <rect x="0" y="0" width="70" height="12" fill="#000" />
            {/* White thin stripe */}
            <rect x="0" y="12" width="70" height="2" fill="#fff" />
            {/* Red stripe */}
            <rect x="0" y="14" width="70" height="16" fill="#BB1A34" />
            {/* White thin stripe */}
            <rect x="0" y="30" width="70" height="2" fill="#fff" />
            {/* Green stripe */}
            <rect x="0" y="32" width="70" height="14" fill="#006B3F" />

            {/* Maasai Shield & Spears (centered) */}
            <g transform="translate(35, 23)">
              {/* Spears behind shield */}
              <line x1="-2" y1="-18" x2="-2" y2="18" stroke="#000" strokeWidth="1.2" />
              <line x1="2" y1="-18" x2="2" y2="18" stroke="#000" strokeWidth="1.2" />
              {/* Spear tips */}
              <polygon points="-2,-18 -4,-22 0,-22" fill="#888" />
              <polygon points="2,-18 0,-22 4,-22" fill="#888" />

              {/* Shield shape */}
              <ellipse cx="0" cy="0" rx="8" ry="14" fill="#BB1A34" stroke="#000" strokeWidth="1" />
              {/* Shield center line */}
              <line x1="0" y1="-14" x2="0" y2="14" stroke="#000" strokeWidth="1.5" />
              {/* Shield horizontal decorations */}
              <line x1="-5" y1="-4" x2="5" y2="-4" stroke="#fff" strokeWidth="0.8" />
              <line x1="-5" y1="4" x2="5" y2="4" stroke="#fff" strokeWidth="0.8" />
            </g>
          </g>

          {/* Flag subtle shadow */}
          <rect x="0" y="0" width="70" height="46" rx="4" ry="4" fill="none" stroke="#00000010" strokeWidth="1" />
        </g>

        {/* Location dot: Nairobi */}
        <circle cx="118" cy="160" r="4" fill="#16a34a" opacity="0.7" />
        <circle cx="118" cy="160" r="2" fill="#16a34a" />

        {/* Location dot: Mombasa */}
        <circle cx="155" cy="172" r="3" fill="#16a34a" opacity="0.5" />
        <circle cx="155" cy="172" r="1.5" fill="#16a34a" />
      </svg>
    </div>
  );
}
