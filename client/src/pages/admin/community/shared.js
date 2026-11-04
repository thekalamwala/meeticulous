// Shared bits for the admin community tabs.
import { sessionCan } from '../../../components/admin/adminNav';

export const getSession = () => {
  try { return JSON.parse(localStorage.getItem('bas_admin') || 'null'); } catch { return null; }
};
export const canModerate = () => sessionCan(getSession(), 'community.moderate');

// Optional note for the audit log. null = admin cancelled -> caller must abort.
export const askNote = (msg) => window.prompt(`${msg}\nOptional note (audit log). Cancel aborts.`, '');

// Permanent ban = far-future date (the server only requires a future ISO date).
export const PERMANENT = '9999-12-31T00:00:00Z';
export const banUntil = (days) => (days === 'permanent' ? PERMANENT : new Date(Date.now() + Number(days) * 864e5).toISOString());

export const errMsg = (e) => e?.response?.data?.code || e?.response?.data?.message || 'Action failed';
