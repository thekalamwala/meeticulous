// Kept Settings — the one list every Settings surface is drawn from (phone root
// list, desktop left pane, pushed sub-screen titles), so they can never disagree.
//
// Each group is a REAL route. Account / Plan / Verification keep the URLs they
// always had (/dashboard/profile, /dashboard/upgrade, /dashboard/kyc);
// Notifications and Integrations are new, additive routes under /dashboard/settings.
import { Bell, CreditCard, Globe, Plug, ShieldCheck, UserRound } from 'lucide-react';
import { normalizePlan, planLabel } from '../../utils/themeUtils';

export const SETTINGS_ROOT = '/dashboard/profile';

export const kycWord = (user) => {
  const s = String(user?.kyc_status || '').toLowerCase();
  if (['approved', 'verified'].includes(s)) return { word: 'Verified', tone: 'ok' };
  if (['submitted', 'pending', 'in_review', 'under_review'].includes(s)) return { word: 'In review', tone: 'wait' };
  if (s === 'rejected') return { word: 'Needs a fix', tone: 'act' };
  return { word: 'Not verified yet', tone: 'act' };
};

// Groups, in the order a host thinks about them: who I am and how you reach me,
// then money-side settings.
export const SETTINGS_GROUPS = [
  {
    id: 'you',
    rows: [
      { id: 'account', to: '/dashboard/settings/account', label: 'Account', icon: UserRound,
        value: () => 'Name, sign-in, booking rules, search' },
      { id: 'notifications', to: '/dashboard/settings/notifications', label: 'Notifications', icon: Bell,
        value: () => 'Email and the bell' },
      { id: 'integrations', to: '/dashboard/settings/integrations', label: 'Integrations', icon: Plug,
        value: (u) => (u?.google_calendar_connected ? 'Google Calendar connected' : 'Nothing connected yet') },
    ],
  },
  {
    id: 'money',
    rows: [
      { id: 'plan', to: '/dashboard/upgrade', label: 'Plan & billing', icon: CreditCard,
        value: (u) => planLabel(normalizePlan(u?.plan), 'Starter') },
      { id: 'verification', to: '/dashboard/kyc', label: 'Verification', icon: ShieldCheck,
        value: (u) => kycWord(u).word, tone: (u) => kycWord(u).tone },
    ],
  },
  {
    // Not a setting: how the page LOOKS moved to Grow (founder call, 2026-11-26).
    // Listed here so a host who looks for "change my photo" in Settings finds it.
    id: 'elsewhere',
    rows: [
      { id: 'page', to: '/dashboard/grow/page', label: 'Your page', icon: Globe, external: true,
        value: () => 'Photo, bio, colours. Now in Grow' },
    ],
  },
];

export const SETTINGS_ROWS = SETTINGS_GROUPS.flatMap((g) => g.rows);
export const rowById = (id) => SETTINGS_ROWS.find((r) => r.id === id);
