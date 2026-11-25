// "Needs your attention" — the host's action queue, derived from REAL state only
// (pending confirmations, unpaid completed bookings, KYC). Hardest first. Shared by
// the notifications drawer (where the queue lives) and Today (one slim pointer line).
import { inr } from '../components/dashboard/ui/v2';

const lower = (s) => String(s || '').toLowerCase();
const amountOf = (b) => Number(b.customer_total ?? b.amount ?? 0) || 0;
const DAY = 86_400_000;

export const buildQueue = (bookings, kyc, now = Date.now()) => {
  const q = [];
  const kycStatus = lower(kyc?.status || kyc?.kyc_status);
  if (kycStatus && !['approved', 'verified'].includes(kycStatus)) {
    const held = Number(kyc?.pending_earnings) || 0;
    q.push({ id: 'kyc', kind: 'kyc', urgency: 'now', title: 'Verify to get paid',
      detail: held > 0 ? `${inr(held)} is held until your PAN and bank are verified.` : 'Payouts are locked until verification is approved.',
      cta: 'Verify now', to: '/dashboard/kyc' });
  }
  const pending = bookings.filter((b) => lower(b.status) === 'pending' && new Date(b.scheduled_at) > now - DAY);
  if (pending.length) {
    q.push({ id: 'confirm', kind: 'confirm', urgency: 'now', title: `${pending.length} booking${pending.length > 1 ? 's' : ''} to confirm`, detail: pending.slice(0, 2).map((b) => b.guest_name || 'Guest').join(', '), cta: 'Review', to: '/dashboard/bookings' });
  }
  const unpaid = bookings.filter((b) => lower(b.payment_status) === 'unpaid' && amountOf(b) > 0 && ['completed', 'confirmed'].includes(lower(b.status)));
  if (unpaid.length) {
    const owed = unpaid.reduce((n, b) => n + amountOf(b), 0);
    q.push({ id: 'unpaid', kind: 'unpaid', urgency: 'today', title: `${unpaid.length} unpaid booking${unpaid.length > 1 ? 's' : ''}`, detail: `${inr(owed)} not yet collected`, cta: 'See', to: '/dashboard/bookings' });
  }
  return q;
};

// "Mark handled" lasts for the browser session and is shared between the drawer
// and Today, so dismissing in one place clears the other.
const HANDLED_KEY = 'mt_attention_handled';
export const HANDLED_EVENT = 'dash:attention-handled';
export const OPEN_NOTIFICATIONS_EVENT = 'dash:open-notifications';

export const readHandled = () => {
  try { return JSON.parse(sessionStorage.getItem(HANDLED_KEY) || '[]'); } catch { return []; }
};
export const markHandled = (id) => {
  const next = [...new Set([...readHandled(), id])];
  try { sessionStorage.setItem(HANDLED_KEY, JSON.stringify(next)); } catch { /* session-only */ }
  window.dispatchEvent(new CustomEvent(HANDLED_EVENT));
};
export const openNotifications = () => window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_EVENT));
