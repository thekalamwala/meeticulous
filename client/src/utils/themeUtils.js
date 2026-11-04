/**
 * themeUtils.js
 * Plan-gated color system + WCAG contrast helpers for the creator profile theme.
 */

// ─── WCAG 2.1 relative luminance ────────────────────────────────────────────

const toLinear = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export const getLuminance = (hex) => {
  if (!hex || hex.length < 7) return 0;
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  } catch {
    return 0;
  }
};

/**
 * Returns '#ffffff' or '#111827' based on WCAG contrast against the given background.
 */
export const getContrastColor = (hex) => {
  if (!hex || !hex.startsWith('#')) return '#ffffff';
  return getLuminance(hex) > 0.35 ? '#111827' : '#ffffff';
};

// ─── Plan-gated color palettes ───────────────────────────────────────────────

// Starter (free) tier: brand maroon only — no choice, keeps free profiles on-brand.
export const FREE_COLORS = [
  { name: 'Brand Maroon', hex: '#960D32' },
];

// Host+ (creator) tier: 8 curated colours.
export const CREATOR_COLORS = [
  { name: 'Brand Maroon',  hex: '#960D32' },
  { name: 'Royal Blue',    hex: '#2563EB' },
  { name: 'Indigo',        hex: '#4F46E5' },
  { name: 'Purple',        hex: '#7C3AED' },
  { name: 'Pink',          hex: '#EC4899' },
  { name: 'Crimson',       hex: '#DC2626' },
  { name: 'Emerald',       hex: '#10B981' },
  { name: 'Forest Green',  hex: '#15803D' },
];

// Pro (+ legacy Studio / Supreme) tier: 16 hue-ordered colours. Light shades
// (yellow, lime, pale greys) were dropped — white button text reads poorly on
// them — along with near-duplicates. No pure black/white. Keep in sync with
// server/controllers/hostController.js PRO_PALETTE.
export const STUDIO_COLORS = [
  // warm → green
  { name: 'Brand Maroon', hex: '#960D32' },
  { name: 'Red',          hex: '#DC2626' },
  { name: 'Rose',         hex: '#F43F5E' },
  { name: 'Pink',         hex: '#EC4899' },
  { name: 'Orange',       hex: '#F97316' },
  { name: 'Amber',        hex: '#F59E0B' },
  { name: 'Emerald',      hex: '#10B981' },
  { name: 'Forest Green', hex: '#15803D' },
  // cool → neutral
  { name: 'Teal',         hex: '#14B8A6' },
  { name: 'Sky Blue',     hex: '#0EA5E9' },
  { name: 'Royal Blue',   hex: '#2563EB' },
  { name: 'Indigo',       hex: '#4F46E5' },
  { name: 'Violet',       hex: '#7C3AED' },
  { name: 'Fuchsia',      hex: '#C026D3' },
  { name: 'Brown',        hex: '#92400E' },
  { name: 'Slate',        hex: '#475569' },
];

export const DEFAULT_THEME_COLOR = '#960D32';

/**
 * Returns the color swatches available for the given plan.
 *   Starter                 → brand maroon only (1)
 *   Pro (Partner) (creator) → CREATOR_COLORS (8)
 *   Pro / Studio / Supreme  → STUDIO_COLORS (16); Studio/Supreme also get custom hex
 */
export const getColorsForPlan = (plan) => {
  const canon = normalizePlan(plan);
  if (canon === 'premium' || canon === 'professional' || canon === 'supreme') return STUDIO_COLORS;
  if (canon === 'creator') return CREATOR_COLORS;
  return FREE_COLORS;
};

export const canUseCustomHex = (plan) => plan === 'professional' || plan === 'supreme';

// ─── Profile photo border color by plan ─────────────────────────────────────

export const getPlanBorderColor = (plan) => {
  if (plan === 'supreme')      return '#D4AF37'; // gold (top tier, shares Studio)
  if (plan === 'professional') return '#D4AF37'; // gold
  if (plan === 'creator')      return '#960D32'; // brand maroon
  return '#6B7280';                               // grey
};

// ─── Plan display labels (UI ONLY — DB slugs/names are unchanged) ────────────
// Maps the internal plan slug to the user-facing brand name. Internal code,
// routes, DB values, feature flags, and analytics keep their original slugs.
// Two public plans since v3.165: free → "Starter", premium → "Pro".
// The legacy paid rows are hidden from the catalogue but still renew for their
// existing subscribers, so they keep a label — they carry Pro
// entitlements at their original price.
export const PLAN_DISPLAY = {
  free: 'Starter', starter: 'Starter', explorer: 'Starter', starter_legacy: 'Starter',
  premium: 'Pro', premium_founding: 'Pro (Founding)',
  creator: 'Pro (Partner)',
  professional: 'Pro (Legacy Studio)', pro: 'Pro (Legacy Studio)',
  supreme: 'Supreme',
};

// Render-time plan label. Pass the slug; optional fallback for unknown slugs.
export const planLabel = (slug, fallback) =>
  PLAN_DISPLAY[String(slug || '').toLowerCase()] || fallback || slug || '';

// Collapse legacy plan aliases to the canonical DB slug so UI lookups (badges,
// premium cards, lock gates) never miss on a synonym. Mirrors planService:
// `starter` / `explorer` / `starter_legacy` are all the free tier. Unknown
// slugs fall through to free — never to a paid tier.
const PLAN_ALIASES = {
  explorer: 'free', starter: 'free', starter_legacy: 'free',
  pro: 'professional',
  // Founding-100 members hold an archived copy of Pro (v3.184) — same tier.
  premium_founding: 'premium',
};
export const CANONICAL_PLANS = ['free', 'premium', 'creator', 'professional', 'supreme'];
export const normalizePlan = (slug) => {
  const s = String(slug || '').toLowerCase();
  const canon = PLAN_ALIASES[s] || s;
  return CANONICAL_PLANS.includes(canon) ? canon : 'free';
};

/** Is this host on the free tier? Use instead of comparing slugs inline — the
 *  canonical free slug has already changed once (starter → free). */
export const isFreePlan = (slug) => normalizePlan(slug) === 'free';

export const getPlanBorderLabel = (plan) => {
  const canon = normalizePlan(plan);
  if (canon === 'supreme') return 'Supreme';
  return canon === 'free' ? 'Starter' : 'Pro';
};

// ─── Social platform brand colors ────────────────────────────────────────────

export const SOCIAL_BRAND_COLORS = {
  instagram: '#E1306C',
  youtube:   '#FF0000',
  linkedin:  '#0A66C2',
  facebook:  '#1877F2',
  twitter:   '#000000',
  website:   '#374151',
  whatsapp:  '#25D366',
  github:    '#24292F',
  email:     '#374151',
};

// ─── CSS variable application ────────────────────────────────────────────────

// Mix a hex color toward white (amount > 0) or black (amount < 0). amount ∈ [-1, 1].
export const shadeHex = (hex, amount) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return hex;
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c) => Math.round(c + (target - c) * t);
  const r = mix(parseInt(hex.slice(1, 3), 16));
  const g = mix(parseInt(hex.slice(3, 5), 16));
  const b = mix(parseInt(hex.slice(5, 7), 16));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Injects the full set of profile theme CSS vars onto an element:
 *   --profile-accent        the host's chosen color
 *   --profile-accent-text   WCAG-contrast text color on the accent
 *   --profile-accent-hover  slightly darker (hover states)
 *   --profile-accent-light  pale tint (backgrounds, pills)
 *   --profile-accent-dark   strong shade (headings on light)
 * Call this on the page wrapper (or document.documentElement) so all themed
 * elements consume vars instead of hardcoded colors.
 */
export const applyProfileTheme = (element, color) => {
  if (!element || !color) return;
  element.style.setProperty('--profile-accent', color);
  element.style.setProperty('--profile-accent-text', getContrastColor(color));
  element.style.setProperty('--profile-accent-hover', shadeHex(color, -0.12));
  element.style.setProperty('--profile-accent-light', shadeHex(color, 0.88));
  element.style.setProperty('--profile-accent-dark', shadeHex(color, -0.3));
};

/**
 * Validates a hex color string.
 */
export const isValidHex = (hex) => /^#[0-9a-fA-F]{6}$/.test(hex);
