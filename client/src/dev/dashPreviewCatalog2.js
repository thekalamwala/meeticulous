// Catalog upgrade (2026-11-27) preview data, layered over ./dashPreviewCatalog.js:
//   services gain the server's host_earnings ("You'll get" = price less a made-up
//   5% commission, preview only), and membership tiers gain cover_url +
//   description (v3.228) and a free third tier. Every figure is made up.
// Only the default catalog state is touched; the 'empty' / 'error' / 'worst' /
// 'partial' modes of dashPreviewCatalog stay exactly as they were.
import { catalogFixtures } from './dashPreviewCatalog';

const IMG = (name) => `/images/hero/${name}-hero-wide.webp`;
const earn = (s) => (s.price_on_request ? null : Math.round(Number(s.price || 0) * 95) / 100);

export function catalogUpgradeFixtures() {
  let mode = '';
  try { mode = localStorage.getItem('dash-preview-catalog') || ''; } catch { /* storage blocked */ }
  if (mode) return {};
  const base = catalogFixtures();
  const program = base['/memberships/mine'].program;
  const [circle, inner] = program.tiers;
  return {
    '/services': base['/services'].map((s) => ({ ...s, host_earnings: earn(s) })),
    '/memberships/mine': { program: { ...program, tiers: [
      { ...circle, cover_url: IMG('coach'), description: 'For founders who want a steady monthly push.' },
      { ...inner, cover_url: IMG('consultant'), description: 'Small group, with a personal review every month.' },
      { id: 'tier-3', name: 'Friends', type: 'free', price_inr: null, status: 'live', position: 2, perks: ['Monthly newsletter', 'Public Q&A threads'], cover_url: null, description: 'Stay in the loop for free.', created_at: circle.created_at },
    ] } },
  };
}
