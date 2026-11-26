// Money (Kept) — pure presentation helpers. No figure is computed here that the
// server didn't already persist: balance buckets come from /vendor/payout/balance,
// per-payment state from each paid booking's Route transfer + settlement columns
// (transfer_status, transfer_settlement_status, recipient_settlement_id,
// transfer_settled_at). We only group and word them.

const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;

// The host's money in three buckets, in the order it moves:
//   waiting    paid, but the session hasn't happened yet
//   ready      done and cleared; goes out on its own (or is held until KYC)
//   inTransit  clearing / held transfer / a payout request in flight
export const balanceBuckets = (b) => {
  if (!b) return null;
  const waiting = num(b.pendingCompletion);
  const ready = num(b.available) + num(b.heldForKyc);
  const inTransit = num(b.clearing) + num(b.inflight);
  return { waiting, ready, inTransit, held: num(b.heldForKyc), total: r2(waiting + ready + inTransit), paidOut: num(b.paidOut) };
};

// One payment's payout state, always as words. `null` = nothing owed (free / ₹0).
// tone: 'ok' (in the bank) · 'move' (on its way) · 'wait' · 'bad'
export const payoutState = (tx, { verified = true, now = Date.now() } = {}) => {
  if (!(num(tx.vendor_amount) > 0)) return null;
  const ts = tx.transfer_status;
  if (ts === 'processed') {
    return (tx.transfer_settlement_status === 'settled' || tx.transfer_settled_at)
      ? { key: 'deposited', word: 'In your bank', tone: 'ok' }
      : { key: 'sent', word: 'Sent to your bank', tone: 'move' };
  }
  if (ts === 'pending' || ts === 'creating') return { key: 'clearing', word: 'Clearing', tone: 'move' };
  if (ts === 'reversed') return { key: 'reversed', word: 'Reversed', tone: 'bad' };
  if (ts === 'failed') return { key: 'failed', word: 'Payout failed', tone: 'bad' };
  if (tx.scheduled_at && new Date(tx.scheduled_at).getTime() > now) return { key: 'waiting', word: 'After the session', tone: 'wait' };
  return verified
    ? { key: 'ready', word: 'Going out soon', tone: 'move' }
    : { key: 'held', word: 'Held until you verify', tone: 'wait' };
};

// Payments split for the payout timeline:
//   onTheWay  not in the bank yet (newest session first)
//   deposits  one entry per bank deposit (Razorpay recipient settlement), newest first
//   problems  failed / reversed transfers
export const splitPayouts = (rows, opts) => {
  const onTheWay = [];
  const problems = [];
  const byDeposit = new Map();
  for (const tx of rows || []) {
    const s = payoutState(tx, opts);
    if (!s) continue;
    if (s.key === 'deposited') {
      const id = tx.recipient_settlement_id || `day:${String(tx.transfer_settled_at || '').slice(0, 10)}`;
      const d = byDeposit.get(id) || { id, at: tx.transfer_settled_at, total: 0, rows: [] };
      d.total = r2(d.total + num(tx.vendor_amount));
      if (tx.transfer_settled_at && (!d.at || tx.transfer_settled_at > d.at)) d.at = tx.transfer_settled_at;
      d.rows.push(tx);
      byDeposit.set(id, d);
    } else if (s.tone === 'bad') problems.push(tx);
    else onTheWay.push(tx);
  }
  const deposits = [...byDeposit.values()].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return { onTheWay, deposits, problems };
};

// Group items under month headers ("November 2026"), keeping input order.
export const byMonth = (items, dateOf) => {
  const out = [];
  for (const it of items) {
    const iso = dateOf(it);
    const label = iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Undated';
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(it);
    else out.push({ label, items: [it] });
  }
  return out;
};

// A payment's breakdown, guest price down to what the host gets. ₹0 lines are
// dropped (Kept: hide zero lines). Section names only — no rate is asserted here.
export const feeLines = (tx) => {
  const gateway = r2(num(tx.razorpay_fee_actual) + num(tx.razorpay_tax_actual));
  return [
    { label: 'Guest paid', value: num(tx.services?.price ?? tx.amount) },
    { label: 'Meeticulous commission', value: -num(tx.commission_applied) },
    { label: 'Payment gateway', value: -gateway },
    { label: 'TDS (section 194-O)', value: -num(tx.tds_amount), tax: true },
    { label: 'TCS (GST section 52)', value: -num(tx.tcs_amount), tax: true },
  ].filter((l) => l.value !== 0);
};
