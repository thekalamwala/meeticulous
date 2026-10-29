// Auto-generated SVG thumbnails for blog post heroes.
// Replaces the sloth-emoji fallback in BlogPost.jsx HeroVisual.
// Uses SVG <pattern> for grids/dots to keep DOM node count low.

const ICONS = {
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  server: 'M2 4h20v5H2zm0 7h20v5H2zm0 7h20v2H2zM6 6.5h.01M6 13.5h.01',
  database: 'M12 2C6.48 2 2 3.79 2 6v12c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4zM2 10c0 2.21 4.48 4 10 4s10-1.79 10-4M2 14c0 2.21 4.48 4 10 4s10-1.79 10-4',
  api: 'M10 20l4-16M18 8l4 4-4 4M6 16l-4-4 4-4',
  git: 'M12 3v18M3 12h18M7 7l10 10M17 7L7 17',
  chart: 'M3 3v18h18M7 16V9m4 7V5m4 11v-4m4 4V8',
  money: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  megaphone: 'M3 11l18-5v14L3 15v-4zM11.6 16.8a3 3 0 11-5.8-1.6',
  rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3M22 2l-7.5 7.5M15 2H22v7M8.5 8.5C4.4 12.6 3.5 17 3.5 17L7 20.5s4.4-.9 8.5-5',
  target: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  calendar: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  lightning: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  palette: 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zM8 13a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm2-5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  lock: 'M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1zM8 11V7a4 4 0 118 0v4M12 15v3',
  key: 'M12.5 11.5a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L19 5m0 0l3 3 2-2-3-3-2 2zm0 0l2.5 2.5',
  bug: 'M8 6V5a4 4 0 018 0v1M6 6h12v6a6 6 0 01-12 0V6zM3 9h3M18 9h3M3 15h3M18 15h3M12 12v6',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
  clipboard: 'M9 4H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1zM9 12h6M9 16h4',
  wallet: 'M3 6a2 2 0 012-2h13v4M3 6v13a2 2 0 002 2h15v-5M3 6h17a1 1 0 011 1v3M17 12h5v4h-5a2 2 0 010-4z',
  coins: 'M9 13a6 6 0 100-12 6 6 0 000 12zM9 5v4M15.5 8.1a6 6 0 11-6.4 10.4M17 15v4M15 17h4',
  'trending-up': 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  scale: 'M12 3v18M8 21h8M3 7h18M6.5 7L3 14h7L6.5 7zM17.5 7L14 14h7l-3.5-7z',
  columns: 'M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zM12 3v18',
  trophy: 'M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M6 4h12v5a6 6 0 01-12 0V4zM9 21h6M12 15v6',
  heart: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l8.84 8.84 8.84-8.84a5.5 5.5 0 000-7.78z',
  quote: 'M8 3H4a2 2 0 00-2 2v6a2 2 0 002 2h4c0 5-2 7-5 8M20 3h-4a2 2 0 00-2 2v6a2 2 0 002 2h4c0 5-2 7-5 8',
  'user-check': 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM17 11l2 2 4-4',
};

// Six entries per category are a POOL, not a render list — `pickIcons` draws a
// slug-stable subset so two posts in the same category don't get identical art.
const CATEGORY_DEFAULTS = {
  News:             ['rocket', 'megaphone', 'star'],
  Product:          ['calendar', 'users', 'lightning'],
  'Feature Update': ['lightning', 'code', 'bell'],
  Guide:            ['chart', 'target', 'rocket'],
  Growth:           ['megaphone', 'money', 'target'],
  Engineering:      ['server', 'database', 'terminal'],
  Internal:         ['palette', 'star', 'code'],
  Security:         ['server', 'star', 'database', 'shield', 'lock', 'key'],
  Postmortem:       ['server', 'terminal', 'bell', 'bug', 'search', 'clipboard'],
  Money:            ['money', 'chart', 'lightning', 'wallet', 'coins', 'trending-up'],
  Comparison:       ['chart', 'target', 'money', 'scale', 'columns', 'trophy'],
  'Host Story':     ['users', 'star', 'calendar', 'heart', 'quote', 'user-check'],
};

// PatternGridCrosshairs lays every icon in one row, so an unbounded pool would
// overflow the card. Cap at 3, rotating the start by slug hash for variety.
// Pools of <=3 pass through untouched, keeping every pre-existing post's art identical.
const MAX_ICONS = 3;
export const pickIcons = (pool, hash) => (
  pool.length <= MAX_ICONS
    ? pool
    : Array.from({ length: MAX_ICONS }, (_, i) => pool[(hash + i) % pool.length])
);

const hashSlug = (slug) => {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

const darken = (hex, pct) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 1 - pct;
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
};
const lighten = (hex, pct) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * pct)},${Math.round(g + (255 - g) * pct)},${Math.round(b + (255 - b) * pct)})`;
};

const IconCard = ({ x, y, size, iconKey, accent }) => {
  const path = ICONS[iconKey];
  if (!path) return null;
  const pad = size * 0.22;
  const iconSize = size - pad * 2;
  return (
    <g>
      <rect
        x={x} y={y} width={size} height={size} rx={size * 0.16}
        fill="#fff" stroke="rgba(0,0,0,0.08)" strokeWidth="1"
      />
      <svg x={x + pad} y={y + pad} width={iconSize} height={iconSize} viewBox="0 0 24 24">
        <path d={path} fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </g>
  );
};

// Crosshair marker at a grid intersection
const Crosshair = ({ cx, cy, size, color }) => (
  <g>
    <circle cx={cx} cy={cy} r={size * 0.35} fill="none" stroke={color} strokeWidth="0.8" />
    <circle cx={cx} cy={cy} r={2} fill={color} />
    <line x1={cx - size / 2} y1={cy} x2={cx + size / 2} y2={cy} stroke={color} strokeWidth="0.5" />
    <line x1={cx} y1={cy - size / 2} x2={cx} y2={cy + size / 2} stroke={color} strokeWidth="0.5" />
  </g>
);

// ── Pattern 0: Grid + Crosshairs (3 icons center row) ──────────────
const PatternGridCrosshairs = ({ icons, accent, gridColor, bg, w, h, pid }) => {
  const sp = 80;
  const cardSize = 72;
  const gap = 16;
  const totalW = icons.length * cardSize + (icons.length - 1) * gap;
  const startX = (w - totalW) / 2;
  const centerY = h / 2 - cardSize / 2;

  // Pre-compute crosshair positions (only at every-3rd intersection, outside center)
  const crosshairs = [];
  const cols = Math.ceil(w / sp) + 1;
  const rows = Math.ceil(h / sp) + 1;
  for (let ci = 0; ci < cols; ci++) {
    for (let ri = 0; ri < rows; ri++) {
      if ((ci + ri) % 3 !== 0) continue;
      const cx = ci * sp;
      const cy = ri * sp;
      if (cx > startX - 40 && cx < startX + totalW + 40 &&
          cy > centerY - 40 && cy < centerY + cardSize + 40) continue;
      crosshairs.push({ cx, cy });
    }
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={`grid-${pid}`} width={sp} height={sp} patternUnits="userSpaceOnUse">
          <line x1={sp} y1={0} x2={sp} y2={sp} stroke={gridColor} strokeWidth="0.5" />
          <line x1={0} y1={sp} x2={sp} y2={sp} stroke={gridColor} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={bg} />
      <rect width={w} height={h} fill={`url(#grid-${pid})`} />
      {crosshairs.map((c, i) => (
        <Crosshair key={i} cx={c.cx} cy={c.cy} size={36} color={gridColor} />
      ))}
      {icons.map((key, i) => (
        <IconCard key={key} x={startX + i * (cardSize + gap)} y={centerY} size={cardSize} iconKey={key} accent={accent} />
      ))}
    </svg>
  );
};

// ── Pattern 1: Center Focus (single large icon, axis lines, dot grid) ──
const PatternCenterFocus = ({ icons, accent, gridColor, bg, w, h, pid }) => {
  const cardSize = 100;
  const cx = w / 2;
  const cy = h / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={`dots-${pid}`} width={16} height={16} patternUnits="userSpaceOnUse">
          <circle cx={8} cy={8} r={0.6} fill={gridColor} />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={bg} />
      <rect width={w} height={h} fill={`url(#dots-${pid})`} />
      <line x1={cx} y1={0} x2={cx} y2={h} stroke={gridColor} strokeWidth="1" />
      <line x1={0} y1={cy} x2={w} y2={cy} stroke={gridColor} strokeWidth="1" />
      <IconCard x={cx - cardSize / 2} y={cy - cardSize / 2} size={cardSize} iconKey={icons[0]} accent={accent} />
    </svg>
  );
};

// ── Pattern 2: Duo Connected (2 icons linked by line, line grid) ────
const PatternDuoConnected = ({ icons, accent, gridColor, bg, w, h, pid }) => {
  const cardSize = 80;
  const cy = h / 2 - cardSize / 2;
  const gap = 60;
  const x1 = w / 2 - cardSize - gap / 2;
  const x2 = w / 2 + gap / 2;
  const sp = 24;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={`fgrid-${pid}`} width={sp} height={sp} patternUnits="userSpaceOnUse">
          <line x1={sp} y1={0} x2={sp} y2={sp} stroke={gridColor} strokeWidth="0.3" />
          <line x1={0} y1={sp} x2={sp} y2={sp} stroke={gridColor} strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={bg} />
      <rect width={w} height={h} fill={`url(#fgrid-${pid})`} />
      <line x1={x1 + cardSize} y1={h / 2} x2={x2} y2={h / 2} stroke={gridColor} strokeWidth="1.5" />
      <IconCard x={x1} y={cy} size={cardSize} iconKey={icons[0] || 'code'} accent={accent} />
      <IconCard x={x2} y={cy} size={cardSize} iconKey={icons[1] || 'rocket'} accent={accent} />
    </svg>
  );
};

// ── Pattern 3: Scatter (2-4 icons at varied positions, connectors, dot grid) ──
const PatternScatter = ({ icons, accent, gridColor, bg, w, h, pid }) => {
  const cardSize = 60;
  const positions = [
    { x: w * 0.2 - cardSize / 2, y: h * 0.3 - cardSize / 2 },
    { x: w * 0.7 - cardSize / 2, y: h * 0.25 - cardSize / 2 },
    { x: w * 0.35 - cardSize / 2, y: h * 0.7 - cardSize / 2 },
    { x: w * 0.75 - cardSize / 2, y: h * 0.68 - cardSize / 2 },
  ];
  const usedIcons = icons.slice(0, positions.length);
  const usedPos = positions.slice(0, usedIcons.length);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={`sdots-${pid}`} width={20} height={20} patternUnits="userSpaceOnUse">
          <circle cx={10} cy={10} r={0.8} fill={gridColor} />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={bg} />
      <rect width={w} height={h} fill={`url(#sdots-${pid})`} />
      {usedPos.length > 1 && usedPos.map((p, i) => {
        if (i === 0) return null;
        const prev = usedPos[i - 1];
        return (
          <line key={`ln${i}`}
            x1={prev.x + cardSize / 2} y1={prev.y + cardSize / 2}
            x2={p.x + cardSize / 2} y2={p.y + cardSize / 2}
            stroke={gridColor} strokeWidth="1"
          />
        );
      })}
      {usedIcons.map((key, i) => (
        <IconCard key={key} x={usedPos[i].x} y={usedPos[i].y} size={cardSize} iconKey={key} accent={accent} />
      ))}
    </svg>
  );
};

const PATTERNS = [PatternGridCrosshairs, PatternCenterFocus, PatternDuoConnected, PatternScatter];

// w/h are the pattern canvas, not CSS pixels — patterns lay themselves out
// against it, so a wide short card (the /blog index) passes a wide short box
// instead of letterboxing the tall hero canvas.
const BlogHeroThumbnail = ({ post, theme, w = 600, h = 500 }) => {
  const hash = hashSlug(post.slug);
  // `blogs.icons` defaults to jsonb '[]', and [] is truthy — a length check, not
  // `||`, is what actually falls back to the category pool for admin-created posts.
  const pool = post.icons?.length ? post.icons : (CATEGORY_DEFAULTS[post.category] || CATEGORY_DEFAULTS.News);
  const icons = pickIcons(pool, hash);
  const patternIdx = hash % PATTERNS.length;
  const Pattern = PATTERNS[patternIdx];

  const bg = theme.light ? lighten(theme.band, 0.88) : darken(theme.band, 0.82);
  const gridColor = theme.light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';
  const accent = theme.accent;
  const pid = post.slug.slice(0, 8);

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: bg }}>
      <Pattern icons={icons} accent={accent} gridColor={gridColor} bg={bg} w={w} h={h} pid={pid} />
    </div>
  );
};

export default BlogHeroThumbnail;
