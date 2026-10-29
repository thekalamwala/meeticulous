// ErrorIllustration — calm, lightweight inline SVG line-art per error category.
//
// Keyed by the `art` field in errorCatalog.js. Strokes use currentColor so the
// art inherits the page's text colour (works in light + dark). Brand-orange
// accents come from the --bas-error-accent CSS var (see error-pages.css), so a
// single token controls the highlight across every illustration.
//
// Adding art for a new category = add a case here + reference its key in the
// catalog. No other wiring.

import { useState } from 'react';
import { pickErrorImage } from '../../config/errorCatalog';

const SIZE = 132;

function Frame({ children, label }) {
  return (
    <svg
      className="bas-error-art"
      width={SIZE}
      height={SIZE}
      viewBox="0 0 140 140"
      fill="none"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* soft halo */}
      <circle cx="70" cy="70" r="58" className="bas-error-art__halo" />
      {children}
    </svg>
  );
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
};
const accent = { stroke: 'var(--bas-error-accent)' };
const accentFill = { fill: 'var(--bas-error-accent)' };

// A small hanging sloth — the recurring brand motif, reused where it fits.
function Sloth({ x = 0, y = 0 }) {
  return (
    <g transform={`translate(${x} ${y})`} style={stroke}>
      <ellipse cx="70" cy="78" rx="20" ry="23" />
      <circle cx="63" cy="74" r="3.2" style={{ ...stroke, ...accentFill, strokeWidth: 0 }} />
      <circle cx="77" cy="74" r="3.2" style={{ ...stroke, ...accentFill, strokeWidth: 0 }} />
      <path d="M64 86 q6 5 12 0" />
      {/* arms gripping the branch above */}
      <path d="M56 64 q-8 -14 4 -20" />
      <path d="M84 64 q8 -14 -4 -20" />
    </g>
  );
}

function Branch() {
  return <path d="M22 40 q48 -10 96 0" style={{ ...stroke, ...accent }} />;
}

const ART = {
  // 404 / 410 — lost: a signpost with a wandering dotted trail.
  lost: (
    <Frame label="Lost">
      <path d="M70 36 v66" style={stroke} />
      <path d="M70 50 h34 l-9 10 9 10 h-34" style={{ ...stroke, ...accent }} />
      <path
        d="M48 112 q14 -10 28 -2 t26 -4"
        style={{ ...stroke, strokeDasharray: '2 9' }}
      />
      <circle cx="70" cy="110" r="3.5" style={accentFill} />
    </Frame>
  ),

  // 401 / 403 — locked: a calm padlock.
  locked: (
    <Frame label="Locked">
      <rect x="44" y="66" width="52" height="40" rx="8" style={stroke} />
      <path d="M54 66 v-10 a16 16 0 0 1 32 0 v10" style={{ ...stroke, ...accent }} />
      <circle cx="70" cy="84" r="5" style={accentFill} />
      <path d="M70 89 v8" style={stroke} />
    </Frame>
  ),

  // 400 / 405 — confused: a gentle question spark.
  confused: (
    <Frame label="Confused">
      <path
        d="M58 60 a12 12 0 1 1 16 11 q-4 2 -4 8"
        style={{ ...stroke, ...accent }}
      />
      <circle cx="70" cy="92" r="3.5" style={accentFill} />
      <path d="M40 44 l5 5 M100 44 l-5 5 M44 96 l5 -5 M96 96 l-5 -5" style={stroke} />
    </Frame>
  ),

  // 409 — sync: two arrows chasing in a circle.
  sync: (
    <Frame label="Out of sync">
      <path d="M44 62 a28 28 0 0 1 52 -6" style={{ ...stroke, ...accent }} />
      <path d="M96 38 v18 h-18" style={{ ...stroke, ...accent }} />
      <path d="M96 78 a28 28 0 0 1 -52 6" style={stroke} />
      <path d="M44 102 v-18 h18" style={stroke} />
    </Frame>
  ),

  // 408 / 429 / 504 — timeout: an unhurried clock.
  timeout: (
    <Frame label="Timed out">
      <circle cx="70" cy="74" r="30" style={stroke} />
      <path d="M70 56 v18 l14 8" style={{ ...stroke, ...accent }} />
      <path d="M70 38 v-6 M58 32 h24" style={stroke} />
    </Frame>
  ),

  // 413 / 415 — upload: a file with an up-arrow.
  upload: (
    <Frame label="Upload">
      <path d="M50 44 h26 l14 14 v44 a4 4 0 0 1 -4 4 h-36 a4 4 0 0 1 -4 -4 z" style={stroke} />
      <path d="M76 44 v14 h14" style={stroke} />
      <path d="M70 96 v-24 m-9 9 l9 -9 9 9" style={{ ...stroke, ...accent }} />
    </Frame>
  ),

  // 422 — form: a checklist needing one fix.
  form: (
    <Frame label="Review form">
      <rect x="46" y="42" width="48" height="60" rx="6" style={stroke} />
      <path d="M56 58 h28 M56 72 h28 M56 86 h16" style={stroke} />
      <circle cx="92" cy="92" r="13" style={{ ...stroke, ...accent }} />
      <path d="M92 86 v7 M92 98 v0.5" style={{ ...stroke, ...accent }} />
    </Frame>
  ),

  // 500 / 502 — napping: the sloth asleep on a branch with zzz.
  napping: (
    <Frame label="Taking a nap">
      <Branch />
      <Sloth />
      <path d="M96 44 h10 l-10 10 h10" style={{ ...stroke, ...accent, strokeWidth: 2.4 }} />
      <path d="M108 30 h7 l-7 7 h7" style={{ ...stroke, ...accent, strokeWidth: 2 }} />
    </Frame>
  ),

  // 503 — maintenance: a friendly wrench.
  maintenance: (
    <Frame label="Under maintenance">
      <path
        d="M86 52 a14 14 0 0 0 -19 18 l-22 22 a6 6 0 0 0 8 8 l22 -22 a14 14 0 0 0 18 -19 l-9 9 -6 -6 z"
        style={{ ...stroke, ...accent }}
      />
      <circle cx="52" cy="96" r="2.6" style={accentFill} />
    </Frame>
  ),

  // offline — a cloud with a disconnect slash.
  offline: (
    <Frame label="Offline">
      <path d="M48 86 a16 16 0 0 1 4 -31 a20 20 0 0 1 37 6 a13 13 0 0 1 -3 25 z" style={stroke} />
      <path d="M40 44 l60 60" style={{ ...stroke, ...accent }} />
    </Frame>
  ),
};

export default function ErrorIllustration({ art, image = false }) {
  // Stable within a mount, fresh per visit — never pick in render body.
  const [src] = useState(() => (image ? pickErrorImage() : null));
  if (image) {
    return (
      <img
        src={src}
        alt=""
        width={SIZE}
        height={SIZE}
        loading="eager"
        className="bas-error-art"
      />
    );
  }
  return ART[art] || ART.confused;
}
