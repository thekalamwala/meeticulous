// Support SLA + priority — computed from what's already stored (no migration).
// "Waiting on us" = the customer/visitor is waiting for a human reply. The clock
// runs from when they last acted; a row past the target is a breach.
//
// ponytail: wall-clock age, not business-hours-adjusted. Good enough to triage the
// live queue; swap for a business-hours diff if SLA reporting ever needs it.

export const SLA_WARN_MIN = 60;    // amber: waiting over an hour
export const SLA_BREACH_MIN = 240; // red: waiting over four hours

// Revenue-critical signals → High priority. Host earnings/activation and anyone's
// money stuck are the things that cost the business if they sit.
export const PRIORITY_RE = /\b(payout|payment|refund|earning|paid|charg|money|invoice|settle|listing|activ|go ?live|kyc|verif|subscription)\b/i;

export const priorityOf = (text) => (PRIORITY_RE.test(text || '') ? 'high' : 'normal');

// Minutes waiting on us, or null when it isn't our turn.
export function waitMinutes(row, nowMs) {
  if (!row || !row.waitingOnUs || !row.waitingSince) return null;
  const since = new Date(row.waitingSince).getTime();
  if (!Number.isFinite(since)) return null;
  return Math.max(0, Math.floor((nowMs - since) / 60000));
}

export function slaLevel(mins) {
  if (mins == null) return null;
  if (mins >= SLA_BREACH_MIN) return 'breach';
  if (mins >= SLA_WARN_MIN) return 'warn';
  return 'ok';
}

// "2h 10m" / "45m".
export function fmtWait(mins) {
  if (mins == null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

// Queue sort: anything waiting on us floats up, longest-waiting first (most
// breached at the very top); High priority breaks ties; the rest fall to recency.
export function inboxSort(a, b, nowMs) {
  const aw = waitMinutes(a, nowMs);
  const bw = waitMinutes(b, nowMs);
  const aWaiting = aw != null;
  const bWaiting = bw != null;
  if (aWaiting !== bWaiting) return aWaiting ? -1 : 1;
  if (aWaiting && bWaiting) {
    if (bw !== aw) return bw - aw; // longer wait first
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
  }
  return new Date(b.at || 0) - new Date(a.at || 0); // newest first
}
