// Compact relative time ("5m ago", "3d ago", then "4 Nov"). Shared by admin sales and the community.
export const relTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
