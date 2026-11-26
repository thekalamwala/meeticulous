// Main / Business / Account buckets over NAV_V2's flat sections, for the
// DashboardLayoutV2 rail. A section id absent from every bucket would be
// unreachable from the v2 rail, so navParity.test.jsx asserts full coverage.
// Standalone (no React/CSS imports) so that test stays cheap.
export const GROUPS = [
  { label: 'Main', ids: ['home', 'bookings', 'clients', 'messages'] },
  { label: 'Business', ids: ['catalog', 'schedule', 'intelligence', 'money', 'grow'] },
  { label: 'Account', ids: ['settings'] },
];

export default GROUPS;
