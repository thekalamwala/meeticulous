// Shared, dependency-free receipt / invoice generator.
// Used by the booking confirmation screen (ServiceBooking) and My Bookings
// (CustomerBookings) so there is a single source of truth for what a receipt
// looks like. `buildReceiptHTML` is a pure function (unit-tested); the document
// auto-prints on open, so "download" doubles as Save-as-PDF.
//
// Design goal: a premium, enterprise-grade invoice (think Stripe / Apple Wallet
// / Linear) — minimal, information-first, generous whitespace, orange used only
// as an accent. Every field is optional; empty fields are hidden so the same
// template degrades gracefully whether the caller passes 12 fields or 40.

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const pos = (v) => Number(v) > 0;

// Minimal stroke-icon set (currentColor) for the summary cards.
const ICON = {
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>',
  status:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.3 4.6-4.8"/></svg>',
  card:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 9.5h19M6 14.5h4"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l7.5 3v5.5c0 4.7-3.2 7.8-7.5 9-4.3-1.2-7.5-4.3-7.5-9V5.5z"/><path d="M9 12l2 2 4-4"/></svg>',
};

// A single label/value pair for the two-column layouts. Renders nothing when
// the value is empty so callers never have to pre-filter.
const kv = (label, value) =>
  has(value)
    ? `<div class="kv"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
    : "";

// Wrap a section in its own block, but only if it actually has content.
const section = (title, innerHTML) =>
  innerHTML && innerHTML.trim()
    ? `<section class="block"><h2 class="block-title">${esc(title)}</h2>${innerHTML}</section>`
    : "";

const summaryCard = (icon, label, value, tone) =>
  has(value)
    ? `<div class="card">
         <span class="card-ic" aria-hidden="true">${icon}</span>
         <span class="card-label">${esc(label)}</span>
         <span class="card-value${tone ? ` t-${tone}` : ""}">${esc(value)}</span>
       </div>`
    : "";

const STATUS_TONE = {
  paid: "ok",
  confirmed: "ok",
  completed: "info",
  pending: "warn",
  unpaid: "warn",
  refunded: "neutral",
  cancelled: "neutral",
};

const titleCase = (s) =>
  String(s || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Build a printable receipt as an HTML string.
 *
 * All fields are optional; empty ones are hidden. Backward-compatible aliases:
 *   paymentId      -> transactionId
 *   platformFeeGst -> gst
 *
 * @param {object} d
 *   Identity:   receiptId, bookingId, invoiceNumber, receiptNumber, invoiceDate
 *   Booking:    whenText, serviceTitle, category, hostName, businessName,
 *               venue, duration, timezone, notes, status
 *   Customer:   guestName, guestEmail, customerPhone, billingAddress
 *   Payment:    paymentStatus ('paid'|'unpaid'|'refunded'), paymentMethod,
 *               gateway, transactionId|paymentId, gatewayRef, currency,
 *               paymentDate, paymentTime
 *   Breakdown:  price (service amount), platformFee, discount, coupon, taxes,
 *               gst|platformFeeGst, convenienceFee, otherCharges, refund, total
 *   Business:   businessAddress, gstin, pan, businessEmail, businessPhone, website
 */
export function buildReceiptHTML(d = {}) {
  const {
    receiptId = "—",
    bookingId = "",
    invoiceNumber = "",
    receiptNumber = "",
    invoiceDate = "",
    whenText = "",
    serviceTitle = "Service",
    category = "",
    hostName = "Host",
    businessName = "",
    venue = "",
    duration = "",
    timezone = "",
    notes = "",
    status = "",
    guestName = "",
    guestEmail = "",
    customerPhone = "",
    billingAddress = "",
    paymentStatus = "",
    paymentMethod = "",
    gateway = "",
    paymentId = "",
    transactionId = "",
    gatewayRef = "",
    currency = "INR",
    paymentDate = "",
    paymentTime = "",
    price = 0,
    platformFee = 0,
    discount = 0,
    coupon = "",
    taxes = 0,
    platformFeeGst = 0,
    gst = 0,
    convenienceFee = 0,
    otherCharges = 0,
    refund = 0,
    total = 0,
    businessAddress = "",
    gstin = "",
    pan = "",
    businessEmail = "",
    businessPhone = "",
    website = "",
  } = d;

  const txnId = transactionId || paymentId;
  const gstAmount = Number(gst) || Number(platformFeeGst);

  const isFree = Number(price) === 0;
  const isPaid = !isFree && paymentStatus === "paid";
  const docTitle = isPaid
    ? "Payment Receipt"
    : isFree
      ? "Booking Confirmation"
      : "Booking Invoice";

  // Header status badge: payment-first, falling back to booking status.
  const badgeKey = (paymentStatus || status || (isFree ? "confirmed" : "")).toLowerCase();
  const badgeLabel = isFree && !has(paymentStatus) ? "Confirmed" : titleCase(badgeKey || "—");
  const badgeTone = STATUS_TONE[badgeKey] || "neutral";

  const dateLabel = invoiceDate || todayLabel();

  // ---- Payment breakdown -------------------------------------------------
  let breakdown;
  if (isPaid) {
    const grandTotal = Number(total) || Number(price);
    const line = (label, amount, neg) =>
      pos(amount)
        ? `<tr><th scope="row">${esc(label)}</th><td>${neg ? "−" : ""}${inr(amount)}</td></tr>`
        : "";
    const discountLabel = has(coupon) ? `Discount (${coupon})` : "Discount";
    breakdown = `
      <div class="panel">
        <table class="breakdown">
          <tbody>
            <tr><th scope="row">${esc(serviceTitle)}</th><td>${inr(price)}</td></tr>
            ${line("Platform fee", platformFee)}
            ${line("Convenience fee", convenienceFee)}
            ${line("Taxes", taxes)}
            ${line("GST", gstAmount)}
            ${line("Other charges", otherCharges)}
            ${line(discountLabel, discount, true)}
            ${line("Refund", refund, true)}
          </tbody>
          <tfoot>
            <tr class="grand">
              <th scope="row">Grand total</th>
              <td>${inr(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  } else {
    const amountText = isFree
      ? "Free"
      : paymentStatus === "refunded"
        ? `${inr(price)} (refunded)`
        : "Unpaid";
    breakdown = `
      <div class="panel">
        <table class="breakdown">
          <tfoot>
            <tr class="grand">
              <th scope="row">Amount</th>
              <td>${esc(amountText)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  // ---- Summary cards -----------------------------------------------------
  const cards = [
    summaryCard(ICON.calendar, "Booking date & time", whenText),
    summaryCard(ICON.status, "Booking status", has(status) ? titleCase(status) : "", STATUS_TONE[String(status).toLowerCase()]),
    summaryCard(
      ICON.card,
      "Payment status",
      has(paymentStatus) ? titleCase(paymentStatus) : isFree ? "Free" : "",
      STATUS_TONE[String(paymentStatus).toLowerCase()],
    ),
    summaryCard(ICON.shield, isPaid ? "Amount paid" : "Amount", isPaid ? inr(Number(total) || Number(price)) : isFree ? "Free" : ""),
  ]
    .filter(Boolean)
    .join("");

  // ---- Booking information ----------------------------------------------
  const bookingInfo = [
    kv("Service", serviceTitle),
    kv("Category", category && titleCase(category)),
    kv("Host", hostName),
    kv("Business", businessName),
    kv("Venue / Meeting link", venue),
    kv("Duration", has(duration) ? (Number(duration) ? `${duration} min` : duration) : ""),
    kv("Timezone", timezone),
    kv("Booking notes", notes),
  ].join("");

  // ---- Payment information ----------------------------------------------
  // Currency on its own (free bookings) reads as filler, so only surface it
  // once there's an actual payment to describe.
  const hasPayment = isPaid || has(txnId) || has(paymentMethod) || has(gateway);
  const paymentInfo = [
    kv("Payment method", paymentMethod),
    kv("Gateway", gateway),
    kv("Transaction ID", txnId),
    kv("Gateway reference", gatewayRef),
    kv("Currency", hasPayment ? currency : ""),
    kv("Payment date", paymentDate),
    kv("Payment time", paymentTime),
    kv("Invoice number", invoiceNumber),
    kv("Receipt number", receiptNumber),
  ].join("");

  // ---- Business information ----------------------------------------------
  const businessInfo = [
    kv("Business name", businessName),
    kv("Address", businessAddress),
    kv("GSTIN", gstin),
    kv("PAN", pan),
    kv("Email", businessEmail),
    kv("Phone", businessPhone),
    kv("Website", website),
  ].join("");

  // ---- Customer information ---------------------------------------------
  const customerInfo = [
    kv("Name", guestName),
    kv("Email", guestEmail),
    kv("Phone", customerPhone),
    kv("Billing address", billingAddress),
  ].join("");

  // ---- Header meta -------------------------------------------------------
  const headerMeta = [
    kv("Receipt ID", receiptId),
    kv("Booking ID", bookingId),
    kv("Invoice date", dateLabel),
  ].join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(docTitle)} ${esc(receiptId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#f5f5f6; --paper:#ffffff;
    --ink:#18181b; --ink-2:#3f3f46; --muted:#71717a; --faint:#a1a1aa;
    --line:#ededee; --line-2:#e4e4e7; --card:#fafafa; --card-line:#ececed;
    --accent:#960D32; --accent-soft:rgba(254,81,0,.10);
    --ok-bg:#ecfdf5; --ok-fg:#047857; --ok-line:#a7f3d0;
    --warn-bg:#fffbeb; --warn-fg:#b45309; --warn-line:#fde68a;
    --info-bg:#eff6ff; --info-fg:#960D32; --info-line:#bfdbfe;
    --neutral-bg:#f4f4f5; --neutral-fg:#52525b; --neutral-line:#e4e4e7;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0; background:var(--bg); color:var(--ink);
    font-family:"Poppins",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased; line-height:1.5;
    font-feature-settings:"tnum" 0;
  }
  .sheet{
    max-width:900px; margin:32px auto; background:var(--paper);
    border:1px solid var(--line-2); border-radius:18px; padding:48px;
    box-shadow:0 1px 2px rgba(24,24,27,.04), 0 18px 40px -28px rgba(24,24,27,.30);
  }

  /* Header */
  .head{display:flex; justify-content:space-between; align-items:flex-start; gap:28px; flex-wrap:wrap}
  .brand-lock{display:flex; align-items:center; gap:12px}
  .logo{
    width:40px; height:40px; border-radius:11px; flex:none;
    display:block; object-fit:cover; background:#fff;
  }
  .wordmark{font-size:17px; font-weight:700; letter-spacing:-.01em; color:var(--ink)}
  .doc-kind{font-size:13px; font-weight:600; color:var(--accent); margin-top:1px}
  .brand-sub{font-size:12px; color:var(--muted); margin-top:6px; line-height:1.5}
  .head-right{text-align:right; min-width:230px; margin-left:auto}
  .badge{
    display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600;
    padding:5px 11px; border-radius:999px; border:1px solid var(--neutral-line);
    background:var(--neutral-bg); color:var(--neutral-fg); margin-bottom:14px;
  }
  .badge::before{content:""; width:7px; height:7px; border-radius:50%; background:currentColor}
  .badge.t-ok{background:var(--ok-bg); color:var(--ok-fg); border-color:var(--ok-line)}
  .badge.t-warn{background:var(--warn-bg); color:var(--warn-fg); border-color:var(--warn-line)}
  .badge.t-info{background:var(--info-bg); color:var(--info-fg); border-color:var(--info-line)}
  .badge.t-neutral{background:var(--neutral-bg); color:var(--neutral-fg); border-color:var(--neutral-line)}
  .head-meta{display:flex; flex-direction:column; gap:8px}
  .head-meta .kv{display:flex; justify-content:flex-end; gap:14px; border:0; padding:0}
  .head-meta dt{color:var(--muted); font-size:12px; font-weight:500}
  .head-meta dd{margin:0; color:var(--ink); font-size:13px; font-weight:600; font-variant-numeric:tabular-nums}

  .divider{border:0; border-top:1px solid var(--line); margin:34px 0}

  /* Summary cards */
  .cards{display:grid; grid-template-columns:repeat(4,1fr); gap:12px}
  .card{
    border:1px solid var(--card-line); background:var(--card); border-radius:14px;
    padding:15px 16px; display:flex; flex-direction:column; gap:7px; min-width:0;
  }
  .card-ic{width:22px; height:22px; color:var(--faint)}
  .card-ic svg{width:22px; height:22px; display:block}
  .card-label{font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--muted)}
  .card-value{font-size:15px; font-weight:600; color:var(--ink); overflow-wrap:anywhere}
  .card-value.t-ok{color:var(--ok-fg)} .card-value.t-warn{color:var(--warn-fg)}
  .card-value.t-info{color:var(--info-fg)} .card-value.t-neutral{color:var(--ink-2)}

  /* Sections */
  .block{margin-top:34px}
  .block-title{
    font-size:11px; font-weight:600; letter-spacing:.09em; text-transform:uppercase;
    color:var(--muted); margin:0 0 14px;
  }
  .kv-grid{display:grid; grid-template-columns:1fr 1fr; gap:0 40px; margin:0}
  .kv{display:flex; justify-content:space-between; gap:18px; padding:11px 0; border-bottom:1px solid var(--line)}
  .kv dt{color:var(--muted); font-size:13px; flex:none; max-width:45%}
  .kv dd{margin:0; color:var(--ink); font-size:13px; font-weight:600; text-align:right; overflow-wrap:anywhere}

  /* Payment breakdown */
  .panel{border:1px solid var(--line-2); border-radius:14px; overflow:hidden; background:var(--paper)}
  .breakdown{width:100%; border-collapse:collapse}
  .breakdown th, .breakdown td{padding:13px 20px; font-size:14px; text-align:left}
  .breakdown th{font-weight:400; color:var(--ink-2); overflow-wrap:anywhere}
  .breakdown td{text-align:right; font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; white-space:nowrap}
  .breakdown tbody tr + tr th, .breakdown tbody tr + tr td{border-top:1px solid var(--line)}
  .breakdown tfoot .grand th, .breakdown tfoot .grand td{
    border-top:2px solid var(--ink); padding-top:18px; padding-bottom:18px; background:var(--accent-soft);
  }
  .breakdown tfoot .grand th{font-weight:700; color:var(--ink); font-size:15px}
  .breakdown tfoot .grand td{font-size:24px; font-weight:800; letter-spacing:-.01em}

  /* Policy + footer */
  .policy{color:var(--muted); font-size:12px; line-height:1.7; margin:0; padding-left:18px}
  .policy li{margin:2px 0}
  .footer{margin-top:42px; padding-top:24px; border-top:1px solid var(--line); text-align:center; color:var(--faint); font-size:12px; line-height:1.85}
  .footer strong{color:var(--ink-2); font-weight:600}
  .footer a{color:inherit; text-decoration:none}

  @media (max-width:720px){
    .sheet{margin:0; border-radius:0; border:0; padding:28px 20px}
    .cards{grid-template-columns:repeat(2,1fr)}
    .kv-grid{grid-template-columns:1fr; gap:0}
    .head-right{text-align:left; margin-left:0; min-width:0}
    .head-meta .kv{justify-content:space-between}
  }
  @media (max-width:420px){ .cards{grid-template-columns:1fr} }

  @media screen and (prefers-color-scheme:dark){
    :root{
      --bg:#000; --paper:#0c0c0d;
      --ink:#fafafa; --ink-2:#d4d4d8; --muted:#a1a1aa; --faint:#71717a;
      --line:#1f1f22; --line-2:#27272a; --card:#111113; --card-line:#27272a;
      --accent:#ff6a2b; --accent-soft:rgba(255,106,43,.14);
      --ok-bg:rgba(16,185,129,.14); --ok-fg:#6ee7b7; --ok-line:rgba(16,185,129,.35);
      --warn-bg:rgba(245,158,11,.14); --warn-fg:#fcd34d; --warn-line:rgba(245,158,11,.35);
      --info-bg:rgba(59,130,246,.14); --info-fg:#93c5fd; --info-line:rgba(59,130,246,.35);
      --neutral-bg:#1c1c1f; --neutral-fg:#a1a1aa; --neutral-line:#2a2a2e;
    }
    .sheet{box-shadow:none}
    .breakdown tfoot .grand th, .breakdown tfoot .grand td{border-top-color:var(--faint)}
  }

  @media print{
    body{background:#fff}
    .sheet{max-width:none; margin:0; border:0; border-radius:0; box-shadow:none; padding:0}
    .card, .panel, .block, .head{break-inside:avoid}
    @page{size:A4; margin:14mm}
  }
</style>
</head>
<body>
  <main class="sheet" role="document" aria-label="${esc(docTitle)}">
    <header class="head">
      <div class="brand">
        <div class="brand-lock">
          <img class="logo" src="https://company-assets.meeticulous.in/images/email/sloth-icon-sqr.png" alt="Meeticulous logo" width="40" height="40">
          <span>
            <div class="wordmark">Meeticulous</div>
            <div class="doc-kind">${esc(docTitle)}</div>
          </span>
        </div>
        <div class="brand-sub">Booking made easy.<br>Generated automatically.</div>
      </div>
      <div class="head-right">
        <span class="badge t-${badgeTone}">${esc(badgeLabel)}</span>
        <dl class="head-meta">${headerMeta}</dl>
      </div>
    </header>

    <hr class="divider">

    ${cards ? `<section aria-label="Booking summary"><div class="cards">${cards}</div></section>` : ""}

    ${section("Booking information", bookingInfo ? `<dl class="kv-grid">${bookingInfo}</dl>` : "")}

    ${section("Payment information", paymentInfo ? `<dl class="kv-grid">${paymentInfo}</dl>` : "")}

    ${section(isPaid ? "Payment breakdown" : "Summary", breakdown)}

    ${section("Business information", businessInfo ? `<dl class="kv-grid">${businessInfo}</dl>` : "")}

    ${section("Customer information", customerInfo ? `<dl class="kv-grid">${customerInfo}</dl>` : "")}

    <hr class="divider">

    <section class="block" aria-label="Policy" style="margin-top:0">
      <ul class="policy">
        <li>This is a system-generated ${isPaid ? "receipt" : "document"}. Please keep it for your records.</li>
        <li>Cancellation policy applies. Refunds follow the host's policy.</li>
        <li>Taxes are included where applicable.</li>
      </ul>
    </section>

    <footer class="footer">
      <strong>Meeticulous</strong> · Powered by Timewheel Internet Pvt. Ltd.<br>
      <a href="mailto:bolt@meeticulous.in">bolt@meeticulous.in</a> · <a href="https://meeticulous.com">meeticulous.com</a><br>
      © ${new Date().getFullYear()} Meeticulous. All rights reserved.
    </footer>
  </main>
  <script>window.onload=function(){window.print&&setTimeout(function(){window.print()},350)}</script>
</body>
</html>`;
}

// Best-effort "today" label for the invoice date when the caller doesn't pass
// one. Kept out of the pure-content path so tests never assert on it.
function todayLabel() {
  try {
    return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

/** Trigger a browser download of the receipt (opens print dialog on view). */
export function downloadReceipt(d = {}) {
  const html = buildReceiptHTML(d);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeId = String(d.receiptId || "booking").replace(/[^a-zA-Z0-9]/g, "");
  a.download = `receipt-${safeId}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
