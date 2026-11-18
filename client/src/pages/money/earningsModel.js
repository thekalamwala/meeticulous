// Pure earnings math for EarningsV2 — the one place paid-booking filtering and
// gross/net/by-service aggregation live, so it can be unit-tested away from React.
// gross = list price; net = vendor_amount (host's share after fees), falling back
// to price when the booking has no vendor_amount (free/legacy rows).

export const periodStart = (p) => {
  if (p === 'all') return null;
  const d = new Date();
  if (p === '30d') d.setDate(d.getDate() - 30);
  else if (p === '90d') d.setDate(d.getDate() - 90);
  else if (p === 'year') { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); }
  return d;
};

export const summarizeEarnings = (bookings, start) => {
  const paid = (bookings || []).filter(
    (b) => b.payment_status === 'paid' && (!start || new Date(b.scheduled_at || b.created_at) >= start),
  );
  let gross = 0;
  let net = 0;
  const byTitle = {};
  paid.forEach((b) => {
    const price = b.services?.price || 0;
    const share = b.vendor_amount != null ? b.vendor_amount : price;
    gross += price;
    net += share;
    const title = b.services?.title || 'Unknown';
    if (!byTitle[title]) byTitle[title] = { label: title, net: 0, count: 0 };
    byTitle[title].net += share;
    byTitle[title].count += 1;
  });
  const byService = Object.values(byTitle).sort((a, b) => b.net - a.net);
  return { paid, gross, net, byService };
};
