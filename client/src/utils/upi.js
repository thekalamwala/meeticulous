// Builds a UPI deep link (upi://pay?...) for peer-to-peer tips.
// Money goes straight from payer's UPI app to the payee's VPA — the platform
// never touches it, stores nothing, reconciles nothing.
// ponytail: client-side only, no payment backend. Spec: NPCI UPI Linking Spec.

// Returns a upi:// URI, or '' when no payee VPA is given (nothing to pay to).
// `am` is omitted when not a positive number, so "custom / blank" opens the
// payer's app with an editable amount instead of ₹0.
export function buildUpiUri({ pa, pn = '', am, tn = '', cu = 'INR' } = {}) {
  if (!pa || !String(pa).trim()) return '';
  const p = new URLSearchParams();
  p.set('pa', String(pa).trim());
  if (pn) p.set('pn', String(pn));
  const amt = Number(am);
  if (Number.isFinite(amt) && amt > 0) p.set('am', amt.toFixed(2));
  p.set('cu', cu);
  if (tn) p.set('tn', String(tn));
  // URLSearchParams encodes spaces as '+'; UPI apps want %20 — normalise.
  return `upi://pay?${p.toString().replace(/\+/g, '%20')}`;
}
