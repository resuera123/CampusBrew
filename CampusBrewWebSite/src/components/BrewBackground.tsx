import type { CSSProperties } from "react";
import "../styles/brew-background.css";

interface Bubble {
  x: number;     // left position, %
  size: number;  // px
  time: number;  // seconds for one rise
  delay: number; // negative so bubbles are already mid-air on load
}

// Deterministic values (no Math.random), so the layout is stable between renders
const BUBBLES: Bubble[] = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  size: 10 + ((i * 13) % 5) * 8,
  time: 16 + ((i * 7) % 10),
  delay: -((i * 5) % 18),
}));

export default function BrewBackground() {
  return (
    <div className="brew-bg" aria-hidden="true">
      {/* Tiled line-art pattern, 240 x 240 per tile */}
      <svg className="brew-pattern" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="brew-tile" width="240" height="240" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {/* coffee cup + saucer + steam */}
              <g transform="translate(30 40)">
                <path d="M0 12 H40 V30 A20 20 0 0 1 0 30 Z" />
                <path d="M40 18 h6 a8 8 0 0 1 0 16 h-6" />
                <path d="M-6 56 H46" />
                <path d="M12 6 q-4 -5 0 -9" />
                <path d="M24 6 q-4 -5 0 -9" />
              </g>

              {/* coffee bean */}
              <g transform="translate(150 30) rotate(-30 20 14)">
                <ellipse cx="20" cy="14" rx="20" ry="13" />
                <path d="M2 14 C12 6 20 22 38 14" />
              </g>

              {/* delivery pin */}
              <g transform="translate(100 95)">
                <path d="M12 0 a12 12 0 0 1 12 12 c0 9 -12 22 -12 22 s-12 -13 -12 -22 a12 12 0 0 1 12 -12z" />
                <circle cx="12" cy="12" r="4" />
              </g>

              {/* boba cup with straw + pearls */}
              <g transform="translate(40 140)">
                <path d="M0 14 H36 L32 56 H4 Z" />
                <path d="M-2 14 H38" />
                <path d="M18 14 L26 -6" />
                <circle cx="10" cy="48" r="3" />
                <circle cx="18" cy="50" r="3" />
                <circle cx="26" cy="48" r="3" />
                <circle cx="14" cy="42" r="3" />
                <circle cx="23" cy="42" r="3" />
              </g>

              {/* leaf */}
              <g transform="translate(150 150)">
                <path d="M0 40 C0 10 20 0 40 0 C40 24 28 40 0 40 Z" />
                <path d="M0 40 L26 14" />
              </g>
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#brew-tile)" />
      </svg>

      {/* Floating bubbles */}
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="brew-bubble"
          style={
            {
              "--x": `${b.x}%`,
              "--s": `${b.size}px`,
              "--t": `${b.time}s`,
              "--delay": `${b.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      {/* Keeps the text readable */}
      <div className="brew-vignette" />
    </div>
  );
}