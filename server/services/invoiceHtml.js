'use strict';
const { seller } = require('../config/sellerIdentity');
const { fiscalYearLabel } = require('./invoiceService');
const stateService = require('./stateService');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };

// Short human label for the SAC on the invoice (falls back to the bare code).
const SAC_LABEL = {
  '998314': 'IT design & development services',
  '998315': 'Hosting & IT infrastructure provisioning services',
  '998319': 'Other information technology services',
  '996211': 'Services on a fee/commission basis (retail trade)',
  '998311': 'Management consulting & management services',
};

// Indian rupees → words (paise included), grouped lakh/crore. Best-effort.
function rupeesToWords(amount) {
  const cents = Math.round((Number(amount) || 0) * 100);
  const rupees = Math.floor(cents / 100);
  const paise = cents % 100;
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : (b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '')));
  const three = (x) => { const h = Math.floor(x / 100), r = x % 100; return (h ? a[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : ''); };
  const words = (x) => {
    if (x === 0) return 'Zero';
    let str = '';
    const crore = Math.floor(x / 10000000); x %= 10000000;
    const lakh = Math.floor(x / 100000); x %= 100000;
    const thousand = Math.floor(x / 1000); x %= 1000;
    if (crore) str += words(crore) + ' Crore ';
    if (lakh) str += two(lakh) + ' Lakh ';
    if (thousand) str += two(thousand) + ' Thousand ';
    if (x) str += three(x);
    return str.trim();
  };
  let out = 'Rupees ' + words(rupees);
  if (paise) out += ' and ' + two(paise) + ' Paise';
  return out + ' Only';
}

function buildTaxInvoiceHTML(inv = {}) {
  const s = { ...seller, ...(inv.seller_snapshot || {}) };
  const type = inv.source_type;
  const isSub = type === 'subscription';
  const isCom = type === 'commission';
  const isRsf = type === 'reschedule';
  const itemDesc = isSub ? 'Meeticulous — subscription plan'
    : isCom ? 'Meeticulous — platform commission'
    : isRsf ? 'Booking reschedule fee'
    : 'Booking convenience / platform fee';

  // Intra (CGST+SGST) vs inter (IGST) — mutually exclusive by construction.
  const intra = Number(inv.igst) === 0 && (Number(inv.cgst) > 0 || Number(inv.sgst) > 0);
  const taxable = Number(inv.taxable_value) || 0;
  const totalGst = Number(inv.cgst || 0) + Number(inv.sgst || 0) + Number(inv.igst || 0);
  // Effective rate — prefer the stored one, else derive it from the amounts.
  const ratePct = inv.gst_rate != null && Number(inv.gst_rate) > 0
    ? Math.round(Number(inv.gst_rate) * 10000) / 100
    : taxable > 0 ? Math.round((totalGst / taxable) * 10000) / 100 : 0;
  const halfPct = Math.round((ratePct / 2) * 100) / 100;
  const fmtPct = (p) => `${Number.isInteger(p) ? p : Number(p.toFixed(2))}%`;
  const taxRows = intra
    ? `<div class="row"><span class="mut">CGST @ ${fmtPct(halfPct)}</span><span>${inr(inv.cgst)}</span></div>
       <div class="row"><span class="mut">SGST @ ${fmtPct(halfPct)}</span><span>${inr(inv.sgst)}</span></div>`
    : `<div class="row"><span class="mut">IGST @ ${fmtPct(ratePct)}</span><span>${inr(inv.igst)}</span></div>`;

  const posState = stateService.normalizeState(inv.place_of_supply);
  const posLabel = posState ? `${posState.name} (${posState.code})` : (inv.place_of_supply || '—');

  const statusPill = isCom ? 'DEDUCTED' : 'PAID';
  const statusMeta = isCom ? `${esc(fmtDate(inv.issued_at))} · from host payout`
    : `Paid ${esc(fmtDate(inv.issued_at))} · Razorpay`;

  // source_id for a reschedule invoice is the reschedule_payments row, not the
  // booking — labelling it "Booking ref" would point auditors at the wrong id.
  const refLabel = isSub ? 'Charge ref' : isRsf ? 'Reschedule ref' : 'Booking ref';
  const refId = inv.source_id ? String(inv.source_id).slice(0, 8) : '—';
  const sacLabel = SAC_LABEL[inv.sac_code] || 'Information technology services';

  const note = isSub
    ? 'GST is charged on top of the plan price. Computer-generated invoice — no signature required.'
    : isCom
      ? 'Commission is GST-inclusive: the amount already contains the GST shown. The host claims the GST as input credit.'
      : isRsf
        ? 'The reschedule fee is GST-inclusive: the amount charged already contains the GST shown. Covers rescheduling your booking on Meeticulous.'
        : "Covers Meeticulous's platform fee only. The booked service is supplied by the host, who invoices separately if GST-registered.";

  const buyerTaxLine = inv.buyer_gstin
    ? `<div class="gst">GSTIN <b>${esc(inv.buyer_gstin)}</b></div>`
    : `<div class="b2c">Unregistered (B2C)</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tax Invoice ${esc(inv.invoice_number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
 :root{--sheet:#fff;--ink:#1f2430;--mut:#6b7280;--faint:#9aa1ab;--line:#eef0f3;--line2:#dde1e7;--band:#f6f7f9;
   --r:#EA4335;--g:#34A853;--b:#4285F4;--y:#FBBC05}
 *{box-sizing:border-box} html,body{margin:0;background:#eceef1}
 body{font-family:'Poppins',system-ui,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
 .sheet{width:210mm;min-height:297mm;margin:10px auto;background:var(--sheet);display:flex;flex-direction:column;
   padding:19mm 18mm 0;font-size:11pt;line-height:1.6;box-shadow:0 1px 4px rgba(0,0,0,.1)}
 .body{flex:1 0 auto;display:flex;flex-direction:column}
 .head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:26px}
 .co-name{font-weight:800;font-size:18pt;letter-spacing:-.01em;line-height:1.15}
 .co-tag{font-size:9.5pt;color:var(--mut);margin-top:5px;max-width:72mm}
 .title{text-align:right}.title .t{font-weight:800;font-size:18pt;letter-spacing:.02em}
 .meta{margin-top:13px;display:grid;grid-template-columns:auto auto;gap:6px 12px;justify-content:end;font-size:9.5pt;font-variant-numeric:tabular-nums}
 .meta .k{color:var(--mut);text-align:right}.meta .v{font-weight:600;text-align:right}
 .rule{height:1px;background:var(--line2);margin:0 0 26px}
 .grid2{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-bottom:28px;align-items:start}
 .stack{display:flex;flex-direction:column;gap:26px}
 .lbl{font-size:8pt;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);font-weight:600;margin-bottom:9px}
 .party .nm{font-weight:600;font-size:11.5pt;line-height:1.35}
 .party .ln{color:var(--mut);font-size:9.5pt;line-height:1.65}
 .party .gst{margin-top:6px;font-size:9.5pt;font-variant-numeric:tabular-nums}.party .gst b{color:var(--ink)}
 .b2c{margin-top:6px;font-size:9.5pt;color:var(--mut)}
 .card{background:var(--band);border-radius:12px;padding:18px 20px}
 .card .ct{font-weight:700;font-size:11.5pt;margin-bottom:12px}
 .card .kv{display:flex;justify-content:space-between;gap:14px;font-size:9.5pt;padding:5px 0;font-variant-numeric:tabular-nums}
 .card .kv .k{color:var(--mut)}.card .kv .v{font-weight:500;text-align:right;word-break:break-word}
 .amount{display:flex;align-items:center;gap:12px;margin-bottom:26px}
 .amount .big{font-weight:800;font-size:19pt;font-variant-numeric:tabular-nums}
 .pill{font-size:8.5pt;font-weight:700;color:#0a7c46;background:#e9f8ef;border:1px solid #b7e8cd;padding:4px 11px;border-radius:999px}
 .amount .paymeta{margin-left:auto;font-size:9pt;color:var(--mut);text-align:right;font-variant-numeric:tabular-nums}
 table.items{width:100%;border-collapse:collapse;font-size:10pt;font-variant-numeric:tabular-nums}
 table.items thead th{text-align:right;font-weight:600;color:var(--mut);font-size:8pt;text-transform:uppercase;letter-spacing:.06em;padding:0 0 11px;border-bottom:1.5px solid var(--line2)}
 table.items thead th.l{text-align:left}
 table.items td{padding:17px 0;vertical-align:top;text-align:right;border-bottom:1px solid var(--line)}
 table.items td.l{text-align:left}
 table.items .desc .d{font-weight:600}
 table.items .desc .s{color:var(--mut);font-size:9pt;margin-top:3px}
 .totals{margin:22px 0 0 auto;width:72mm;font-size:10pt;font-variant-numeric:tabular-nums}
 .totals .row{display:flex;justify-content:space-between;padding:7px 0}.totals .row .mut{color:var(--mut)}
 .totals .grand{border-top:2px solid var(--ink);margin-top:6px;padding-top:11px;font-weight:800;font-size:13.5pt}
 .words{text-align:right;font-size:9pt;color:var(--mut);margin-top:5px}
 .tax-summary{margin-top:30px;display:grid;grid-template-columns:1.1fr 1fr;gap:26px;align-items:start}
 table.tsum{width:100%;border-collapse:collapse;font-size:9pt;font-variant-numeric:tabular-nums}
 table.tsum th{text-align:right;font-weight:600;color:var(--faint);font-size:7.5pt;text-transform:uppercase;padding:0 0 7px;border-bottom:1px solid var(--line2)}
 table.tsum th.l{text-align:left}
 table.tsum td{text-align:right;padding:9px 0 0;border-bottom:1px solid var(--line)}
 table.tsum td.l{text-align:left} table.tsum tr:last-child td{border-bottom:none;font-weight:700;color:var(--ink)}
 .sac-note{font-size:9pt;color:var(--mut);line-height:1.6}.sac-note b{color:var(--ink)}.sac-note .cg{display:block;margin-top:9px}
 .foot{flex-shrink:0;margin:34px -18mm 0;padding:18px 18mm 0;border-top:1px solid var(--line)}
 .legalese{font-size:8.5pt;color:var(--faint);line-height:1.6;text-align:center;max-width:150mm;margin:0 auto}.legalese b{color:var(--mut)}
 .bas{display:flex;align-items:center;justify-content:center;gap:10px;margin:16px 0 18px}
 .bas img{height:38px;width:auto;display:block}
 .bas .bs{font-size:8.5pt;color:var(--faint)}
 .quad{display:flex;height:6px;margin:0 -18mm}.quad span{flex:1}
 .quad .r{background:var(--r)}.quad .g{background:var(--g)}.quad .b{background:var(--b)}.quad .y{background:var(--y)}
 @page{size:A4;margin:0} @media print{html,body{background:#fff}.sheet{box-shadow:none;margin:0}}
</style></head>
<body><div class="sheet"><div class="body">
 <div class="head">
   <div>
     <div class="co-name">${esc(s.shortName || s.legalName)}</div>
     <div class="co-tag">${esc(s.address)}</div>
   </div>
   <div class="title"><div class="t">TAX INVOICE</div>
     <div class="meta">
       <div class="k">Invoice #</div><div class="v">${esc(inv.invoice_number)}</div>
       <div class="k">Invoice date</div><div class="v">${esc(fmtDate(inv.issued_at))}</div>
       <div class="k">${esc(fiscalYearLabel(inv.issued_at))}</div><div class="v">Place: ${esc(posLabel)}</div>
       <div class="k">Reverse charge</div><div class="v">No</div>
     </div></div>
 </div>
 <div class="rule"></div>

 <div class="grid2">
   <div class="stack">
     <div class="party">
       <div class="lbl">From</div>
       <div class="nm">${esc(s.legalName)}</div>
       <div class="ln">${esc(s.address)}</div>
       <div class="gst">GSTIN <b>${esc(s.gstin)}</b></div>
       <div class="ln">PAN ${esc(s.pan)} · CIN ${esc(s.cin)}</div>
       <div class="ln">${esc(s.email)} · ${esc(s.phone)}</div>
     </div>
     <div class="party">
       <div class="lbl">Bill to</div>
       <div class="nm">${esc(inv.buyer_name)}</div>
       ${inv.buyer_address ? `<div class="ln">${esc(inv.buyer_address)}</div>` : ''}
       ${buyerTaxLine}
     </div>
   </div>
   <div class="card">
     <div class="ct">${esc(itemDesc)}</div>
     <div class="kv"><span class="k">${esc(refLabel)}</span><span class="v">${esc(refId)}</span></div>
     <div class="kv"><span class="k">Transaction ID</span><span class="v">${esc(inv.payment_id || '—')}</span></div>
     <div class="kv"><span class="k">Place of supply</span><span class="v">${esc(posLabel)}</span></div>
   </div>
 </div>

 <div class="amount">
   <span class="big">${inr(inv.total)}</span><span class="pill">${statusPill}</span>
   <span class="paymeta">${statusMeta}</span>
 </div>

 <table class="items">
   <thead><tr><th class="l">Description</th><th>SAC</th><th>Qty</th><th>Unit price</th><th>Tax</th><th>Amount</th></tr></thead>
   <tbody><tr>
     <td class="l desc"><div class="d">${esc(itemDesc)}</div><div class="s">Ref ${esc(refId)}</div></td>
     <td>${esc(inv.sac_code)}</td><td>1</td><td>${inr(inv.taxable_value)}</td><td>${fmtPct(ratePct)}</td><td>${inr(inv.taxable_value)}</td>
   </tr></tbody>
 </table>
 <div class="totals">
   <div class="row"><span class="mut">Taxable value</span><span>${inr(inv.taxable_value)}</span></div>
   ${taxRows}
   <div class="row grand"><span>Total (INR)</span><span>${inr(inv.total)}</span></div>
 </div>
 <div class="words">${esc(rupeesToWords(inv.total))}</div>

 <div class="tax-summary">
   <table class="tsum">
     <thead><tr><th class="l">Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total tax</th></tr></thead>
     <tbody><tr><td class="l">${inr(inv.taxable_value)}</td><td>${inr(inv.cgst)}</td><td>${inr(inv.sgst)}</td><td>${inr(inv.igst)}</td><td>${inr(totalGst)}</td></tr></tbody>
   </table>
   <div class="sac-note"><b>SAC ${esc(inv.sac_code)}</b> — ${esc(sacLabel)}. <span class="cg">${esc(note)}</span></div>
 </div>
 </div>
 <div class="foot">
   <div class="bas"><img src="${esc(s.logoUrl || seller.logoUrl)}" alt="${esc(s.brandName || 'Meeticulous')}"><span class="bs">${esc(s.brandSubline)}</span></div>
   <div class="legalese"><b>${esc(s.legalName)}</b> is solely responsible for this supply and for issuing this invoice. Issued under the provisions of the CGST Act, 2017.</div>
   <div class="quad"><span class="r"></span><span class="g"></span><span class="b"></span><span class="y"></span></div>
 </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print&&window.print()},350)}</script>
</body></html>`;
}

module.exports = { buildTaxInvoiceHTML };
