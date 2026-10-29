// customerKey.js — the SINGLE source of CRM client identity.
// A client is DERIVED from bookings; every derived/persisted client agrees on
// this key so a walk-in logged by phone today links to that person's online
// booking tomorrow. Phone wins over email when both exist.
//   phone '+91 98765 43210' -> 'p:9876543210'
//   email 'Jane@X.COM '      -> 'e:jane@x.com'
//   neither / junk           -> null  (no key = not a CRM client)
// ponytail: last-10-digits is the naive India-only rule; widen if intl guests appear.

const phoneKey = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  // Indian mobile numbers are 10 digits; strip a leading 91/0 country/trunk prefix.
  const last10 = digits.slice(-10);
  return last10.length === 10 ? `p:${last10}` : null;
};

const emailKey = (email) => {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  return e.includes('@') && e.length >= 3 ? `e:${e}` : null;
};

/** Returns the stable client key for a booking-like object, or null. */
const customerKey = ({ phone, email } = {}) => phoneKey(phone) || emailKey(email) || null;

/** Inverse: 'p:9876543210' -> { type:'phone', value:'9876543210' }. */
const displayFromKey = (key) => {
  if (typeof key !== 'string' || key.length < 3) return null;
  const value = key.slice(2);
  if (key.startsWith('p:')) return { type: 'phone', value };
  if (key.startsWith('e:')) return { type: 'email', value };
  return null;
};

module.exports = { customerKey, displayFromKey, phoneKey, emailKey };
