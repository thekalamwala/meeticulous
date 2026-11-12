'use strict';
const { seller } = require('../config/sellerIdentity');
const { fiscalYearLabel } = require('./invoiceService');
const stateService = require('./stateService');
const A = require('./invoiceAssets');

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

// Bank row: a real value, or a muted "to be provided" placeholder until the
// founder supplies it (bank details are env/config-driven on the seller).
const bankRow = (k, v) => `<div class="k">${esc(k)}</div>` +
  (v ? `<div class="v">${esc(v)}</div>` : `<div class="v tbd">to be provided</div>`);

function buildTaxInvoiceHTML(inv = {}) {
  // Legal invoicing entity — ALWAYS from seller config (env-overridable). The
  // brand chrome (Rajmudra header, Meeticulous band) is presentation; every
  // legal field below (name, GSTIN, PAN, address, signatory, legalese, bank)
  // binds to this `s` so the registered entity stamped on the invoice stays
  // correct and flips only with the GST registration (SELLER_* env).
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
    ? `<div class="row"><span>CGST @ ${fmtPct(halfPct)}</span><span class="v">${inr(inv.cgst)}</span></div>
       <div class="row"><span>SGST @ ${fmtPct(halfPct)}</span><span class="v">${inr(inv.sgst)}</span></div>`
    : `<div class="row"><span>IGST @ ${fmtPct(ratePct)}</span><span class="v">${inr(inv.igst)}</span></div>`;

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
    ? 'GST is charged on top of the plan price. Computer-generated invoice, digitally signed.'
    : isCom
      ? 'Commission is GST-inclusive: the amount already contains the GST shown. The host claims the GST as input credit.'
      : isRsf
        ? 'The reschedule fee is GST-inclusive: the amount charged already contains the GST shown. Covers rescheduling your booking on Meeticulous.'
        : "Covers Meeticulous's platform fee only. The booked service is supplied by the host, who invoices separately if GST-registered.";

  const buyerTaxLine = inv.buyer_gstin
    ? `<div class="gst">GSTIN <b>${esc(inv.buyer_gstin)}</b></div>`
    : `<div class="b2c">Unregistered (B2C)</div>`;

  // Secondary legal-identity id: LLPIN for an LLP, else CIN. Labelled accordingly.
  const regId = s.llpin ? `LLPIN ${esc(s.llpin)}` : s.cin ? `CIN ${esc(s.cin)}` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tax Invoice ${esc(inv.invoice_number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
 :root{
   --saffron:#F4621E;--saffron-deep:#D94E12;--saffron-tint:#FDEFE6;
   --marigold:#FBB017;--rani:#EC1E79;--teal:#148A80;--navy:#2A2C6E;
   --cream:#FBF4E6;--ink:#20242E;--mut:#6C7280;--faint:#A2A8B2;
   --line:#ECEEF1;--line2:#E0DED6;
   --maroon:#960D32;--maroon-deep:#7A0A28;--maroon-tint:#FBEAF0;
 }
 *{box-sizing:border-box} html,body{margin:0;padding:0;background:#e9ebee}
 body{font-family:'Poppins',system-ui,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
 .inr{white-space:nowrap}
 .tbd{color:var(--faint)!important;font-style:italic;font-weight:500!important}
 .sheet{width:210mm;min-height:297mm;margin:10px auto;background:#fff;display:flex;flex-direction:column;position:relative;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12)}
 .top{position:relative;background:linear-gradient(120deg,#F4621E 0%,#F4621E 55%,#E24E12 100%);color:#fff;padding:26px 20mm 30px;overflow:hidden}
 .top .stripes{position:absolute;inset:0;opacity:.10;background:repeating-linear-gradient(135deg,#fff 0 2px,transparent 2px 16px)}
 .top .row{position:relative;display:flex;justify-content:space-between;align-items:flex-start}
 .brand{display:flex;align-items:center;gap:13px}
 .brand .seal{width:48px;height:48px;display:block}
 .brand .word{height:30px;width:auto;display:block}
 .doc{text-align:right}
 .doc .t{font-family:'Baloo 2',sans-serif;font-weight:800;font-size:26px;letter-spacing:1px;line-height:1}
 .doc .orig{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;opacity:.9;margin-top:6px}
 .frieze{height:12px;width:100%;display:block}
 .body{flex:1 0 auto;padding:22px 20mm 0;position:relative}
 .watermark{position:absolute;right:-120px;top:150px;width:420px;height:420px;opacity:.04;pointer-events:none}
 .parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:16px;position:relative}
 .lbl{font-size:8.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--saffron-deep);font-weight:700;margin-bottom:8px}
 .party .nm{font-weight:700;font-size:13px;color:var(--navy);line-height:1.3}
 .party .ln{font-size:10px;color:var(--mut);line-height:1.6}
 .party .gst{margin-top:6px;font-size:10px}.party .gst b{color:var(--navy)}
 .party .b2c{margin-top:6px;font-size:10px;color:var(--mut)}
 .idtable{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;font-size:10px}
 .idtable .k{color:var(--mut)}.idtable .v{font-weight:600;color:var(--ink)}.idtable .v.no{color:var(--saffron-deep)}
 .gstpill{display:inline-flex;align-items:center;gap:8px;margin:4px 0 18px;background:var(--saffron-tint);border:1px solid #F3C9B2;border-radius:999px;padding:7px 16px;font-size:10px;font-weight:600;color:var(--saffron-deep);letter-spacing:.3px}
 .gstpill .dot{width:5px;height:5px;border-radius:50%;background:var(--saffron)}
 .product{display:flex;align-items:center;gap:15px;margin:0 0 20px;background:var(--maroon-tint);border:1px solid #F0CBD8;border-left:4px solid var(--maroon);border-radius:14px;padding:13px 18px}
 .product .pico{width:44px;height:44px;border-radius:11px;flex:none;display:block}
 .product .pword{height:21px;width:auto;display:block;margin-bottom:5px}
 .product .psub{font-size:9px;color:var(--maroon-deep);opacity:.9;line-height:1.4}
 .product .pby{margin-left:auto;text-align:right;font-size:9px;color:var(--mut);line-height:1.5}
 .product .pby b{color:var(--maroon-deep);font-size:10px}
 .amount{display:flex;align-items:center;gap:11px;margin:0 0 16px}
 .amount .big{font-family:'Baloo 2',sans-serif;font-weight:800;font-size:19px;color:var(--ink)}
 .pill{font-size:8.5px;font-weight:700;color:#0a7c46;background:#e9f8ef;border:1px solid #b7e8cd;padding:4px 11px;border-radius:999px}
 .amount .paymeta{margin-left:auto;font-size:9px;color:var(--mut);text-align:right}
 table.items{width:100%;border-collapse:collapse;font-size:10.5px}
 table.items thead th{background:var(--cream);color:var(--navy);font-weight:700;font-size:8.5px;letter-spacing:.8px;text-transform:uppercase;text-align:right;padding:11px 12px}
 table.items thead th.l{text-align:left;border-top-left-radius:9px;border-bottom-left-radius:9px}
 table.items thead th.r{border-top-right-radius:9px;border-bottom-right-radius:9px}
 table.items tbody td{padding:15px 12px;text-align:right;border-bottom:1px solid var(--line);vertical-align:top}
 table.items tbody td.l{text-align:left}
 table.items .num{color:var(--saffron-deep);font-weight:700}
 table.items .desc .d{font-weight:600;color:var(--ink)}
 table.items .desc .s{color:var(--mut);font-size:9px;margin-top:3px}
 .lower{display:flex;justify-content:space-between;gap:30px;margin-top:20px}
 .words{flex:1;align-self:flex-start;background:var(--cream);border-left:4px solid var(--saffron);border-radius:0 10px 10px 0;padding:12px 16px;font-size:10px;color:var(--ink);max-width:95mm}
 .words b{color:var(--saffron-deep)}
 .totals{width:78mm;font-size:10.5px}
 .totals .row{display:flex;justify-content:space-between;padding:6px 2px;color:var(--mut)}.totals .row .v{color:var(--ink);font-weight:500}
 .totals .grand{margin-top:8px;background:var(--saffron-tint);border:1px solid #F3C9B2;border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
 .totals .grand .gl{font-family:'Baloo 2',sans-serif;font-weight:700;font-size:13px;color:var(--saffron-deep)}
 .totals .grand .gv{font-family:'Baloo 2',sans-serif;font-weight:800;font-size:18px;color:var(--saffron-deep)}
 .tax-summary{margin-top:24px;display:grid;grid-template-columns:1.1fr 1fr;gap:26px;align-items:start}
 table.tsum{width:100%;border-collapse:collapse;font-size:9px}
 table.tsum th{text-align:right;font-weight:700;color:var(--faint);font-size:7.5px;text-transform:uppercase;padding:0 0 7px;border-bottom:1px solid var(--line2)}
 table.tsum th.l{text-align:left}
 table.tsum td{text-align:right;padding:9px 0 0;border-bottom:1px solid var(--line)}
 table.tsum td.l{text-align:left} table.tsum tr:last-child td{border-bottom:none;font-weight:700;color:var(--ink)}
 .sac-note{font-size:9px;color:var(--mut);line-height:1.6}.sac-note b{color:var(--ink)}.sac-note .cg{display:block;margin-top:9px}
 .foot{flex-shrink:0;margin-top:22px}
 .footgrid{padding:0 20mm 14px;display:grid;grid-template-columns:1fr auto;gap:30px;align-items:end}
 .bank .lbl{margin-bottom:7px}
 .bank .bk{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:9.5px}
 .bank .bk .k{color:var(--mut)}.bank .bk .v{font-weight:600;color:var(--navy)}
 .sign{text-align:right;min-width:62mm}
 .sign .cert{font-size:8.5px;color:var(--mut);max-width:60mm;margin:0 0 4px auto;line-height:1.5}
 .sign .sigimg{height:68px;width:auto;display:block;margin:0 8px -10px auto;position:relative;z-index:2}
 .sign .line{border-top:1.5px solid var(--navy);width:56mm;margin-left:auto;padding-top:7px}
 .sign .line .s1{font-family:'Baloo 2',sans-serif;font-weight:700;font-size:11px;color:var(--navy)}
 .sign .line .s2{font-size:8.5px;color:var(--mut);margin-top:1px}
 .legal{text-align:center;font-size:8px;color:var(--faint);padding:0 20mm 10px;line-height:1.5}.legal b{color:var(--mut)}
 @page{size:A4;margin:0} @media print{html,body{background:#fff}.sheet{box-shadow:none;margin:0}}
</style></head>
<body><div class="sheet">
 <div class="top">
   <div class="stripes"></div>
   <div class="row">
     <div class="brand">
       <img class="seal" src="${A.RAJMUDRA_SEAL}" alt="Rajmudra">
       <img class="word" src="${A.RAJMUDRA_WORD}" alt="Rajmudra">
     </div>
     <div class="doc"><div class="t">TAX INVOICE</div><div class="orig">Original for Recipient</div></div>
   </div>
 </div>
 <svg class="frieze" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
   <defs><pattern id="fz" width="12" height="12" patternUnits="userSpaceOnUse">
     <rect width="12" height="12" fill="#FBB017"/>
     <path d="M0 12 q3 -7 6 0 q3 -7 6 0 Z" fill="#EC1E79"/>
     <circle cx="6" cy="3.5" r="1.7" fill="#148A80"/>
     <circle cx="0" cy="3.5" r="1.3" fill="#F4621E"/><circle cx="12" cy="3.5" r="1.3" fill="#F4621E"/>
   </pattern></defs>
   <rect width="120" height="12" fill="url(#fz)"/>
 </svg>

 <div class="body">
   <svg class="watermark" viewBox="0 0 100 100" aria-hidden="true">
     <g transform="translate(50,50)" fill="#F4621E"><circle r="9"/>
       <g id="wp"><path d="M0 -40 q7 11 0 22 q-7 -11 0 -22 Z"/></g>
       <use href="#wp" transform="rotate(30)"/><use href="#wp" transform="rotate(60)"/><use href="#wp" transform="rotate(90)"/>
       <use href="#wp" transform="rotate(120)"/><use href="#wp" transform="rotate(150)"/><use href="#wp" transform="rotate(180)"/>
       <use href="#wp" transform="rotate(210)"/><use href="#wp" transform="rotate(240)"/><use href="#wp" transform="rotate(270)"/>
       <use href="#wp" transform="rotate(300)"/><use href="#wp" transform="rotate(330)"/>
     </g>
   </svg>

   <div class="parties">
     <div class="party">
       <div class="lbl">Billed From</div>
       <div class="nm">${esc(s.legalName)}</div>
       <div class="ln">${esc(s.address)}</div>
       <div class="ln" style="margin-top:6px">${esc(s.email)}${s.phone ? ' · ' + esc(s.phone) : ''}</div>
       <div class="ln">PAN ${esc(s.pan)}${regId ? ' · ' + regId : ''}</div>
     </div>
     <div class="party">
       <div class="lbl">Invoice Details</div>
       <div class="idtable">
         <div class="k">Invoice No.</div><div class="v no">${esc(inv.invoice_number)}</div>
         <div class="k">Date of Issue</div><div class="v">${esc(fmtDate(inv.issued_at))}</div>
         <div class="k">${esc(fiscalYearLabel(inv.issued_at))}</div><div class="v">Place: ${esc(posLabel)}</div>
         <div class="k">Reverse Charge</div><div class="v">No</div>
         <div class="k">Payment Ref</div><div class="v">${esc(inv.payment_id || '—')}</div>
       </div>
       <div class="lbl" style="margin-top:16px">Billed To</div>
       <div class="nm">${esc(inv.buyer_name)}</div>
       ${inv.buyer_address ? `<div class="ln">${esc(inv.buyer_address)}</div>` : ''}
       ${buyerTaxLine}
     </div>
   </div>

   <div class="gstpill"><span class="dot"></span>Seller GSTIN ${esc(s.gstin)} · State Code ${esc(s.stateCode)}${inv.buyer_gstin ? ' &nbsp;|&nbsp; Buyer GSTIN ' + esc(inv.buyer_gstin) : ''}</div>

   <div class="product">
     <img class="pico" src="${A.MEETI_ICON}" alt="Meeticulous">
     <div>
       <img class="pword" src="${A.MEETI_WORD}" alt="Meeticulous">
       <div class="psub">Booking, hosting &amp; payments platform — the product supplied on this invoice</div>
     </div>
     <div class="pby">Supplied by<br><b>${esc(s.legalName)}</b></div>
   </div>

   <div class="amount">
     <span class="big inr">${inr(inv.total)}</span><span class="pill">${statusPill}</span>
     <span class="paymeta">${statusMeta}</span>
   </div>

   <table class="items">
     <thead><tr><th class="l">#</th><th class="l">Description of Supply</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th class="r">Amount</th></tr></thead>
     <tbody><tr>
       <td class="l num">1</td>
       <td class="l desc"><div class="d">${esc(itemDesc)}</div><div class="s">${esc(refLabel)} ${esc(refId)}</div></td>
       <td>${esc(inv.sac_code)}</td><td>1</td><td class="inr">${inr(inv.taxable_value)}</td><td class="inr">${inr(inv.taxable_value)}</td>
     </tr></tbody>
   </table>

   <div class="lower">
     <div class="words">
       <b>Total in words:</b> ${esc(rupeesToWords(inv.total))}
       <div style="margin-top:8px;color:var(--mut);font-size:9px">HSN/SAC ${esc(inv.sac_code)} — ${esc(sacLabel)}.</div>
     </div>
     <div class="totals">
       <div class="row"><span>Taxable Value</span><span class="v inr">${inr(inv.taxable_value)}</span></div>
       ${taxRows}
       <div class="grand"><span class="gl">Grand Total</span><span class="gv inr">${inr(inv.total)}</span></div>
     </div>
   </div>

   <div class="tax-summary">
     <table class="tsum">
       <thead><tr><th class="l">Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total tax</th></tr></thead>
       <tbody><tr><td class="l inr">${inr(inv.taxable_value)}</td><td class="inr">${inr(inv.cgst)}</td><td class="inr">${inr(inv.sgst)}</td><td class="inr">${inr(inv.igst)}</td><td class="inr">${inr(totalGst)}</td></tr></tbody>
     </table>
     <div class="sac-note"><b>SAC ${esc(inv.sac_code)}</b> — ${esc(sacLabel)}. <span class="cg">${esc(note)}</span></div>
   </div>
 </div>

 <div class="foot">
   <div class="footgrid">
     <div class="bank">
       <div class="lbl">Bank Details</div>
       <div class="bk">
         ${bankRow('Bank', s.bankName)}
         ${bankRow('A/C No.', s.bankAccount)}
         ${bankRow('IFSC', s.bankIfsc)}
         ${bankRow('Branch', s.bankBranch)}
       </div>
     </div>
     <div class="sign">
       <div class="cert">Certified that the particulars given above are true and correct.</div>
       <img class="sigimg" src="${A.SIGNATURE}" alt="Authorised Signatory">
       <div class="line"><div class="s1">Authorised Signatory</div><div class="s2">For ${esc(s.legalName)}</div></div>
     </div>
   </div>
   <div class="legal"><b>${esc(s.legalName)}</b> is solely responsible for this supply and for issuing this invoice. Issued under the provisions of the CGST Act, 2017. &nbsp;·&nbsp; ${esc(s.website || 'rajmudramedia.com')}</div>
   <svg class="frieze" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><rect width="120" height="12" fill="url(#fz)"/></svg>
 </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print&&window.print()},350)}</script>
</body></html>`;
}

module.exports = { buildTaxInvoiceHTML };
